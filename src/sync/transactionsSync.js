import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import {
  listTransactions,
  createTransaction,
  patchTransaction,
  deleteTransaction,
} from "../api/transactions";

export function getActiveProfileIdFromToken() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.profileId ?? null;
}

export async function pullTransactionsToCache({ limit = 200 } = {}) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const data = await listTransactions({ limit });
  const incoming = (data.transactions || []).map((t) => ({
    ...t,
    profileId,
    deletedAt: null,
    syncStatus: "synced",
  }));

  const ids = incoming.map((x) => x.id);
  const existing = await serverCacheDb.transactions.bulkGet(ids);

  const toUpsert = [];
  for (let i = 0; i < incoming.length; i++) {
    const cur = existing[i];
    if (cur && cur.syncStatus && cur.syncStatus !== "synced") continue; // не затираємо pending
    toUpsert.push(incoming[i]);
  }

  if (toUpsert.length) await serverCacheDb.transactions.bulkPut(toUpsert);
  return toUpsert.length;
}

export async function pushPendingTransactions() {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const pending = await serverCacheDb.transactions
    .where("profileId")
    .equals(profileId)
    .filter((t) => t.syncStatus && t.syncStatus !== "synced")
    .toArray();

  for (const tx of pending) {
    if (tx.syncStatus === "deleted") {
      try {
        await deleteTransaction(tx.id);
      } catch (e) {
        if (!(e?.status === 404)) throw e;
      }
      await serverCacheDb.transactions.delete(tx.id);
      continue;
    }

    if (tx.syncStatus === "created") {
      try {
        const resp = await createTransaction(toServerCreateBody(tx));
        const saved = resp.transaction;
        await serverCacheDb.transactions.put({
          ...saved,
          profileId,
          deletedAt: null,
          syncStatus: "synced",
        });
      } catch (e) {
        if (e?.status === 409) {
          await serverCacheDb.transactions.update(tx.id, { syncStatus: "synced" });
          continue;
        }
        throw e;
      }
      continue;
    }

    if (tx.syncStatus === "updated") {
      const resp = await patchTransaction(tx.id, toServerPatchBody(tx));
      const saved = resp.transaction;
      await serverCacheDb.transactions.put({
        ...saved,
        profileId,
        deletedAt: null,
        syncStatus: "synced",
      });
      continue;
    }
  }

  return pending.length;
}

function toServerCreateBody(tx) {
  return {
    id: tx.id,
    direction: tx.direction,
    amountCents: tx.amountCents,
    currency: tx.currency,
    category: tx.category ?? null,
    note: tx.note ?? null,
    occurredAt: tx.occurredAt,
  };
}

function toServerPatchBody(tx) {
  return {
    direction: tx.direction,
    amountCents: tx.amountCents,
    currency: tx.currency,
    category: tx.category ?? null,
    note: tx.note ?? null,
    occurredAt: tx.occurredAt,
  };
}