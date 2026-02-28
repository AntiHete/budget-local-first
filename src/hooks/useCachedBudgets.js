import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { parseJwtPayload } from "../lib/jwtPayload";
import { pullBudgetsToCache, makeBudgetKey } from "../sync/budgetsSync";
import { upsertBudget, deleteBudget } from "../api/budgets";
import { useAuthToken } from "./useAuthToken";

export function useCachedBudgets({ month } = {}) {
  const token = useAuthToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId) return [];
    if (!month) {
      return serverCacheDb.budgets.where("profileId").equals(profileId).toArray();
    }
    return serverCacheDb.budgets.where("[profileId+month]").equals([profileId, month]).toArray();
  }, [profileId, month]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      await pullBudgetsToCache({ month });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [profileId, month]);

  useEffect(() => {
    (async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }
      await refresh();
    })();
  }, [profileId, refresh]);

  const upsert = useCallback(
    async (input) => {
      setSyncing(true);
      setError(null);
      try {
        const data = await upsertBudget(input);
        const b = data.budget;
        const key = makeBudgetKey(b.month, b.category);

        await serverCacheDb.budgets.put({
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
        });

        return b;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setSyncing(false);
      }
    },
    [profileId]
  );

  const remove = useCallback(async (budgetKey) => {
    const row = await serverCacheDb.budgets.get(budgetKey);
    if (!row?.serverId) return;

    setSyncing(true);
    setError(null);
    try {
      await deleteBudget(row.serverId);
      await serverCacheDb.budgets.delete(budgetKey);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    profileId,
    items: items ?? [],
    loading,
    syncing,
    error,
    refresh,
    upsert,
    remove,
  };
}