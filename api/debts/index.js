import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const CreateBody = z.object({
  direction: z.enum(["i_owe", "owed_to_me"]),
  counterparty: z.string().min(1).max(120),
  title: z.string().max(120).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
  principalCents: z.number().int().nonnegative(),
  currency: z.string().min(1).max(10).optional().default("UAH"),
  startedAt: z.string().optional(),
  dueAt: z.string().optional().nullable(),
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
    const status = url.searchParams.get("status"); // open|closed|null
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.max(1, Math.min(200, Number(limitRaw ?? 50) || 50));

    const statusFilter =
      status === "open" || status === "closed" ? status : null;

    const { rows } = statusFilter
      ? await sql`
          SELECT
            d.id, d.direction, d.counterparty, d.title, d.note,
            d.principal_cents, d.currency,
            d.started_at, d.due_at, d.status,
            d.created_at, d.updated_at,
            COALESCE(SUM(p.amount_cents), 0) AS paid_cents
          FROM debts d
          LEFT JOIN debt_payments p
            ON p.debt_id = d.id AND p.profile_id = d.profile_id
          WHERE d.profile_id = ${profileId}
            AND d.status = ${statusFilter}
          GROUP BY d.id
          ORDER BY d.started_at DESC, d.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            d.id, d.direction, d.counterparty, d.title, d.note,
            d.principal_cents, d.currency,
            d.started_at, d.due_at, d.status,
            d.created_at, d.updated_at,
            COALESCE(SUM(p.amount_cents), 0) AS paid_cents
          FROM debts d
          LEFT JOIN debt_payments p
            ON p.debt_id = d.id AND p.profile_id = d.profile_id
          WHERE d.profile_id = ${profileId}
          GROUP BY d.id
          ORDER BY d.started_at DESC, d.created_at DESC
          LIMIT ${limit}
        `;

    return sendJson(res, 200, { ok: true, debts: rows.map(mapDebtRow) });
  }

  if (req.method === "POST") {
    try {
      const body = CreateBody.parse(await readJson(req));

      const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
      if (Number.isNaN(startedAt.getTime())) {
        return sendJson(res, 400, { ok: false, error: "Invalid startedAt" });
      }

      let dueIso = null;
      if (body.dueAt !== undefined) {
        if (body.dueAt === null) dueIso = null;
        else {
          const due = new Date(body.dueAt);
          if (Number.isNaN(due.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid dueAt" });
          dueIso = due.toISOString();
        }
      }

      const id = randomUUID();

      const { rows } = await sql`
        INSERT INTO debts (
          id, profile_id, direction, counterparty, title, note,
          principal_cents, currency, started_at, due_at, status
        )
        VALUES (
          ${id}, ${profileId}, ${body.direction}, ${body.counterparty.trim()},
          ${body.title ?? null}, ${body.note ?? null},
          ${body.principalCents}, ${body.currency},
          ${startedAt.toISOString()}, ${dueIso}, 'open'
        )
        RETURNING
          id, direction, counterparty, title, note,
          principal_cents, currency, started_at, due_at, status,
          created_at, updated_at
      `;

      return sendJson(res, 200, { ok: true, debt: mapDebtRow({ ...rows[0], paid_cents: 0 }) });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
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