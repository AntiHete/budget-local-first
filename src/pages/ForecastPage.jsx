import React, { useMemo, useState } from "react";
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

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export default function ForecastPage() {
  const { activeProfileId } = useProfile();
  const { items, loading, error } = useSyncedTransactions({ activeProfileId });

  const accounts = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.accounts.where("profileId").equals(activeProfileId).toArray();
  }, [activeProfileId]);

  const payments = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.payments.where("profileId").equals(activeProfileId).toArray();
  }, [activeProfileId]);

  const [baseMonth, setBaseMonth] = useState(new Date().toISOString().slice(0, 7));
  const [scenarioEnabled, setScenarioEnabled] = useState(false);
  const [extraMonthlyExpense, setExtraMonthlyExpense] = useState("");

  const prevMonths = useMemo(
    () => [shiftMonth(baseMonth, -3), shiftMonth(baseMonth, -2), shiftMonth(baseMonth, -1)],
    [baseMonth]
  );

  const forecastMonth = useMemo(() => shiftMonth(baseMonth, 1), [baseMonth]);

  const categoryForecast = useMemo(() => {
    const categories = new Map();

    for (const tx of items || []) {
      if (tx.type !== "expense") continue;

      const month = String(tx.date || "").slice(0, 7);
      if (!prevMonths.includes(month)) continue;

      const key = tx.category || "Без категорії";

      if (!categories.has(key)) {
        categories.set(key, { category: key, values: new Map() });
      }

      const row = categories.get(key);
      row.values.set(month, (row.values.get(month) || 0) + Number(tx.amount || 0));
    }

    return [...categories.values()]
      .map((row) => {
        const m1 = row.values.get(prevMonths[0]) || 0;
        const m2 = row.values.get(prevMonths[1]) || 0;
        const m3 = row.values.get(prevMonths[2]) || 0;
        const avg = (m1 + m2 + m3) / 3;

        return {
          category: row.category,
          m1,
          m2,
          m3,
          avg,
          forecast: avg,
        };
      })
      .sort((a, b) => b.forecast - a.forecast);
  }, [items, prevMonths]);

  const averageMonthlyIncome = useMemo(() => {
    let sums = prevMonths.map(() => 0);

    for (const tx of items || []) {
      if (tx.type !== "income") continue;
      const month = String(tx.date || "").slice(0, 7);

      const idx = prevMonths.indexOf(month);
      if (idx >= 0) sums[idx] += Number(tx.amount || 0);
    }

    return (sums[0] + sums[1] + sums[2]) / 3;
  }, [items, prevMonths]);

  const averageMonthlyExpense = useMemo(() => {
    return categoryForecast.reduce((sum, row) => sum + row.forecast, 0);
  }, [categoryForecast]);

  const currentBalance = useMemo(() => {
    const opening = (accounts || []).reduce(
      (sum, account) => sum + Number(account.openingBalance || 0),
      0
    );

    const netTx = (items || []).reduce((sum, tx) => {
      const amount = Number(tx.amount || 0);
      return tx.type === "income" ? sum + amount : sum - amount;
    }, 0);

    return opening + netTx;
  }, [accounts, items]);

  const detailRows = useMemo(() => {
    const rows = [];
    const extra = Number(String(extraMonthlyExpense || "").replace(",", ".")) || 0;
    const dailyIncome = averageMonthlyIncome / 30;
    const dailyExpense =
      (averageMonthlyExpense + (scenarioEnabled ? extra : 0)) / 30;

    let balance = currentBalance;

    for (let i = 0; i < 30; i += 1) {
      const dateObj = new Date();
      dateObj.setHours(0, 0, 0, 0);
      dateObj.setDate(dateObj.getDate() + i);

      const date = dateObj.toISOString().slice(0, 10);

      const plannedPayments = (payments || [])
        .filter((p) => String(p.dueDate || "") === date)
        .filter((p) => {
          const status = normalizeStatus(p.status);
          return !["paid", "done", "completed", "сплачено", "виконано"].includes(status);
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      balance = balance + dailyIncome - dailyExpense - plannedPayments;

      rows.push({
        date,
        income: dailyIncome,
        expense: dailyExpense,
        plannedPayments,
        balance,
      });
    }

    return rows;
  }, [
    averageMonthlyIncome,
    averageMonthlyExpense,
    currentBalance,
    payments,
    scenarioEnabled,
    extraMonthlyExpense,
  ]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Прогноз</h1>

        <div className="formGrid twoCols">
          <label className="field">
            <span>Базовий місяць</span>
            <input
              type="month"
              value={baseMonth}
              onChange={(e) => setBaseMonth(e.target.value)}
            />
          </label>

          <div className="field">
            <span>Профіль</span>
            <div className="badge">{activeProfileId ? "Активний профіль підключено" : "Немає профілю"}</div>
          </div>
        </div>

        <p>
          Прогноз тепер базується на серверних транзакціях, а планові платежі
          додаються з локальних нагадувань.
        </p>

        {loading ? <div className="mutedText">Оновлення даних…</div> : null}
        {error ? <div className="inlineError">{error}</div> : null}
      </section>

      <section className="card">
        <h2>Сценарій “Що буде, якщо…”</h2>

        <div className="formGrid twoCols">
          <label className="field" style={{ alignContent: "end" }}>
            <span>Увімкнення сценарію</span>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={scenarioEnabled}
                onChange={(e) => setScenarioEnabled(e.target.checked)}
                style={{ width: "auto" }}
              />
              <span>Додати додаткові щомісячні витрати до прогнозу</span>
            </label>
          </label>

          <label className="field">
            <span>Додаткові щомісячні витрати</span>
            <input
              value={extraMonthlyExpense}
              onChange={(e) => setExtraMonthlyExpense(e.target.value.replace(",", "."))}
              placeholder="Напр. 1500"
              disabled={!scenarioEnabled}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Прогноз витрат по категоріях</h2>
        <p>
          Метод: середнє за останні 3 місяці ({prevMonths.join(", ")}) →
          прогноз на {forecastMonth}.
        </p>

        {!categoryForecast.length ? (
          <div className="emptyState">Немає витрат з категоріями за останні 3 місяці.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Категорія</th>
                <th>{prevMonths[0]}</th>
                <th>{prevMonths[1]}</th>
                <th>{prevMonths[2]}</th>
                <th>Середнє</th>
                <th>Прогноз ({forecastMonth})</th>
              </tr>
            </thead>
            <tbody>
              {categoryForecast.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{fmtMoney(row.m1)}</td>
                  <td>{fmtMoney(row.m2)}</td>
                  <td>{fmtMoney(row.m3)}</td>
                  <td>{fmtMoney(row.avg)}</td>
                  <td>{fmtMoney(row.forecast)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="statsGrid">
        <article className="statCard">
          <div className="statLabel">Середній дохід / міс.</div>
          <div className="statValue">{fmtMoney(averageMonthlyIncome)}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Середні витрати / міс.</div>
          <div className="statValue">
            {fmtMoney(
              averageMonthlyExpense +
                (scenarioEnabled
                  ? Number(String(extraMonthlyExpense || "").replace(",", ".")) || 0
                  : 0)
            )}
          </div>
        </article>

        <article className="statCard">
          <div className="statLabel">Поточний баланс</div>
          <div className="statValue">{fmtMoney(currentBalance)}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Прогнозний місяць</div>
          <div className="statValue">{monthTitle(forecastMonth)}</div>
        </article>
      </section>

      <section className="card">
        <h2>Деталі по днях</h2>

        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>+ Доходи</th>
              <th>- Витрати</th>
              <th>- Планові платежі</th>
              <th>Баланс</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{fmtMoney(row.income)}</td>
                <td>{fmtMoney(row.expense)}</td>
                <td>{fmtMoney(row.plannedPayments)}</td>
                <td>{fmtMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
