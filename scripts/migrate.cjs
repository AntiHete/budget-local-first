const fs = require("node:fs");
const path = require("node:path");
const { sql } = require("@vercel/postgres");

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;

  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;

    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = val;
  }
}

function ensurePostgresUrl() {
  if (process.env.POSTGRES_URL) return;

  const candidates = [
    // стандартні
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "NEON_DATABASE_URL",

    // твій префікс BUDGET_DB_
    "BUDGET_DB_POSTGRES_URL",
    "BUDGET_DB_POSTGRES_URL_NON_POOLING",
    "BUDGET_DB_POSTGRES_PRISMA_URL",
    "BUDGET_DB_DATABASE_URL",
    "BUDGET_DB_DATABASE_URL_UNPOOLED",
  ];

  for (const k of candidates) {
    const v = process.env[k];
    if (v && String(v).trim()) {
      process.env.POSTGRES_URL = v;
      return;
    }
  }

  const keys = Object.keys(process.env).filter(
    (k) => k.toUpperCase().includes("POSTGRES") || k.toUpperCase().includes("DATABASE") || k.toUpperCase().includes("NEON")
  );

  throw new Error(
    `No connection string found. Expected one of: ${candidates.join(", ")}. Available related keys: ${keys.join(", ")}`
  );
}

function splitSqlStatements(sqlText) {
  const noComments = sqlText
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("--") ? "" : l))
    .join("\n");

  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  loadEnvLocal();
  ensurePostgresUrl();

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`schema.sql not found: ${schemaPath}`);

  const schema = fs.readFileSync(schemaPath, "utf8");
  const statements = splitSqlStatements(schema);

  console.log(`Using POSTGRES_URL: ${process.env.POSTGRES_URL ? "OK" : "MISSING"}`);
  console.log(`Running migrations: ${statements.length} statements`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    await sql.query(stmt);
    console.log(`OK ${i + 1}/${statements.length}`);
  }

  console.log("Migrations done ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});