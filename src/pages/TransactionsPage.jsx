import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useSearchParams } from "react-router-dom";

import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import { todayISO } from "../services/dateService";
import { ensureDefaultAccount } from "../services/accountLocalService";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
  }).format(x ?? 0);
}

function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function TransactionsPage() {
  const { activeProfileId } = useProfile();
  const [searchParams] = useSearchParams();
  const highlightId = Number(searchParams.get("highlight") || 0) || null;

  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [q, setQ] = useState("");
  const [fType, setFType] = useState("all");
  const [fAccountId, setFAccountId] = useState("");
  const [fCategoryId, setFCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  useEffect(() => {
    if (!activeProfileId) return;
    ensureDefaultAccount(activeProfileId).catch(console.error);
  }, [activeProfileId]);

  const accounts = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const items = await db.accounts.where("profileId").equals(activeProfileId).toArray();
    items.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return items;
  }, [activeProfileId]);

  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const cats = await db.categories.where("profileId").equals(activeProfileId).toArray();
    cats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return cats;
  }, [activeProfileId]);

  const rawTx = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const txs = await db.transactions.where("profileId").equals(activeProfileId).toArray();
    txs.sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") || (b.id ?? 0) - (a.id ?? 0)
    );
    return txs;
  }, [activeProfileId]);

  const categoriesByType = useMemo(() => {
    const by = { expense: [], income: [] };
    for (const c of categories ?? []) {
      if (c.type === "income") by.income.push(c);
      else by.expense.push(c);
    }
    return by;
  }, [categories]);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const accountNameById = useMemo(() => {
    const map = new Map();
    for (const a of accounts ?? []) map.set(a.id, a.name);
    return map;
  }, [accounts]);

  useEffect(() => {
    if (!categoryId) return;
    const id = Number(categoryId);
    const cat = (categories ?? []).find((c) => c.id === id);
    if (!cat || cat.type !== type) setCategoryId("");
  }, [type, categories, categoryId]);

  useEffect(() => {
    if (!accounts?.length) {
      setAccountId("");
      return;
    }

    const exists = accounts.some((a) => String(a.id) === String(accountId));
    if (!exists) {
      const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
      setAccountId(String(defaultAccount.id));
    }
  }, [accounts, accountId]);

  const filteredTx = useMemo(() => {
    const list = rawTx ?? [];
    const qLower = q.trim().toLowerCase();
    const df = dateFrom || null;
    const dt = dateTo || null;
    const min = toNumOrNull(minAmount);
    const max = toNumOrNull(maxAmount);

    return list.filter((t) => {
      if (fType !== "all" && t.type !== fType) return false;
      if (fAccountId && String(t.accountId ?? "") !== String(fAccountId)) return false;
      if (fCategoryId) {
        const cid = Number(fCategoryId);
        if ((t.categoryId ?? null) !== cid) return false;
      }
      if (df && (t.date || "") < df) return false;
      if (dt && (t.date || "") > dt) return false;
      if (min !== null && (t.amount ?? 0) < min) return false;
      if (max !== null && (t.amount ?? 0) > max) return false;

      if (qLower) {
        const hay = `${t.note ?? ""} ${categoryNameById.get(t.categoryId) ?? ""} ${accountNameById.get(t.accountId) ?? ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }

      return true;
    });
  }, [
    rawTx,
    q,
    fType,
    fAccountId,
    fCategoryId,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    categoryNameById,
    accountNameById,
  ]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`tx-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightId, filteredTx.length]);

  async function addTransaction() {
    if (!activeProfileId) return;
    if (!accountId) return alert("Спочатку створи або обери рахунок");

    const num = Number(String(amount).replace(",", "."));
    if (!date) return alert("Вкажи дату");
    if (!Number.isFinite(num) || num <= 0) return alert("Сума має бути > 0");

    const now = new Date().toISOString();

    await db.transactions.add({
      profileId: activeProfileId,
      accountId: Number(accountId),
      date,
      type,
      categoryId: categoryId ? Number(categoryId) : null,
      amount: num,
      note: note.trim() || null,
      createdAt: now,
    });

    setAmount("");
    setNote("");
  }

  async function removeTransaction(id) {
    const ok = window.confirm("Видалити транзакцію?");
    if (!ok) return;
    await db.transactions.delete(id);
  }

  const totalIncome = useMemo(
    () =>
      (filteredTx ?? [])
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + (t.amount ?? 0), 0),
    [filteredTx]
  );

  const totalExpense = useMemo(
    () =>
      (filteredTx ?? [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + (t.amount ?? 0), 0),
    [filteredTx]
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Транзакції</h1>
      </section>

      <section className="card">
        <h2>Додати транзакцію</h2>

        {!accounts?.length ? (
          <p>
            Немає рахунків. <Link to="/accounts">Створи рахунок</Link>.
          </p>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Дата</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Тип</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="expense">Витрата</option>
              <option value="income">Дохід</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Рахунок</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— обери рахунок —</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.isDefault ? "(основний)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Категорія (опц.)</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— без категорії —</option>
              {(categoriesByType[type] ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Сума</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              placeholder="Напр. 250"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Коментар</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Напр. кава"
            />
          </label>

          <div>
            <button onClick={addTransaction}>Додати</button>
          </div>
        </div>
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
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select value={fCategoryId} onChange={(e) => setFCategoryId(e.target.value)}>
            <option value="">Усі категорії</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.type === "expense" ? "Витрата" : "Дохід"} · {c.name}
              </option>
            ))}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <input value={minAmount} onChange={(e) => setMinAmount(e.target.value.replace(",", "."))} placeholder="Мін. сума" />
          <input value={maxAmount} onChange={(e) => setMaxAmount(e.target.value.replace(",", "."))} placeholder="Макс. сума" />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setQ("");
                setFType("all");
                setFAccountId("");
                setFCategoryId("");
                setDateFrom("");
                setDateTo("");
                setMinAmount("");
                setMaxAmount("");
              }}
            >
              Скинути
            </button>

            {highlightId ? <span>highlight: {highlightId}</span> : null}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          Доходи: {fmtUAH(totalIncome)} | Витрати: {fmtUAH(totalExpense)} | Баланс:{" "}
          {fmtUAH(totalIncome - totalExpense)} | Показано: {filteredTx?.length ?? 0}
        </div>
      </section>

      <section className="card">
        <h2>Список</h2>

        <div style={{ display: "grid", gap: 10 }}>
          {(filteredTx ?? []).map((t) => {
            const isHi = highlightId && t.id === highlightId;

            return (
              <div
                id={`tx-${t.id}`}
                key={t.id}
                style={{
                  border: isHi ? "2px solid #ffb300" : "1px solid #ddd",
                  borderRadius: 8,
                  padding: 12,
                  background: isHi ? "rgba(255,179,0,0.08)" : "transparent",
                }}
              >
                <div><strong>Дата:</strong> {t.date}</div>
                <div><strong>Тип:</strong> {t.type}</div>
                <div><strong>Рахунок:</strong> {accountNameById.get(t.accountId) ?? "—"}</div>
                <div><strong>Категорія:</strong> {t.categoryId ? categoryNameById.get(t.categoryId) ?? "—" : "—"}</div>
                <div><strong>Сума:</strong> {fmtUAH(t.amount)}</div>
                <div><strong>Коментар:</strong> {t.note ?? ""}</div>

                <div style={{ marginTop: 10 }}>
                  <button onClick={() => removeTransaction(t.id)}>Видалити</button>
                </div>
              </div>
            );
          })}

          {!(filteredTx ?? []).length ? <div>Нема транзакцій за заданими фільтрами.</div> : null}
        </div>
      </section>
    </div>
  );
}
