import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "./useAuthToken";
import { pushPendingDebts, refreshDebtToCache } from "../sync/debtsSync";
import { pullDebtPaymentsToCache, pushPendingDebtPayments } from "../sync/debtPaymentsSync";

export function useCachedDebtPayments(debtId, { limit = 200 } = {}) {
  const token = useAuthToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId || !debtId) return [];
    const list = await serverCacheDb.debtPayments.where("debtId").equals(debtId).toArray();
    return list
      .filter((p) => !p.deletedAt)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  }, [profileId, debtId]);

  const doSync = useCallback(async () => {
    if (!profileId || !debtId) return;

    // важливо: спочатку пушимо pending debts, бо payment не може існувати без debt на сервері
    await pushPendingDebts();
    await pushPendingDebtPayments({ debtId });
    await pullDebtPaymentsToCache(debtId, { limit });
    await refreshDebtToCache(debtId);
  }, [profileId, debtId, limit]);

  const refresh = useCallback(async () => {
    if (!profileId || !debtId) return;
    setLoading(true);
    setError(null);
    try {
      await doSync();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [profileId, debtId, doSync]);

  useEffect(() => {
    (async () => {
      if (!profileId || !debtId) {
        setLoading(false);
        return;
      }
      await refresh();
    })();
  }, [profileId, debtId, refresh]);

  const add = useCallback(
    async (input) => {
      if (!profileId || !debtId) throw new Error("Missing profileId/debtId");

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      await serverCacheDb.debtPayments.put({
        id,
        profileId,
        debtId,
        amountCents: input.amountCents,
        occurredAt: input.occurredAt,
        note: input.note ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "created",
      });

      setSyncing(true);
      setError(null);
      try {
        await doSync();
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }

      return id;
    },
    [profileId, debtId, doSync]
  );

  const update = useCallback(
    async (paymentId, patch) => {
      if (!profileId || !debtId) throw new Error("Missing profileId/debtId");

      const existing = await serverCacheDb.debtPayments.get(paymentId);
      if (!existing || existing.profileId !== profileId || existing.debtId !== debtId) return;

      await serverCacheDb.debtPayments.put({
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
        syncStatus: existing.syncStatus === "created" ? "created" : "updated",
      });

      setSyncing(true);
      setError(null);
      try {
        await doSync();
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }
    },
    [profileId, debtId, doSync]
  );

  const remove = useCallback(
    async (paymentId) => {
      if (!profileId || !debtId) throw new Error("Missing profileId/debtId");

      const existing = await serverCacheDb.debtPayments.get(paymentId);
      if (!existing || existing.profileId !== profileId || existing.debtId !== debtId) return;

      if (existing.syncStatus === "created") {
        await serverCacheDb.debtPayments.delete(paymentId);
        return;
      }

      await serverCacheDb.debtPayments.put({
        ...existing,
        deletedAt: new Date().toISOString(),
        syncStatus: "deleted",
        updatedAt: new Date().toISOString(),
      });

      setSyncing(true);
      setError(null);
      try {
        await doSync();
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }
    },
    [profileId, debtId, doSync]
  );

  const sync = useCallback(async () => {
    if (!profileId || !debtId) return;
    setSyncing(true);
    setError(null);
    try {
      await doSync();
    } catch (e) {
      setError(e);
    } finally {
      setSyncing(false);
    }
  }, [profileId, debtId, doSync]);

  return {
    profileId,
    items: items ?? [],
    loading,
    syncing,
    error,
    refresh,
    sync,
    add,
    update,
    remove,
  };
}