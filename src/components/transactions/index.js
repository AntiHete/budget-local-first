import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const CreateBody = z.object({
  id: z.string().uuid().optional(),
  direction: z.enum(["income", "expense"]),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1).max(10).optional().default("UAH"),
  category: z.string().max(80).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  occurredAt: z.string().min(1),
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
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.max(1, Math.min(200, Number(limitRaw ?? 50) || 50));

    const before = url.searchParams.get("before");
    const after = url.searchParams.get("after");

    if (before && after) {
      const { rows } = await sql`
        SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
        FROM transactions
        WHERE profile_id = ${profileId}
          AND occurred_at < ${before}
          AND occurred_at >= ${after}
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT ${limit}
      `;
      return sendJson(res, 200, { ok: true, transactions: mapRows(rows) });
    }

    if (before) {
      const { rows } = await sql`
        SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
        FROM transactions
        WHERE profile_id = ${profileId}
          AND occurred_at < ${before}
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT ${limit}
      `;
      return sendJson(res, 200, { ok: true, transactions: mapRows(rows) });
    }

    if (after) {
      const { rows } = await sql`
        SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
        FROM transactions
        WHERE profile_id = ${profileId}
          AND occurred_at >= ${after}
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT ${limit}
      `;
      return sendJson(res, 200, { ok: true, transactions: mapRows(rows) });
    }

    const { rows } = await sql`
      SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
      FROM transactions
      WHERE profile_id = ${profileId}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `;
    return sendJson(res, 200, { ok: true, transactions: mapRows(rows) });
  }

  if (req.method === "POST") {
    try {
      const body = CreateBody.parse(await readJson(req));

      const occurredAt = new Date(body.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });
      }

      const id = body.id ?? randomUUID();

      const { rows } = await sql`
        INSERT INTO transactions (id, profile_id, direction, amount_cents, currency, category, note, occurred_at)
        VALUES (
          ${id},
          ${profileId},
          ${body.direction},
          ${body.amountCents},
          ${body.currency},
          ${body.category ?? null},
          ${body.note ?? null},
          ${occurredAt.toISOString()}
        )
        RETURNING id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
      `;

      return sendJson(res, 200, { ok: true, transaction: mapRow(rows[0]) });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        return sendJson(res, 409, { ok: false, error: "Transaction id already exists" });
      }
      return sendJson(res, 400, { ok: false, error: msg });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

function mapRows(rows) {
  return rows.map(mapRow);
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