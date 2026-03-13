import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import { listTransactions } from "../api/transactions";

function monthLabel(month) {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${m}.${y}`;
}

function fmtMoney(x, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(x || 0));
}

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

export default function BudgetsPage() {
  const { activeProfileId } = useProfile();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");
  const [serverTransactions, setServerTransactions] = useState([]);

  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const rows = await db.categories.where("profileId").equals(activeProfileId).toArray();
    return rows
      .filter((row) => row.type === "expense")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [activeProfileId]);

  const budgets = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const rows = await db.budgets.where("profileId").equals(activeProfileId).toArray();
    return rows.sort((a, b) => {
      if (a.month !== b.month) return String(b.month).localeCompare(String(a.month));
      return Number(a.categoryId || 0) - Number(b.categoryId || 0);
    });
  }, [activeProfileId]);

  async function refreshTransactions() {
    if (!activeProfileId) {
      setServerTransactions([]);
      return;
    }

    setTxLoading(true);
    setTxError("");

    try {
      const data = await listTransactions({ limit: 500 });
      setServerTransactions(data?.transactions || []);
    } catch (e) {
      setTxError(String(e?.message ?? e));
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    refreshTransactions();
  }, [activeProfileId]);

  const categoriesById = useMemo(() => {
    const map = new Map();
    for (const category of categories || []) {
      map.set(Number(category.id), category);
    }
    return map;
  }, [categories]);

  const budgetsForMonth = useMemo(() => {
    return (budgets || []).filter((item) => item.month === month);
  }, [budgets, month]);

  const budgetRows = useMemo(() => {
    return budgetsForMonth.map((budget) => {
      const category = categoriesById.get(Number(budget.categoryId));
      const categoryName = category?.name || `Категорія #${budget.categoryId}`;

      const spent = (serverTransactions || [])
        .filter((tx) => String(tx.occurredAt || "").slice(0, 7) === month)
        .filter((tx) => normalize(tx.direction) === "expense")
        .filter((tx) => normalize(tx.category) === normalize(categoryName))
        .reduce((sum, tx) => sum + Number(tx.amountCents || 0) / 100, 0);

      const limitValue = Number(budget.limit || 0);
      const remaining = limitValue - spent;
      const percent = limitValue > 0 ? Math.round((spent / limitValue) * 100) : 0;

      let tone = "ok";
      if (spent > limitValue) tone = "over";
      else if (percent >= 80) tone = "warn";

      return {
        id: budget.id,
        month: budget.month,
        categoryId: budget.categoryId,
        categoryName,
        limit: limitValue,
        spent,
        remaining,
        percent,
        tone,
      };
    });
  }, [budgetsForMonth, categoriesById, serverTransactions, month]);

  async function handleSaveBudget(e) {
    e.preventDefault();

    if (!activeProfileId) return;
    if (!categoryId) {
      alert("Оберіть категорію");
      return;
    }

    const limitValue = Number(String(limit).replace(",", "."));
    if (!Number.isFinite(limitValue) || limitValue <= 0) {
      alert("Ліміт має бути більшим за 0");
      return;
    }

    const existing = (budgets || []).find(
      (item) =>
        item.profileId === activeProfileId &&
        item.month === month &&
        Number(item.categoryId) === Number(categoryId)
    );

    if (existing) {
      await db.budgets.update(existing.id, {
        limit: limitValue,
      });
    } else {
      await db.budgets.add({
        profileId: activeProfileId,
        month,
        categoryId: Number(categoryId),
        limit: limitValue,
      });
    }

    setCategoryId("");
    setLimit("");
  }

  async function handleDeleteBudget(id) {
    const ok = window.confirm("Видалити бюджет?");
    if (!ok) return;
    await db.budgets.delete(id);
  }

  const totalLimit = budgetRows.reduce((sum, row) => sum + row.limit, 0);
  const totalSpent = budgetRows.reduce((sum, row) => sum + row.spent, 0);
  const totalRemaining = totalLimit - totalSpent;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Бюджети</h1>
        <p>
          На цій сторінці задається місячний ліміт по категоріях витрат. Витрати
          підтягуються з серверних транзакцій активного профілю.
        </p>
      </section>

      <section className="card">
        <h2>Додати / оновити бюджет</h2>

        <form onSubmit={handleSaveBudget} className="formGrid twoCols">
          <label className="field">
            <span>Місяць</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Категорія витрат</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— оберіть категорію —</option>
              {(categories || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Ліміт</span>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(",", "."))}
              placeholder="Напр. 5000"
            />
          </label>

          <div className="field fieldActions">
            <button type="submit" disabled={!categoryId || !limit.trim()}>
              Зберегти бюджет
            </button>

            <button type="button" onClick={refreshTransactions} disabled={txLoading}>
              Оновити витрати з сервера
            </button>
          </div>
        </form>

        {txError ? <div className="inlineError">{txError}</div> : null}

        {!categories?.length ? (
          <div className="mutedText" style={{ marginTop: 12 }}>
            Немає локальних категорій витрат. Якщо потрібно, додай хоча б одну категорію.
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Зведення за місяць</h2>

        <div className="statsGrid">
          <div className="statCard">
            <div className="statLabel">Місяць</div>
            <div className="statValue">{monthLabel(month)}</div>
          </div>

          <div className="statCard">
            <div className="statLabel">Ліміти</div>
            <div className="statValue">{fmtMoney(totalLimit)}</div>
          </div>

          <div className="statCard">
            <div className="statLabel">Витрачено</div>
            <div className="statValue">{fmtMoney(totalSpent)}</div>
          </div>

          <div className="statCard">
            <div className="statLabel">Залишок</div>
            <div className="statValue">{fmtMoney(totalRemaining)}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Список бюджетів</h2>
            <p className="mutedText">
              {txLoading ? "Оновлення транзакцій..." : "Порівняння лімітів і фактичних витрат"}
            </p>
          </div>
        </div>

        {!budgetRows.length ? (
          <div className="emptyState">
            Для місяця <strong>{monthLabel(month)}</strong> ще немає бюджетів.
          </div>
        ) : (
          <div className="listGrid">
            {budgetRows.map((row) => (
              <article key={row.id} className="budgetCard">
                <div className="budgetCardTop">
                  <div>
                    <h3>{row.categoryName}</h3>
                    <div className="mutedText">{monthLabel(row.month)}</div>
                  </div>

                  <span
                    className={
                      row.tone === "over"
                        ? "badge badgeDanger"
                        : row.tone === "warn"
                        ? "badge badgeWarn"
                        : "badge"
                    }
                  >
                    {row.percent}% використано
                  </span>
                </div>

                <div className="budgetNumbers">
                  <div>
                    <span className="mutedText">Ліміт</span>
                    <strong>{fmtMoney(row.limit)}</strong>
                  </div>
                  <div>
                    <span className="mutedText">Витрачено</span>
                    <strong>{fmtMoney(row.spent)}</strong>
                  </div>
                  <div>
                    <span className="mutedText">Залишок</span>
                    <strong>{fmtMoney(row.remaining)}</strong>
                  </div>
                </div>

                <div className="progressBar">
                  <div
                    className={
                      row.tone === "over"
                        ? "progressFill progressFillDanger"
                        : row.tone === "warn"
                        ? "progressFill progressFillWarn"
                        : "progressFill"
                    }
                    style={{ width: `${Math.max(4, Math.min(row.percent, 100))}%` }}
                  />
                </div>

                <div className="rowActions">
                  <button type="button" onClick={() => handleDeleteBudget(row.id)}>
                    Видалити
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
