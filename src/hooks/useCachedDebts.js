import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { getToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { pullDebtsToCache } from "../sync/debtsSync";
import { createDebt, patchDebt, deleteDebt } from "../api/debts";

export function useCachedDebts({ status } = {}) {
  const token = getToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId) return [];
    if (status === "open" || status === "closed") {
      return serverCacheDb.debts.where("[profileId+status]").equals([profileId, status]).toArray();
    }
    return serverCacheDb.debts.where("profileId").equals(profileId).toArray();
  }, [profileId, status]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      await pullDebtsToCache({ status, limit: 200 });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [profileId, status]);

  useEffect(() => {
    (async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }
      await refresh();
    })();
  }, [profileId, refresh]);

  const add = useCallback(
    async (input) => {
      setSyncing(true);
      setError(null);
      try {
        const data = await createDebt(input);
        const d = data.debt;
        await serverCacheDb.debts.put({ ...d, profileId });
        return d;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setSyncing(false);
      }
    },
    [profileId]
  );

  const update = useCallback(
    async (id, patch) => {
      setSyncing(true);
      setError(null);
      try {
        const data = await patchDebt(id, patch);
        const d = data.debt;
        await serverCacheDb.debts.put({ ...d, profileId });
        return d;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setSyncing(false);
      }
    },
    [profileId]
  );

  const remove = useCallback(async (id) => {
    setSyncing(true);
    setError(null);
    try {
      await deleteDebt(id);
      await serverCacheDb.debts.delete(id);
      await serverCacheDb.debtPayments.where("debtId").equals(id).delete();
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    profileId,
    items: (items ?? []).sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0)),
    loading,
    syncing,
    error,
    refresh,
    add,
    update,
    remove,
  };
}