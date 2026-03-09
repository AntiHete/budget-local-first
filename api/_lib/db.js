const connectionString =
  process.env.POSTGRES_URL ||
  process.env.BUDGET_DB_POSTGRES_URL ||
  process.env.BUDGET_DB_POSTGRES_URL_NON_POOLING ||
  process.env.BUDGET_DB_POSTGRES_PRISMA_URL ||
  process.env.BUDGET_DB_DATABASE_URL ||
  process.env.BUDGET_DB_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  "";

if (connectionString && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = connectionString;
}

const { sql } = await import("@vercel/postgres");

export { sql };
