import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sql } from "../../../_lib/db";
import { sendJson, readJson, getBearerToken } from "../../../_lib/http";
import { verifyToken } from "../../../_lib/jwt";

const CreateBody = z.object({
  amountCents: z.number().int().nonnegative(),
  occurredAt: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
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
  const debtsIdx = parts.indexOf("debts");
  const debtId = debtsIdx >= 0 ? parts[debtsIdx + 1] : null;
  if (!debtId) return sendJson(res, 400, { ok: false, error: "Missing debt id" });

  const exists = await sql`
    SELECT id
    FROM debts
    WHERE id = ${debtId} AND profile_id = ${profileId}
    LIMIT 1
  `;
  if (!exists.rows[0]) return sendJson(res, 404, { ok: false, error: "Debt not found" });

  if (req.method === "GET") {
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.max(1, Math.min(200, Number(limitRaw ?? 100) || 100));

    const { rows } = await sql`
      SELECT id, debt_id, amount_cents, occurred_at, note, created_at
      FROM debt_payments
      WHERE debt_id = ${debtId} AND profile_id = ${profileId}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `;

    return sendJson(res, 200, { ok: true, payments: rows.map(mapPayRow) });
  }

  if (req.method === "POST") {
    try {
      const body = CreateBody.parse(await readJson(req));
      const occurredAt = new Date(body.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });

      const id = randomUUID();

      const { rows } = await sql`
        INSERT INTO debt_payments (id, profile_id, debt_id, amount_cents, occurred_at, note)
        VALUES (${id}, ${profileId}, ${debtId}, ${body.amountCents}, ${occurredAt.toISOString()}, ${body.note ?? null})
        RETURNING id, debt_id, amount_cents, occurred_at, note, created_at
      `;

      await refreshDebtStatus(profileId, debtId);

      return sendJson(res, 200, { ok: true, payment: mapPayRow(rows[0]) });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}

function mapPayRow(r) {
  return {
    id: r.id,
    debtId: r.debt_id,
    amountCents: Number(r.amount_cents),
    occurredAt: r.occurred_at,
    note: r.note,
    createdAt: r.created_at,
  };
}

async function refreshDebtStatus(profileId, debtId) {
  const d = await sql`
    SELECT principal_cents
    FROM debts
    WHERE id = ${debtId} AND profile_id = ${profileId}
    LIMIT 1
  `;
  if (!d.rows[0]) return;

  const paidQ = await sql`
    SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents
    FROM debt_payments
    WHERE debt_id = ${debtId} AND profile_id = ${profileId}
  `;

  const principal = Number(d.rows[0].principal_cents);
  const paid = Number(paidQ.rows[0].paid_cents);
  const status = paid >= principal && principal > 0 ? "closed" : "open";

  await sql`
    UPDATE debts
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${debtId} AND profile_id = ${profileId}
  `;
}