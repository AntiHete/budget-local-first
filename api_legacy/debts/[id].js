import { z } from "zod";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const PatchBody = z.object({
  direction: z.enum(["i_owe", "owed_to_me"]).optional(),
  counterparty: z.string().min(1).max(120).optional(),
  title: z.string().max(120).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
  principalCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(10).optional(),
  startedAt: z.string().optional(),
  dueAt: z.string().optional().nullable(),
  status: z.enum(["open", "closed"]).optional(),
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
      SELECT
        d.id, d.direction, d.counterparty, d.title, d.note,
        d.principal_cents, d.currency,
        d.started_at, d.due_at, d.status,
        d.created_at, d.updated_at,
        COALESCE(SUM(p.amount_cents), 0) AS paid_cents
      FROM debts d
      LEFT JOIN debt_payments p
        ON p.debt_id = d.id AND p.profile_id = d.profile_id
      WHERE d.id = ${id} AND d.profile_id = ${profileId}
      GROUP BY d.id
      LIMIT 1
    `;
    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
    return sendJson(res, 200, { ok: true, debt: mapDebtRow(rows[0]) });
  }

  if (req.method === "PATCH") {
    try {
      const body = PatchBody.parse(await readJson(req));
      if (Object.keys(body).length === 0) return sendJson(res, 400, { ok: false, error: "Empty patch" });

      const startedIso =
        body.startedAt !== undefined
          ? toIsoOrError(body.startedAt, "startedAt", res)
          : undefined;
      if (startedIso === null) return;

      let dueIso = undefined;
      if (body.dueAt !== undefined) {
        if (body.dueAt === null) dueIso = null;
        else {
          const tmp = toIsoOrError(body.dueAt, "dueAt", res);
          if (tmp === null) return;
          dueIso = tmp;
        }
      }

      const { rows } = await sql`
        UPDATE debts
        SET
          direction       = COALESCE(${body.direction ?? null}, direction),
          counterparty    = COALESCE(${body.counterparty ? body.counterparty.trim() : null}, counterparty),
          title           = CASE WHEN ${body.title === undefined} THEN title ELSE ${body.title ?? null} END,
          note            = CASE WHEN ${body.note === undefined} THEN note ELSE ${body.note ?? null} END,
          principal_cents = COALESCE(${body.principalCents ?? null}, principal_cents),
          currency        = COALESCE(${body.currency ?? null}, currency),
          started_at      = COALESCE(${startedIso ?? null}, started_at),
          due_at          = CASE WHEN ${body.dueAt === undefined} THEN due_at ELSE ${dueIso} END,
          status          = COALESCE(${body.status ?? null}, status),
          updated_at      = NOW()
        WHERE id = ${id} AND profile_id = ${profileId}
        RETURNING
          id, direction, counterparty, title, note,
          principal_cents, currency,
          started_at, due_at, status,
          created_at, updated_at
      `;
      if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

      const paidQ = await sql`
        SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents
        FROM debt_payments
        WHERE debt_id = ${id} AND profile_id = ${profileId}
      `;

      return sendJson(res, 200, { ok: true, debt: mapDebtRow({ ...rows[0], paid_cents: paidQ.rows[0].paid_cents }) });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  if (req.method === "DELETE") {
    const { rows } = await sql`
      DELETE FROM debts
      WHERE id = ${id} AND profile_id = ${profileId}
      RETURNING id
    `;
    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
    return sendJson(res, 200, { ok: true, deletedId: rows[0].id });
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

function toIsoOrError(value, field, res) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    sendJson(res, 400, { ok: false, error: `Invalid ${field}` });
    return null;
  }
  return d.toISOString();
}

function mapDebtRow(r) {
  const principalCents = Number(r.principal_cents);
  const paidCents = Number(r.paid_cents ?? 0);
  const balanceCents = Math.max(0, principalCents - paidCents);

  return {
    id: r.id,
    direction: r.direction,
    counterparty: r.counterparty,
    title: r.title,
    note: r.note,
    principalCents,
    paidCents,
    balanceCents,
    currency: r.currency,
    startedAt: r.started_at,
    dueAt: r.due_at,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}