import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { listBudgets, upsertBudget, deleteBudget } from "../api/budgets";

export function getActiveProfileIdFromToken() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.profileId ?? null;
}

export function makeBudgetKey(month, category) {
  return `${month}::${category}`;
}

export async function pullBudgetsToCache({ month } = {}) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const data = await listBudgets({ month });
  const budgets = data.budgets || [];

  const mapped = budgets.map((b) => {
    const key = makeBudgetKey(b.month, b.category);
    return {
      key,
      profileId,
      serverId: b.id,
      month: b.month,
      category: b.category,
      limitCents: b.limitCents,
      currency: b.currency,
      spentCents: b.spentCents,
      remainingCents: b.remainingCents,
      percentUsed: b.percentUsed,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      deletedAt: null,
      syncStatus: "synced",
    };
  });

  const keys = mapped.map((x) => x.key);
  const existing = await serverCacheDb.budgets.bulkGet(keys);

  const toUpsert = [];
  for (let i = 0; i < mapped.length; i++) {
    const cur = existing[i];
    if (cur && cur.syncStatus && cur.syncStatus !== "synced") continue;
    toUpsert.push(mapped[i]);
  }

  if (toUpsert.length) await serverCacheDb.budgets.bulkPut(toUpsert);
  return toUpsert.length;
}

export async function pushPendingBudgets() {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const pending = await serverCacheDb.budgets
    .where("profileId")
    .equals(profileId)
    .filter((b) => b.syncStatus && b.syncStatus !== "synced")
    .toArray();

  for (const b of pending) {
    if (b.syncStatus === "deleted") {
      if (b.serverId) {
        try {
          await deleteBudget(b.serverId);
        } catch (e) {
          if (!(e?.status === 404)) throw e;
        }
      }
      await serverCacheDb.budgets.delete(b.key);
      continue;
    }

    if (b.syncStatus === "created" || b.syncStatus === "updated") {
      const resp = await upsertBudget({
        month: b.month,
        category: b.category,
        limitCents: b.limitCents,
        currency: b.currency ?? "UAH",
      });

      const saved = resp.budget;
      const key = makeBudgetKey(saved.month, saved.category);

      await serverCacheDb.budgets.put({
        key,
        profileId,
        serverId: saved.id,
        month: saved.month,
        category: saved.category,
        limitCents: saved.limitCents,
        currency: saved.currency,
        spentCents: saved.spentCents,
        remainingCents: saved.remainingCents,
        percentUsed: saved.percentUsed,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        deletedAt: null,
        syncStatus: "synced",
      });

      continue;
    }
  }

  return pending.length;
}

export async function syncBudgets({ month } = {}) {
  await pushPendingBudgets();
  await pullBudgetsToCache({ month });
}