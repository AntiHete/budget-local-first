import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "../api/transactions";

function sortTransactions(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.occurredAt || a.date || 0).getTime();
    const bTime = new Date(b.occurredAt || b.date || 0).getTime();
    return bTime - aTime;
  });
}

function normalizeTransaction(tx) {
  return {
    id: tx.id,
    accountId: tx.accountId ?? null,
    type: tx.direction,
    direction: tx.direction,
    amount: Number(tx.amountCents ?? 0) / 100,
    amountCents: Number(tx.amountCents ?? 0),
    currency: tx.currency ?? "UAH",
    category: tx.category ?? "",
    note: tx.note ?? "",
    occurredAt: tx.occurredAt,
    date: String(tx.occurredAt ?? "").slice(0, 10),
    createdAt: tx.createdAt ?? null,
    updatedAt: tx.updatedAt ?? null,
  };
}

function toServerPayload(input, { partial = false } = {}) {
  const payload = {};

  if (!partial || input.accountId !== undefined) {
    payload.accountId = input.accountId || null;
  }

  if (!partial || input.type !== undefined) {
    payload.direction = input.type;
  }

  if (!partial || input.amount !== undefined) {
    payload.amountCents = Math.round(Number(input.amount || 0) * 100);
  }

  if (!partial || input.currency !== undefined) {
    payload.currency = (input.currency || "UAH").trim().toUpperCase();
  }

  if (!partial || input.category !== undefined) {
    payload.category = (input.category || "").trim() || null;
  }

  if (!partial || input.note !== undefined) {
    payload.note = (input.note || "").trim() || null;
  }

  if (!partial || input.date !== undefined) {
    payload.occurredAt = input.date
      ? new Date(`${input.date}T12:00:00`).toISOString()
      : new Date().toISOString();
  }

  return payload;
}

export function useSyncedTransactions({ activeProfileId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!activeProfileId) {
      setItems([]);
      return [];
    }

    setLoading(true);
    setError("");

    try {
      const data = await listTransactions();
      const next = sortTransactions(
        (data.transactions || []).map(normalizeTransaction)
      );
      setItems(next);
      return next;
    } catch (e) {
      setError(String(e?.message ?? e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [activeProfileId]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const createTx = useCallback(async (input) => {
    setSaving(true);
    setError("");

    try {
      const data = await createTransaction(toServerPayload(input));
      const nextTx = normalizeTransaction(data.transaction);
      setItems((prev) => sortTransactions([nextTx, ...prev]));
      return nextTx;
    } catch (e) {
      setError(String(e?.message ?? e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTx = useCallback(async (id, patch) => {
    setSaving(true);
    setError("");

    try {
      const data = await updateTransaction(id, toServerPayload(patch, { partial: true }));
      const nextTx = normalizeTransaction(data.transaction);

      setItems((prev) =>
        sortTransactions(prev.map((item) => (item.id === id ? nextTx : item)))
      );

      return nextTx;
    } catch (e) {
      setError(String(e?.message ?? e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const removeTx = useCallback(async (id) => {
    setSaving(true);
    setError("");

    try {
      await deleteTransaction(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(String(e?.message ?? e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return useMemo(
    () => ({
      items,
      loading,
      saving,
      error,
      reload,
      createTx,
      updateTx,
      removeTx,
    }),
    [items, loading, saving, error, reload, createTx, updateTx, removeTx]
  );
}

