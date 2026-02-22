import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { listBudgets } from "../api/budgets";

export function getActiveProfileIdFromToken() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.profileId ?? null;
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
    };
  });

  await serverCacheDb.budgets.bulkPut(mapped);
  return mapped.length;
}

export function makeBudgetKey(month, category) {
  return `${month}::${category}`;
}