import http from "node:http";
import fs from "node:fs";
import path from "node:path";

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
  if (process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim()) return;

  const candidates = [
    "BUDGET_DB_POSTGRES_URL",
    "BUDGET_DB_POSTGRES_URL_NON_POOLING",
    "BUDGET_DB_DATABASE_URL",
    "BUDGET_DB_DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
  ];

  for (const k of candidates) {
    const v = process.env[k];
    if (v && String(v).trim()) {
      process.env.POSTGRES_URL = v;
      return;
    }
  }
}

async function main() {
  loadEnvLocal();
  ensurePostgresUrl();

  const mod = await import(new URL("../api/[...path].js", import.meta.url));
  const handler = mod.default;

  const port = Number(process.env.API_PORT || 3001);

  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (!url.startsWith("/api")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }
    handler(req, res);
  });

  server.listen(port, () => {
    console.log(`[dev-api] listening on http://localhost:${port}`);
    console.log(`[dev-api] health:        http://localhost:${port}/api/health`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});