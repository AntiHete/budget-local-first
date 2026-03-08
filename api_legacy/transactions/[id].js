// api/transactions/[id].js
import { z } from "zod";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const PatchBody = z.object({
  direction: z.enum(["income", "expense"]).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(10).optional(),
  category: z.string().max(80).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  occurredAt: z.string().min(1).optional(), // ISO
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
      SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
      FROM transactions
      WHERE id = ${id} AND profile_id = ${profileId}
      LIMIT 1
    `;

    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
    return sendJson(res, 200, { ok: true, transaction: mapRow(rows[0]) });
  }

  if (req.method === "PATCH") {
    try {
      const body = PatchBody.parse(await readJson(req));

      // Якщо нічого не прийшло — не оновлюємо
      const keys = Object.keys(body);
      if (keys.length === 0) return sendJson(res, 400, { ok: false, error: "Empty patch" });

      let occurredIso = undefined;
      if (body.occurredAt !== undefined) {
        const d = new Date(body.occurredAt);
        if (Number.isNaN(d.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });
        occurredIso = d.toISOString();
      }

      const { rows } = await sql`
        UPDATE transactions
        SET
          direction   = COALESCE(${body.direction ?? null}, direction),
          amount_cents= COALESCE(${body.amountCents ?? null}, amount_cents),
          currency    = COALESCE(${body.currency ?? null}, currency),
          category    = CASE WHEN ${body.category === undefined} THEN category ELSE ${body.category ?? null} END,
          note        = CASE WHEN ${body.note === undefined} THEN note ELSE ${body.note ?? null} END,
          occurred_at = COALESCE(${occurredIso ?? null}, occurred_at),
          updated_at  = NOW()
        WHERE id = ${id} AND profile_id = ${profileId}
        RETURNING id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
      `;

      if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
      return sendJson(res, 200, { ok: true, transaction: mapRow(rows[0]) });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  if (req.method === "DELETE") {
    const { rows } = await sql`
      DELETE FROM transactions
      WHERE id = ${id} AND profile_id = ${profileId}
      RETURNING id
    `;

    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
    return sendJson(res, 200, { ok: true, deletedId: rows[0].id });
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

function mapRow(r) {
  return {
    id: r.id,
    direction: r.direction,
    amountCents: Number(r.amount_cents),
    currency: r.currency,
    category: r.category,
    note: r.note,
    occurredAt: r.occurred_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}