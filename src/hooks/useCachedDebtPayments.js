import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { pullDebtPaymentsToCache } from "../sync/debtPaymentsSync";
import { refreshDebtToCache } from "../sync/debtsSync";
import {
  createDebtPayment,
  patchDebtPayment,
  deleteDebtPayment,
} from "../api/debtPayments";

export function useCachedDebtPayments(debtId, { limit = 200 } = {}) {
  const token = getToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId || !debtId) return [];
    const list = await serverCacheDb.debtPayments.where("debtId").equals(debtId).toArray();
    return list.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  }, [profileId, debtId]);

  const refresh = useCallback(async () => {
    if (!profileId || !debtId) return;
    setLoading(true);
    setError(null);
    try {
      await pullDebtPaymentsToCache(debtId, { limit });
      await refreshDebtToCache(debtId);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [profileId, debtId, limit]);

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
      if (!debtId) return;
      setSyncing(true);
      setError(null);
      try {
        const data = await createDebtPayment(debtId, input);
        await serverCacheDb.debtPayments.put({ ...data.payment, profileId });
        await refreshDebtToCache(debtId);
        return data.payment;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setSyncing(false);
      }
    },
    [profileId, debtId]
  );

  const update = useCallback(
    async (paymentId, patch) => {
      if (!debtId) return;
      setSyncing(true);
      setError(null);
      try {
        const data = await patchDebtPayment(debtId, paymentId, patch);
        await serverCacheDb.debtPayments.put({ ...data.payment, profileId });
        await refreshDebtToCache(debtId);
        return data.payment;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setSyncing(false);
      }
    },
    [profileId, debtId]
  );

  const remove = useCallback(
    async (paymentId) => {
      if (!debtId) return;
      setSyncing(true);
      setError(null);
      try {
        await deleteDebtPayment(debtId, paymentId);
        await serverCacheDb.debtPayments.delete(paymentId);
        await refreshDebtToCache(debtId);
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setSyncing(false);
      }
    },
    [debtId]
  );

  return {
    profileId,
    items: items ?? [],
    loading,
    syncing,
    error,
    refresh,
    add,
    update,
    remove,
  };
}