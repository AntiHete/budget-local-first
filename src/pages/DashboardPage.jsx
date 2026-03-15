import React, { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import { useSyncedTransactions } from "../hooks/useSyncedTransactions";

function fmtMoney(x, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(x || 0));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isPlannedPayment(payment) {
  const status = normalizeText(payment?.status);
  return !["paid", "done", "completed", "сплачено", "виконано"].includes(status);
}

export default function DashboardPage() {
  const { activeProfileId } = useProfile();
  const { items, loading, error } = useSyncedTransactions({ activeProfileId });

  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.categories.where("profileId").equals(activeProfileId).toArray();
  }, [activeProfileId]);

  const budgets = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.budgets.where("profileId").equals(activeProfileId).toArray();
  }, [activeProfileId]);

  const payments = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.payments.where("profileId").equals(activeProfileId).toArray();
  }, [activeProfileId]);

  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const monthTx = useMemo(() => {
    return (items || []).filter((tx) => String(tx.date || "").slice(0, 7) === month);
  }, [items, month]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of monthTx) {
      const amount = Number(tx.amount || 0);
      if (tx.type === "income") income += amount;
      else expense += amount;
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [monthTx]);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    for (const category of categories || []) {
      map.set(Number(category.id), category.name);
    }
    return map;
  }, [categories]);

  const budgetsAtRisk = useMemo(() => {
    const currentBudgets = (budgets || []).filter((item) => item.month === month);

    const rows = currentBudgets.map((budget) => {
      const categoryName = categoryNameById.get(Number(budget.categoryId)) || `Категорія #${budget.categoryId}`;

      const spent = monthTx
        .filter((tx) => tx.type === "expense")
        .filter((tx) => normalizeText(tx.category) === normalizeText(categoryName))
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const limit = Number(budget.limit || 0);
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

      return {
        id: budget.id,
        categoryName,
        spent,
        limit,
        percent,
      };
    });

    return rows
      .filter((row) => row.limit > 0 && row.percent >= 80)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);
  }, [budgets, month, monthTx, categoryNameById]);

  const upcomingPayments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return (payments || [])
      .filter(isPlannedPayment)
      .filter((payment) => String(payment.dueDate || "") >= today)
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")))
      .slice(0, 5);
  }, [payments]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Дашборд</h1>
        <p>Зведення нижче вже рахується із серверних транзакцій активного профілю.</p>
        {loading ? <div className="mutedText">Оновлення даних…</div> : null}
        {error ? <div className="inlineError">{error}</div> : null}
      </section>

      <section className="statsGrid">
        <article className="card">
          <h2>Зведення за місяць</h2>
          <div className="statsGrid">
            <div className="statCard">
              <div className="statLabel">Доходи</div>
              <div className="statValue">{fmtMoney(summary.income)}</div>
            </div>

            <div className="statCard">
              <div className="statLabel">Витрати</div>
              <div className="statValue">{fmtMoney(summary.expense)}</div>
            </div>

            <div className="statCard">
              <div className="statLabel">Баланс</div>
              <div className="statValue">{fmtMoney(summary.balance)}</div>
            </div>

            <div className="statCard">
              <div className="statLabel">Місяць</div>
              <div className="statValue">{month}</div>
            </div>
          </div>
        </article>

        <article className="card">
          <h2>Бюджети “на межі”</h2>

          {!budgetsAtRisk.length ? (
            <div className="emptyState">Немає бюджетів на межі або перевищень у цьому місяці.</div>
          ) : (
            <div className="listGrid">
              {budgetsAtRisk.map((row) => (
                <div key={row.id} className="budgetCard">
                  <div className="budgetCardTop">
                    <h3>{row.categoryName}</h3>
                    <span className={row.percent > 100 ? "badge badgeDanger" : "badge badgeWarn"}>
                      {row.percent}%
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
                      <strong>{fmtMoney(row.limit - row.spent)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="card">
        <h2>Найближчі платежі</h2>

        {!upcomingPayments.length ? (
          <div className="emptyState">Немає запланованих платежів.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Назва</th>
                <th>Категорія</th>
                <th>Сума</th>
              </tr>
            </thead>
            <tbody>
              {upcomingPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.dueDate}</td>
                  <td>{payment.title || "—"}</td>
                  <td>{payment.categoryId ? `#${payment.categoryId}` : "—"}</td>
                  <td>{fmtMoney(payment.amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
