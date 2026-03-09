import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "@vercel/postgres";

function loadEnvLocal() {
  const root = process.cwd();
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;

  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = val;
  }
}

function splitSqlStatements(sqlText) {
  // прибираємо рядкові коментарі --
  const noComments = sqlText
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("--") ? "" : l))
    .join("\n");

  // простий split по ; (для нашої schema.sql цього достатньо)
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  loadEnvLocal();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const schemaPath = path.resolve(__dirname, "..", "_db", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found: ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  const statements = splitSqlStatements(schema);

  console.log(`Running migrations: ${statements.length} statements`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await sql.query(stmt);
      console.log(`OK ${i + 1}/${statements.length}`);
    } catch (e) {
      console.error(`FAILED at statement ${i + 1}/${statements.length}`);
      console.error(stmt);
      throw e;
    }
  }

  console.log("Migrations done ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});