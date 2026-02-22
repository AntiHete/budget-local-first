import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { listDebts, getDebt } from "../api/debts";

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
  }));

  await serverCacheDb.debts.bulkPut(mapped);
  return mapped.length;
}

export async function refreshDebtToCache(debtId) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const data = await getDebt(debtId);
  const d = data.debt;

  await serverCacheDb.debts.put({
    ...d,
    profileId,
  });

  return d;
}