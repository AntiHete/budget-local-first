import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "./useAuthToken";
import { makeBudgetKey, syncBudgets } from "../sync/budgetsSync";

export function useCachedBudgets({ month } = {}) {
  const token = useAuthToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId) return [];
    const list = month
      ? await serverCacheDb.budgets.where("[profileId+month]").equals([profileId, month]).toArray()
      : await serverCacheDb.budgets.where("profileId").equals(profileId).toArray();

    return list.filter((b) => !b.deletedAt).sort((a, b) => (a.category > b.category ? 1 : a.category < b.category ? -1 : 0));
  }, [profileId, month]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      await syncBudgets({ month });
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
      if (!profileId) throw new Error("No active profileId");

      const key = makeBudgetKey(input.month, input.category);
      const now = new Date().toISOString();
      const existing = await serverCacheDb.budgets.get(key);

      const local = {
        key,
        profileId,
        serverId: existing?.serverId ?? null,
        month: input.month,
        category: input.category,
        limitCents: input.limitCents,
        currency: input.currency ?? "UAH",

        spentCents: existing?.spentCents ?? 0,
        remainingCents: existing?.remainingCents ?? input.limitCents,
        percentUsed: existing?.percentUsed ?? 0,

        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: existing?.syncStatus === "created" ? "created" : (existing?.serverId ? "updated" : "created"),
      };

      await serverCacheDb.budgets.put(local);

      setSyncing(true);
      setError(null);
      try {
        await syncBudgets({ month: input.month });
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }

      return key;
    },
    [profileId]
  );

  const remove = useCallback(
    async (budgetKey) => {
      const row = await serverCacheDb.budgets.get(budgetKey);
      if (!row || row.profileId !== profileId) return;

      // якщо бюджет ще не пушився на сервер — видаляємо локально одразу
      if (!row.serverId && row.syncStatus === "created") {
        await serverCacheDb.budgets.delete(budgetKey);
        return;
      }

      await serverCacheDb.budgets.put({
        ...row,
        deletedAt: new Date().toISOString(),
        syncStatus: "deleted",
        updatedAt: new Date().toISOString(),
      });

      setSyncing(true);
      setError(null);
      try {
        await syncBudgets({ month: row.month });
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }
    },
    [profileId]
  );

  const sync = useCallback(async () => {
    if (!profileId) return;
    setSyncing(true);
    setError(null);
    try {
      await syncBudgets({ month });
    } catch (e) {
      setError(e);
    } finally {
      setSyncing(false);
    }
  }, [profileId, month]);

  return {
    profileId,
    items: items ?? [],
    loading,
    syncing,
    error,
    refresh,
    sync,
    upsert,
    remove,
  };
}