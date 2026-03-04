import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { listDebtPayments, createDebtPayment, patchDebtPayment, deleteDebtPayment } from "../api/debtPayments";

export function getActiveProfileIdFromToken() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.profileId ?? null;
}

export async function pullDebtPaymentsToCache(debtId, { limit = 200 } = {}) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");
  if (!debtId) return 0;

  const data = await listDebtPayments(debtId, { limit });
  const payments = data.payments || [];

  const mapped = payments.map((p) => ({
    ...p,
    profileId,
    updatedAt: p.createdAt ?? new Date().toISOString(),
    deletedAt: null,
    syncStatus: "synced",
  }));

  const ids = mapped.map((x) => x.id);
  const existing = await serverCacheDb.debtPayments.bulkGet(ids);

  const toUpsert = [];
  for (let i = 0; i < mapped.length; i++) {
    const cur = existing[i];
    if (cur && cur.syncStatus && cur.syncStatus !== "synced") continue;
    toUpsert.push(mapped[i]);
  }

  if (toUpsert.length) await serverCacheDb.debtPayments.bulkPut(toUpsert);
  return toUpsert.length;
}

export async function pushPendingDebtPayments({ debtId } = {}) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const base = serverCacheDb.debtPayments.where("profileId").equals(profileId);
  const pending = await base.filter((p) => (debtId ? p.debtId === debtId : true) && p.syncStatus && p.syncStatus !== "synced").toArray();

  for (const p of pending) {
    if (p.syncStatus === "deleted") {
      try {
        await deleteDebtPayment(p.debtId, p.id);
      } catch (e) {
        if (!(e?.status === 404)) throw e;
      }
      await serverCacheDb.debtPayments.delete(p.id);
      continue;
    }

    if (p.syncStatus === "created") {
      try {
        const resp = await createDebtPayment(p.debtId, {
          id: p.id,
          amountCents: p.amountCents,
          occurredAt: p.occurredAt,
          note: p.note ?? null,
        });
        await serverCacheDb.debtPayments.put({
          ...resp.payment,
          profileId,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          syncStatus: "synced",
        });
      } catch (e) {
        if (e?.status === 409) {
          await serverCacheDb.debtPayments.update(p.id, { syncStatus: "synced", deletedAt: null });
          continue;
        }
        throw e;
      }
      continue;
    }

    if (p.syncStatus === "updated") {
      const resp = await patchDebtPayment(p.debtId, p.id, {
        amountCents: p.amountCents,
        occurredAt: p.occurredAt,
        note: p.note ?? null,
      });
      await serverCacheDb.debtPayments.put({
        ...resp.payment,
        profileId,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        syncStatus: "synced",
      });
      continue;
    }
  }

  return pending.length;
}