import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "react-router-dom";

import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import { listAccounts } from "../api/accounts";
import { useSyncedTransactions } from "../hooks/useSyncedTransactions";

function fmtMoney(x, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(x || 0));
}

function toNumOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const { activeProfileId } = useProfile();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight") || null;

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");

  const [form, setForm] = useState({
    id: null,
    date: todayISO(),
    type: "expense",
    accountId: "",
    category: "",
    amount: "",
    note: "",
    currency: "UAH",
  });

  const [q, setQ] = useState("");
  const [fType, setFType] = useState("all");
  const [fAccountId, setFAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const categoryRows = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const rows = await db.categories.where("profileId").equals(activeProfileId).toArray();
    rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return rows;
  }, [activeProfileId]);

  const categorySuggestions = useMemo(() => {
    const list = (categoryRows || [])
      .filter((row) => row.type === form.type)
      .map((row) => row.name)
      .filter(Boolean);

    return [...new Set(list)];
  }, [categoryRows, form.type]);

  const {
    items,
    loading,
    saving,
    error,
    reload,
    createTx,
    updateTx,
    removeTx,
  } = useSyncedTransactions({ activeProfileId });

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      if (!activeProfileId) {
        setAccounts([]);
        return;
      }

      setAccountsLoading(true);
      setAccountsError("");

      try {
        const data = await listAccounts();
        if (cancelled) return;

        const next = data.accounts || [];
        setAccounts(next);

        setForm((prev) => {
          const exists = next.some((a) => String(a.id) === String(prev.accountId));
          if (exists) return prev;

          const defaultAccount = next.find((a) => a.isDefault) || next[0];
          return {
            ...prev,
            accountId: defaultAccount ? String(defaultAccount.id) : "",
          };
        });
      } catch (e) {
        if (cancelled) return;
        setAccountsError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    }

    loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId]);

  const accountNameById = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      map.set(String(account.id), account.name);
    }
    return map;
  }, [accounts]);

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const min = toNumOrNull(minAmount);
    const max = toNumOrNull(maxAmount);

    return (items || []).filter((tx) => {
      if (fType !== "all" && tx.type !== fType) return false;
      if (fAccountId && String(tx.accountId || "") !== String(fAccountId)) return false;
      if (dateFrom && (tx.date || "") < dateFrom) return false;
      if (dateTo && (tx.date || "") > dateTo) return false;
      if (min !== null && Number(tx.amount || 0) < min) return false;
      if (max !== null && Number(tx.amount || 0) > max) return false;

      if (qLower) {
        const hay =
          `${tx.category || ""} ${tx.note || ""} ${accountNameById.get(String(tx.accountId || "")) || ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }

      return true;
    });
  }, [items, q, fType, fAccountId, dateFrom, dateTo, minAmount, maxAmount, accountNameById]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of filtered) {
      const amount = Number(tx.amount || 0);
      if (tx.type === "income") income += amount;
      else expense += amount;
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [filtered]);

  useEffect(() => {
    if (!highlightId) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`tx-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);

    return () => clearTimeout(timer);
  }, [highlightId, filtered.length]);

  function resetForm(nextAccountId) {
    setForm({
      id: null,
      date: todayISO(),
      type: "expense",
      accountId:
        nextAccountId ??
        String((accounts.find((a) => a.isDefault) || accounts[0] || {}).id || ""),
      category: "",
      amount: "",
      note: "",
      currency: "UAH",
    });
  }

  async function onSubmit(e) {
    e.preventDefault();

    const amount = toNumOrNull(form.amount);
    if (!form.date) {
      alert("Вкажи дату");
      return;
    }
    if (!form.accountId) {
      alert("Обери рахунок");
      return;
    }
    if (amount === null || amount <= 0) {
      alert("Сума має бути більшою за 0");
      return;
    }

    const payload = {
      accountId: form.accountId,
      type: form.type,
      amount,
      currency: form.currency || "UAH",
      category: form.category,
      note: form.note,
      date: form.date,
    };

    if (form.id) {
      await updateTx(form.id, payload);
    } else {
      await createTx(payload);
    }

    resetForm(form.accountId);
  }

  function onEdit(tx) {
    setForm({
      id: tx.id,
      date: tx.date || todayISO(),
      type: tx.type || "expense",
      accountId: String(tx.accountId || ""),
      category: tx.category || "",
      amount: String(tx.amount || ""),
      note: tx.note || "",
      currency: tx.currency || "UAH",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id) {
    const ok = window.confirm("Видалити транзакцію?");
    if (!ok) return;
    await removeTx(id);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Транзакції</h1>
        <p>Ця сторінка вже працює через серверний API, а не тільки локально.</p>
      </section>

      <section className="card">
        <h2>{form.id ? "Редагувати транзакцію" : "Додати транзакцію"}</h2>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Дата</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              disabled={saving}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Тип</span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value,
                  category: "",
                }))
              }
              disabled={saving}
            >
              <option value="expense">Витрата</option>
              <option value="income">Дохід</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Рахунок</span>
            <select
              value={form.accountId}
              onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}
              disabled={saving || accountsLoading}
            >
              <option value="">— обери рахунок —</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.isDefault ? "(основний)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Категорія</span>
            <input
              list="tx-category-suggestions"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              disabled={saving}
              placeholder="Напр. Продукти"
            />
            <datalist id="tx-category-suggestions">
              {categorySuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Сума</span>
            <input
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value.replace(",", ".") }))}
              disabled={saving}
              placeholder="Напр. 250"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Коментар</span>
            <input
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              disabled={saving}
              placeholder="Напр. кава"
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" disabled={saving || accountsLoading}>
              {form.id ? "Зберегти зміни" : "Додати"}
            </button>

            {form.id ? (
              <button
                type="button"
                onClick={() => resetForm()}
                disabled={saving}
              >
                Скасувати редагування
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => reload()}
              disabled={loading || saving}
            >
              Оновити з сервера
            </button>
          </div>
        </form>

        {accountsError ? <div style={{ color: "crimson", marginTop: 12 }}>{accountsError}</div> : null}
        {error ? <div style={{ color: "crimson", marginTop: 12 }}>{error}</div> : null}
      </section>

      <section className="card">
        <h2>Фільтри</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук: категорія / коментар / рахунок"
          />

          <select value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="all">Усі</option>
            <option value="expense">Витрати</option>
            <option value="income">Доходи</option>
          </select>

          <select value={fAccountId} onChange={(e) => setFAccountId(e.target.value)}>
            <option value="">Усі рахунки</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <input
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value.replace(",", "."))}
            placeholder="Мін. сума"
          />
          <input
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value.replace(",", "."))}
            placeholder="Макс. сума"
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFType("all");
                setFAccountId("");
                setDateFrom("");
                setDateTo("");
                setMinAmount("");
                setMaxAmount("");
              }}
            >
              Скинути
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          Доходи: {fmtMoney(totals.income)} | Витрати: {fmtMoney(totals.expense)} | Баланс: {fmtMoney(totals.balance)} | Показано: {filtered.length}
        </div>
      </section>

      <section className="card">
        <h2>Список транзакцій</h2>

        {loading ? <div>Завантаження…</div> : null}

        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((tx) => {
            const isHighlight = highlightId && String(tx.id) === String(highlightId);

            return (
              <div
                key={tx.id}
                id={`tx-${tx.id}`}
                style={{
                  border: isHighlight ? "2px solid #ffb300" : "1px solid #ddd",
                  borderRadius: 8,
                  padding: 12,
                  background: isHighlight ? "rgba(255,179,0,0.08)" : "transparent",
                }}
              >
                <div><strong>Дата:</strong> {tx.date}</div>
                <div><strong>Тип:</strong> {tx.type}</div>
                <div><strong>Рахунок:</strong> {accountNameById.get(String(tx.accountId || "")) || "—"}</div>
                <div><strong>Категорія:</strong> {tx.category || "—"}</div>
                <div><strong>Сума:</strong> {fmtMoney(tx.amount, tx.currency || "UAH")}</div>
                <div><strong>Коментар:</strong> {tx.note || "—"}</div>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => onEdit(tx)} disabled={saving}>
                    Редагувати
                  </button>
                  <button type="button" onClick={() => onDelete(tx.id)} disabled={saving}>
                    Видалити
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && !filtered.length ? <div>Транзакцій не знайдено.</div> : null}
        </div>
      </section>
    </div>
  );
}
