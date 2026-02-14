import { sendJson } from "../_lib/http";
import { sql } from "../_lib/db";
import fs from "node:fs";
import path from "node:path";

export default async function handler(req, res) {
  const key = new URL(req.url, "http://local").searchParams.get("key");
  if (!process.env.MIGRATE_KEY || key !== process.env.MIGRATE_KEY) {
    return sendJson(res, 403, { ok: false, error: "Forbidden" });
  }

  const schemaPath = path.join(process.cwd(), "api", "_db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  // Виконуємо як один batch (для старту ок)
  await sql.unsafe(schema);

  return sendJson(res, 200, { ok: true });
}
