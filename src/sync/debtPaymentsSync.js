import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { listDebtPayments } from "../api/debtPayments";

export function getActiveProfileIdFromToken() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.profileId ?? null;
}

export async function pullDebtPaymentsToCache(debtId, { limit = 200 } = {}) {
  const profileId = getActiveProfileIdFromToken();
  if (!profileId) throw new Error("No active profileId in token");

  const data = await listDebtPayments(debtId, { limit });
  const payments = data.payments || [];

  const mapped = payments.map((p) => ({
    ...p,
    profileId,
  }));

  await serverCacheDb.debtPayments.bulkPut(mapped);
  return mapped.length;
}