import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "react-router-dom";
import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import { todayISO } from "../services/dateService";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x ?? 0);
}

function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function TransactionsPage() {
  const { activeProfileId } = useProfile();
  const [searchParams] = useSearchParams();
  const highlightId = Number(searchParams.get("highlight") || 0) || null;

  // ---------- Add form ----------
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState("expense"); // expense | income
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // ---------- Filters ----------
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("all"); // all | expense | income
  const [fCategoryId, setFCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // ---------- Categories ----------
  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const cats = await db.categories.where("profileId").equals(activeProfileId).toArray();
    cats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return cats;
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

  // Keep category selection valid when changing type
  useEffect(() => {
    if (!categoryId) return;
    const id = Number(categoryId);
    const cat = (categories ?? []).find((c) => c.id === id);
    if (!cat || cat.type !== type) setCategoryId("");
  }, [type, categories, categoryId]);

  // ---------- Transactions ----------
  const rawTx = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const txs = await db.transactions.where("profileId").equals(activeProfileId).toArray();
    // sort newest first
    txs.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id ?? 0) - (a.id ?? 0));
    return txs;
  }, [activeProfileId]);

  const filteredTx = useMemo(() => {
    const list = rawTx ?? [];
    const qLower = q.trim().toLowerCase();

    const df = dateFrom || null;
    const dt = dateTo || null;
    const min = toNumOrNull(minAmount);
    const max = toNumOrNull(maxAmount);

    return list.filter((t) => {
      if (fType !== "all" && t.type !== fType) return false;

      if (fCategoryId) {
        const cid = Number(fCategoryId);
        if ((t.categoryId ?? null) !== cid) return false;
      }

      if (df && (t.date || "") < df) return false;
      if (dt && (t.date || "") > dt) return false;

      if (min !== null && (t.amount ?? 0) < min) return false;
      if (max !== null && (t.amount ?? 0) > max) return false;

      if (qLower) {
        const hay = `${t.note ?? ""} ${categoryNameById.get(t.categoryId) ?? ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }

      return true;
    });
  }, [rawTx, q, fType, fCategoryId, dateFrom, dateTo, minAmount, maxAmount, categoryNameById]);

  // ---------- Highlight scroll ----------
  useEffect(() => {
    if (!highlightId) return;
    // scroll after render
    const timer = setTimeout(() => {
      const el = document.getElementById(`tx-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightId, filteredTx.length]);

  // ---------- Actions ----------
  async function addTransaction() {
    if (!activeProfileId) return;

    const num = Number(String(amount).replace(",", "."));
    if (!date) return alert("Вкажи дату");
    if (!Number.isFinite(num) || num <= 0) return alert("Сума має бути > 0");

    const now = new Date().toISOString();

    await db.transactions.add({
      profileId: activeProfileId,
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

  const totalIncome = useMemo(() => {
    return (filteredTx ?? []).filter((t) => t.type === "income").reduce((s, t) => s + (t.amount ?? 0), 0);
  }, [filteredTx]);

  const totalExpense = useMemo(() => {
    return (filteredTx ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount ?? 0), 0);
  }, [filteredTx]);

  return (
    <>
      <h1>Транзакції</h1>

      {/* Add */}
      <div className="card">
        <h2>Додати транзакцію</h2>

        <div className="grid3">
          <label className="labelCol">
            Дата
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="labelCol">
            Тип
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="expense">Витрата</option>
              <option value="income">Дохід</option>
            </select>
          </label>

          <label className="labelCol">
            Категорія (опц.)
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— без категорії —</option>
              {(categoriesByType[type] ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="labelCol">
            Сума
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              placeholder="Напр. 250"
            />
          </label>

          <label className="labelCol" style={{ gridColumn: "span 2" }}>
            Коментар (пошук теж по ньому)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Напр. кава" />
          </label>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn" type="button" onClick={addTransaction} disabled={!activeProfileId}>
              Додати
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h2>Фільтри</h2>

        <div className="grid3">
          <label className="labelCol">
            Пошук (категорія/коментар)
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Напр. продукти" />
          </label>

          <label className="labelCol">
            Тип
            <select className="select" value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="all">Усі</option>
              <option value="expense">Витрати</option>
              <option value="income">Доходи</option>
            </select>
          </label>

          <label className="labelCol">
            Категорія
            <select className="select" value={fCategoryId} onChange={(e) => setFCategoryId(e.target.value)}>
              <option value="">Усі</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === "expense" ? "Витрата" : "Дохід"} · {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="labelCol">
            Дата від
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label className="labelCol">
            Дата до
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>

          <label className="labelCol">
            Мін. сума
            <input className="input" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value.replace(",", "."))} />
          </label>

          <label className="labelCol">
            Макс. сума
            <input className="input" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value.replace(",", "."))} />
          </label>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setQ("");
                setFType("all");
                setFCategoryId("");
                setDateFrom("");
                setDateTo("");
                setMinAmount("");
                setMaxAmount("");
              }}
            >
              Скинути
            </button>

            {highlightId && (
              <span className="badge">highlight: {highlightId}</span>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          <span className="badge">Доходи: {fmtUAH(totalIncome)}</span>
          <span className="badge">Витрати: {fmtUAH(totalExpense)}</span>
          <span className="badge">Баланс: {fmtUAH(totalIncome - totalExpense)}</span>
          <span className="muted">Показано: {(filteredTx ?? []).length}</span>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <h2>Список</h2>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Категорія</th>
                <th>Сума</th>
                <th>Коментар</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {(filteredTx ?? []).map((t) => {
                const isHi = highlightId && t.id === highlightId;
                return (
                  <tr
                    key={t.id}
                    id={`tx-${t.id}`}
                    style={isHi ? { outline: "2px solid #f59e0b", outlineOffset: "-2px" } : undefined}
                    title={isHi ? "Highlighted" : undefined}
                  >
                    <td>{t.date}</td>
                    <td>
                      <span className="badge">{t.type}</span>
                    </td>
                    <td>{t.categoryId ? (categoryNameById.get(t.categoryId) ?? "—") : "—"}</td>
                    <td>{fmtUAH(t.amount)}</td>
                    <td>{t.note ?? ""}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btnDanger" type="button" onClick={() => removeTransaction(t.id)}>
                        Видалити
                      </button>
                    </td>
                  </tr>
                );
              })}

              {(filteredTx ?? []).length === 0 && (
                <tr>
                  <td colSpan="6" className="muted" style={{ padding: 12 }}>
                    Нема транзакцій за заданими фільтрами
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          {/* Підсвітка: відкрий <code>/transactions?highlight=ID</code>. */}
        </p>
      </div>
    </>
  );
}
