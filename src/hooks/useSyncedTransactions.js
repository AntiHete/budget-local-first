import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { serverCacheDb } from "../db/serverCacheDb";
import { parseJwtPayload } from "../lib/jwtPayload";
import { pullTransactionsToCache, pushPendingTransactions } from "../sync/transactionsSync";
import { useAuthToken } from "./useAuthToken";

export function useSyncedTransactions({ limit = 200 } = {}) {
  const token = useAuthToken();
  const profileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const items = useLiveQuery(async () => {
    if (!profileId) return [];
    const list = await serverCacheDb.transactions
      .where("[profileId+occurredAt]")
      .between([profileId, DexieMin], [profileId, DexieMax])
      .toArray();

    return list
      .filter((t) => !t.deletedAt)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  }, [profileId]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      await pullTransactionsToCache({ limit });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [profileId, limit]);

  const sync = useCallback(async () => {
    if (!profileId) return;
    setSyncing(true);
    setError(null);
    try {
      await pushPendingTransactions();
      await pullTransactionsToCache({ limit });
    } catch (e) {
      setError(e);
    } finally {
      setSyncing(false);
    }
  }, [profileId, limit]);

  useEffect(() => {
    (async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }
      await refresh();
      try {
        await sync();
      } catch {}
    })();
  }, [profileId, refresh, sync]);

  const add = useCallback(
    async (tx) => {
      if (!profileId) throw new Error("No active profileId");

      const now = new Date().toISOString();
      const id = tx.id ?? crypto.randomUUID();

      const local = {
        id,
        profileId,
        direction: tx.direction,
        amountCents: tx.amountCents,
        currency: tx.currency ?? "UAH",
        category: tx.category ?? null,
        note: tx.note ?? null,
        occurredAt: tx.occurredAt,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: "created",
      };

      await serverCacheDb.transactions.put(local);

      try {
        await sync();
      } catch {}

      return id;
    },
    [profileId, sync]
  );

  const update = useCallback(
    async (id, patch) => {
      if (!profileId) throw new Error("No active profileId");

      const existing = await serverCacheDb.transactions.get(id);
      if (!existing || existing.profileId !== profileId) return;

      const updated = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
        syncStatus: existing.syncStatus === "created" ? "created" : "updated",
      };

      await serverCacheDb.transactions.put(updated);

      try {
        await sync();
      } catch {}
    },
    [profileId, sync]
  );

  const remove = useCallback(
    async (id) => {
      if (!profileId) throw new Error("No active profileId");

      const existing = await serverCacheDb.transactions.get(id);
      if (!existing || existing.profileId !== profileId) return;

      const updated = {
        ...existing,
        deletedAt: new Date().toISOString(),
        syncStatus: "deleted",
      };

      await serverCacheDb.transactions.put(updated);

      try {
        await sync();
      } catch {}
    },
    [profileId, sync]
  );

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

const DexieMin = "";
const DexieMax = "\uffff";