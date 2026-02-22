import { useCallback, useEffect, useState } from "react";
import {
  listTransactions,
  createTransaction,
  patchTransaction,
  deleteTransaction,
} from "../api/transactions";

export function useServerTransactions({ limit = 50 } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTransactions({ limit });
      setItems(data.transactions || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (tx) => {
    const data = await createTransaction(tx);
    setItems((prev) => [data.transaction, ...prev]);
    return data.transaction;
  }, []);

  const update = useCallback(async (id, patch) => {
    const data = await patchTransaction(id, patch);
    setItems((prev) => prev.map((x) => (x.id === id ? data.transaction : x)));
    return data.transaction;
  }, []);

  const remove = useCallback(async (id) => {
    await deleteTransaction(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { items, loading, error, refresh, add, update, remove };
}