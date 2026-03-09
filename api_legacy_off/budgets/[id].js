import { z } from "zod";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const PatchBody = z.object({
  limitCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(10).optional(),
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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  if (!id) return sendJson(res, 400, { ok: false, error: "Missing id" });

  if (req.method === "GET") {
    const { rows } = await sql`
      SELECT id, month, category, limit_cents, currency, created_at, updated_at
      FROM budgets
      WHERE id = ${id} AND profile_id = ${profileId}
      LIMIT 1
    `;
    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

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

    return sendJson(res, 200, { ok: true, budget: mapRowWithFact({ ...b, spent_cents: spentQ.rows[0].spent_cents }) });
  }

  if (req.method === "PATCH") {
    try {
      const body = PatchBody.parse(await readJson(req));
      if (Object.keys(body).length === 0) return sendJson(res, 400, { ok: false, error: "Empty patch" });

      const { rows } = await sql`
        UPDATE budgets
        SET
          limit_cents = COALESCE(${body.limitCents ?? null}, limit_cents),
          currency    = COALESCE(${body.currency ?? null}, currency),
          updated_at  = NOW()
        WHERE id = ${id} AND profile_id = ${profileId}
        RETURNING id, month, category, limit_cents, currency, created_at, updated_at
      `;
      if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

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

      return sendJson(res, 200, { ok: true, budget: mapRowWithFact({ ...b, spent_cents: spentQ.rows[0].spent_cents }) });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  if (req.method === "DELETE") {
    const { rows } = await sql`
      DELETE FROM budgets
      WHERE id = ${id} AND profile_id = ${profileId}
      RETURNING id
    `;
    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

    return sendJson(res, 200, { ok: true, deletedId: rows[0].id });
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