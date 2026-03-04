import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { listDebts, getDebt, createDebt, patchDebt, deleteDebt } from "../api/debts";

export function getActiveProfileIdFromToken() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.profileId ?? null;
}

export async function pullDebtsToCache({ status, limit = 200 } = {}) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const data = await listDebts({ status, limit });
  const debts = data.debts || [];

  const mapped = debts.map((d) => ({
    ...d,
    profileId,
    deletedAt: null,
    syncStatus: "synced",
  }));

  const ids = mapped.map((x) => x.id);
  const existing = await serverCacheDb.debts.bulkGet(ids);

  const toUpsert = [];
  for (let i = 0; i < mapped.length; i++) {
    const cur = existing[i];
    if (cur && cur.syncStatus && cur.syncStatus !== "synced") continue;
    toUpsert.push(mapped[i]);
  }

  if (toUpsert.length) await serverCacheDb.debts.bulkPut(toUpsert);
  return toUpsert.length;
}

export async function refreshDebtToCache(debtId) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const data = await getDebt(debtId);
  const d = data.debt;

  const cur = await serverCacheDb.debts.get(debtId);
  if (cur && cur.syncStatus && cur.syncStatus !== "synced") return d;

  await serverCacheDb.debts.put({
    ...d,
    profileId,
    deletedAt: null,
    syncStatus: "synced",
  });

  return d;
}

export async function pushPendingDebts() {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const pending = await serverCacheDb.debts
    .where("profileId")
    .equals(profileId)
    .filter((d) => d.syncStatus && d.syncStatus !== "synced")
    .toArray();

  for (const d of pending) {
    if (d.syncStatus === "deleted") {
      try {
        await deleteDebt(d.id);
      } catch (e) {
        if (!(e?.status === 404)) throw e;
      }
      await serverCacheDb.debts.delete(d.id);
      await serverCacheDb.debtPayments.where("debtId").equals(d.id).delete();
      continue;
    }

    if (d.syncStatus === "created") {
      try {
        const resp = await createDebt({
          id: d.id,
          direction: d.direction,
          counterparty: d.counterparty,
          title: d.title ?? null,
          note: d.note ?? null,
          principalCents: d.principalCents,
          currency: d.currency ?? "UAH",
          startedAt: d.startedAt,
          dueAt: d.dueAt ?? null,
        });

        await serverCacheDb.debts.put({
          ...resp.debt,
          profileId,
          deletedAt: null,
          syncStatus: "synced",
        });
      } catch (e) {
        if (e?.status === 409) {
          await serverCacheDb.debts.update(d.id, { syncStatus: "synced", deletedAt: null });
          continue;
        }
        throw e;
      }
      continue;
    }

    if (d.syncStatus === "updated") {
      const resp = await patchDebt(d.id, {
        direction: d.direction,
        counterparty: d.counterparty,
        title: d.title ?? null,
        note: d.note ?? null,
        principalCents: d.principalCents,
        currency: d.currency ?? "UAH",
        startedAt: d.startedAt,
        dueAt: d.dueAt ?? null,
        status: d.status,
      });

      await serverCacheDb.debts.put({
        ...resp.debt,
        profileId,
        deletedAt: null,
        syncStatus: "synced",
      });
      continue;
    }
  }

  return pending.length;
}

export async function syncDebts({ status } = {}) {
  await pushPendingDebts();
  await pullDebtsToCache({ status, limit: 200 });
}