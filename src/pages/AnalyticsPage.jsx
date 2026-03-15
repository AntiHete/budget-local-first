import React, { useMemo, useState } from "react";

import { useProfile } from "../context/ProfileContext";
import { useSyncedTransactions } from "../hooks/useSyncedTransactions";

function fmtMoney(x, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(Number(x || 0));
}

function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default function AnalyticsPage() {
  const { activeProfileId } = useProfile();
  const { items, loading, error } = useSyncedTransactions({ activeProfileId });

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const monthTx = useMemo(() => {
    return (items || []).filter((tx) => String(tx.date || "").slice(0, 7) === month);
  }, [items, month]);

  const expenseByCategory = useMemo(() => {
    const map = new Map();

    for (const tx of monthTx) {
      if (tx.type !== "expense") continue;
      const key = tx.category || "Без категорії";
      map.set(key, (map.get(key) || 0) + Number(tx.amount || 0));
    }

    const rows = [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const total = rows.reduce((sum, row) => sum + row.amount, 0);

    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.amount / total) * 100) : 0,
    }));
  }, [monthTx]);

  const dailyRows = useMemo(() => {
    const count = daysInMonth(month);
    const rows = [];

    for (let day = 1; day <= count; day += 1) {
      const date = `${month}-${String(day).padStart(2, "0")}`;

      const dayTx = monthTx.filter((tx) => tx.date === date);

      const income = dayTx
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const expense = dayTx
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      rows.push({
        date,
        income,
        expense,
      });
    }

    return rows;
  }, [month, monthTx]);

  const totals = useMemo(() => {
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

  const topExpense = expenseByCategory[0] || null;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Аналітика</h1>
        <div className="formGrid twoCols">
          <label className="field">
            <span>Місяць</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>

          <div className="field">
            <span>Поточне зведення</span>
            <div className="badge">Витрати за місяць: {fmtMoney(totals.expense)}</div>
          </div>
        </div>

        <p>Аналітика нижче тепер береться із серверних транзакцій активного профілю.</p>
        {loading ? <div className="mutedText">Оновлення даних…</div> : null}
        {error ? <div className="inlineError">{error}</div> : null}
      </section>

      <section className="statsGrid">
        <article className="statCard">
          <div className="statLabel">Доходи</div>
          <div className="statValue">{fmtMoney(totals.income)}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Витрати</div>
          <div className="statValue">{fmtMoney(totals.expense)}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Баланс</div>
          <div className="statValue">{fmtMoney(totals.balance)}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Найбільша категорія витрат</div>
          <div className="statValue">
            {topExpense ? `${topExpense.category} · ${fmtMoney(topExpense.amount)}` : "—"}
          </div>
        </article>
      </section>

      <section className="card">
        <h2>Структура витрат за категоріями</h2>

        {!expenseByCategory.length ? (
          <div className="emptyState">Немає витрат за категоріями за цей період.</div>
        ) : (
          <div className="listGrid">
            {expenseByCategory.map((row) => (
              <article key={row.category} className="budgetCard">
                <div className="budgetCardTop">
                  <h3>{row.category}</h3>
                  <span className="badge">{row.percent}%</span>
                </div>

                <div className="budgetNumbers">
                  <div>
                    <span className="mutedText">Сума</span>
                    <strong>{fmtMoney(row.amount)}</strong>
                  </div>
                  <div>
                    <span className="mutedText">Частка</span>
                    <strong>{row.percent}%</strong>
                  </div>
                </div>

                <div className="progressBar">
                  <div className="progressFill" style={{ width: `${Math.max(4, row.percent)}%` }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Доходи/витрати по днях (місяць)</h2>

        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Доходи</th>
              <th>Витрати</th>
              <th>Баланс дня</th>
            </tr>
          </thead>
          <tbody>
            {dailyRows.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{fmtMoney(row.income)}</td>
                <td>{fmtMoney(row.expense)}</td>
                <td>{fmtMoney(row.income - row.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
