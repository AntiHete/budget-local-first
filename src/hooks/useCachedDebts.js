import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "./useAuthToken";
import { syncDebts } from "../sync/debtsSync";

export function useCachedDebts({ status } = {}) {
  const token = useAuthToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId) return [];
    const base =
      status === "open" || status === "closed"
        ? await serverCacheDb.debts.where("[profileId+status]").equals([profileId, status]).toArray()
        : await serverCacheDb.debts.where("profileId").equals(profileId).toArray();

    return base
      .filter((d) => !d.deletedAt)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  }, [profileId, status]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      await syncDebts({ status });
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
      if (!profileId) throw new Error("No active profileId");

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const local = {
        id,
        profileId,

        direction: input.direction,
        counterparty: input.counterparty,
        title: input.title ?? null,
        note: input.note ?? null,

        principalCents: input.principalCents,
        paidCents: 0,
        balanceCents: input.principalCents,
        currency: input.currency ?? "UAH",

        startedAt: input.startedAt ?? now,
        dueAt: input.dueAt ?? null,

        status: "open",
        createdAt: now,
        updatedAt: now,

        deletedAt: null,
        syncStatus: "created",
      };

      await serverCacheDb.debts.put(local);

      setSyncing(true);
      setError(null);
      try {
        await syncDebts({ status });
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }

      return local;
    },
    [profileId, status]
  );

  const update = useCallback(
    async (id, patch) => {
      if (!profileId) throw new Error("No active profileId");

      const existing = await serverCacheDb.debts.get(id);
      if (!existing || existing.profileId !== profileId) return null;

      const next = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
        syncStatus: existing.syncStatus === "created" ? "created" : "updated",
      };

      await serverCacheDb.debts.put(next);

      setSyncing(true);
      setError(null);
      try {
        await syncDebts({ status });
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }

      return next;
    },
    [profileId, status]
  );

  const remove = useCallback(
    async (id) => {
      const existing = await serverCacheDb.debts.get(id);
      if (!existing || existing.profileId !== profileId) return;

      if (existing.syncStatus === "created") {
        await serverCacheDb.debts.delete(id);
        await serverCacheDb.debtPayments.where("debtId").equals(id).delete();
        return;
      }

      await serverCacheDb.debts.put({
        ...existing,
        deletedAt: new Date().toISOString(),
        syncStatus: "deleted",
        updatedAt: new Date().toISOString(),
      });

      setSyncing(true);
      setError(null);
      try {
        await syncDebts({ status });
      } catch (e) {
        setError(e);
      } finally {
        setSyncing(false);
      }
    },
    [profileId, status]
  );

  const sync = useCallback(async () => {
    if (!profileId) return;
    setSyncing(true);
    setError(null);
    try {
      await syncDebts({ status });
    } catch (e) {
      setError(e);
    } finally {
      setSyncing(false);
    }
  }, [profileId, status]);

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