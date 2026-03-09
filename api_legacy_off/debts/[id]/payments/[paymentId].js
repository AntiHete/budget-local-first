import { z } from "zod";
import { sql } from "../../../../_lib/db";
import { sendJson, readJson, getBearerToken } from "../../../../_lib/http";
import { verifyToken } from "../../../../_lib/jwt";

const PatchBody = z.object({
  amountCents: z.number().int().nonnegative().optional(),
  occurredAt: z.string().optional(),
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
  const payIdx = parts.indexOf("payments");
  const paymentId = payIdx >= 0 ? parts[payIdx + 1] : null;

  if (!debtId) return sendJson(res, 400, { ok: false, error: "Missing debt id" });
  if (!paymentId) return sendJson(res, 400, { ok: false, error: "Missing payment id" });

  if (req.method === "PATCH") {
    try {
      const body = PatchBody.parse(await readJson(req));
      if (Object.keys(body).length === 0) return sendJson(res, 400, { ok: false, error: "Empty patch" });

      let occurredIso = undefined;
      if (body.occurredAt !== undefined) {
        const d = new Date(body.occurredAt);
        if (Number.isNaN(d.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });
        occurredIso = d.toISOString();
      }

      const { rows } = await sql`
        UPDATE debt_payments
        SET
          amount_cents = COALESCE(${body.amountCents ?? null}, amount_cents),
          occurred_at  = COALESCE(${occurredIso ?? null}, occurred_at),
          note         = CASE WHEN ${body.note === undefined} THEN note ELSE ${body.note ?? null} END
        WHERE id = ${paymentId} AND debt_id = ${debtId} AND profile_id = ${profileId}
        RETURNING id, debt_id, amount_cents, occurred_at, note, created_at
      `;

      if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

      await refreshDebtStatus(profileId, debtId);

      return sendJson(res, 200, { ok: true, payment: mapPayRow(rows[0]) });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  if (req.method === "DELETE") {
    const { rows } = await sql`
      DELETE FROM debt_payments
      WHERE id = ${paymentId} AND debt_id = ${debtId} AND profile_id = ${profileId}
      RETURNING id
    `;
    if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

    await refreshDebtStatus(profileId, debtId);

    return sendJson(res, 200, { ok: true, deletedId: rows[0].id });
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