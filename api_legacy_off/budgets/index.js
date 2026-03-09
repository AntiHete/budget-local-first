import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const Month = z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM");

const UpsertBody = z.object({
  month: Month,
  category: z.string().min(1).max(80),
  limitCents: z.number().int().nonnegative(),
  currency: z.string().min(1).max(10).optional().default("UAH"),
});

export default async function handler(req, res) {
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { ok: false, error: "No token" });

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return sendJson(res, 401, { ok: false, error: "Invalid token" });
  }

  const profileId = payload?.profileId ?? null;
  if (!profileId) return sendJson(res, 400, { ok: false, error: "No active profile in token" });

  if (req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const monthParam = url.searchParams.get("month");

    if (monthParam) {
      const parsed = Month.safeParse(monthParam);
      if (!parsed.success) return sendJson(res, 400, { ok: false, error: parsed.error.message });

      const { rows } = await sql`
        SELECT
          b.id,
          b.month,
          b.category,
          b.limit_cents,
          b.currency,
          b.created_at,
          b.updated_at,
          COALESCE(SUM(t.amount_cents), 0) AS spent_cents
        FROM budgets b
        LEFT JOIN transactions t
          ON t.profile_id = b.profile_id
         AND t.direction = 'expense'
         AND COALESCE(t.category, '') = b.category
         AND t.occurred_at >= (to_date(b.month || '-01', 'YYYY-MM-DD')::timestamptz)
         AND t.occurred_at <  ((to_date(b.month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamptz)
        WHERE b.profile_id = ${profileId}
          AND b.month = ${monthParam}
        GROUP BY b.id
        ORDER BY b.category ASC
      `;

      return sendJson(res, 200, { ok: true, budgets: rows.map(mapRowWithFact) });
    }

    const { rows } = await sql`
      SELECT
        b.id,
        b.month,
        b.category,
        b.limit_cents,
        b.currency,
        b.created_at,
        b.updated_at,
        COALESCE(SUM(t.amount_cents), 0) AS spent_cents
      FROM budgets b
      LEFT JOIN transactions t
        ON t.profile_id = b.profile_id
       AND t.direction = 'expense'
       AND COALESCE(t.category, '') = b.category
       AND t.occurred_at >= (to_date(b.month || '-01', 'YYYY-MM-DD')::timestamptz)
       AND t.occurred_at <  ((to_date(b.month || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamptz)
      WHERE b.profile_id = ${profileId}
      GROUP BY b.id
      ORDER BY b.month DESC, b.category ASC
    `;

    return sendJson(res, 200, { ok: true, budgets: rows.map(mapRowWithFact) });
  }

  if (req.method === "POST") {
    try {
      const body = UpsertBody.parse(await readJson(req));
      const month = body.month;
      const category = body.category.trim();
      const limitCents = body.limitCents;
      const currency = body.currency;

      const { rows } = await sql`
        INSERT INTO budgets (id, profile_id, month, category, limit_cents, currency)
        VALUES (${randomUUID()}, ${profileId}, ${month}, ${category}, ${limitCents}, ${currency})
        ON CONFLICT (profile_id, month, category)
        DO UPDATE SET
          limit_cents = EXCLUDED.limit_cents,
          currency    = EXCLUDED.currency,
          updated_at  = NOW()
        RETURNING id, month, category, limit_cents, currency, created_at, updated_at
      `;

      const b = rows[0];

      const spentQ = await sql`
        SELECT COALESCE(SUM(amount_cents), 0) AS spent_cents
        FROM transactions
        WHERE profile_id = ${profileId}
          AND direction = 'expense'
          AND COALESCE(category, '') = ${b.category}
          AND occurred_at >= (to_date(${b.month} || '-01', 'YYYY-MM-DD')::timestamptz)
          AND occurred_at <  ((to_date(${b.month} || '-01', 'YYYY-MM-DD') + interval '1 month')::timestamptz)
      `;

      const spentCents = Number(spentQ.rows?.[0]?.spent_cents ?? 0);

      return sendJson(res, 200, {
        ok: true,
        budget: mapRowWithFact({ ...b, spent_cents: spentCents }),
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

function mapRowWithFact(r) {
  const limitCents = Number(r.limit_cents);
  const spentCents = Number(r.spent_cents ?? 0);
  const remainingCents = Math.max(0, limitCents - spentCents);
  const percentUsed = limitCents > 0 ? Math.min(100, Math.round((spentCents / limitCents) * 100)) : 0;

  return {
    id: r.id,
    month: r.month,
    category: r.category,
    limitCents,
    currency: r.currency,
    spentCents,
    remainingCents,
    percentUsed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}