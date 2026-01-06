import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

function currentMonth() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function monthBounds(month) {
  // ISO-строки порівнюються лексикографічно коректно (YYYY-MM-DD)
  return { from: `${month}-01`, to: `${month}-31` };
}

function clampPct(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

export default function BudgetManager() {
  const { activeProfileId } = useProfile();
  const [month, setMonth] = useState(currentMonth());
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const expenseCategories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const cats = await db.categories.where({ profileId: activeProfileId, type: "expense" }).toArray();
    cats.sort((a, b) => a.name.localeCompare(b.name));
    return cats;
  }, [activeProfileId]);

  const budgetsForMonth = useLiveQuery(async () => {
    if (!activeProfileId || !month) return [];
    const list = await db.budgets.where({ profileId: activeProfileId, month }).toArray();
    list.sort((a, b) => (a.categoryId ?? 0) - (b.categoryId ?? 0));
    return list;
  }, [activeProfileId, month]);

  const spentByCategory = useLiveQuery(async () => {
    if (!activeProfileId || !month) return new Map();
    const { from, to } = monthBounds(month);

    const txs = await db.transactions
      .where("profileId")
      .equals(activeProfileId)
      .and((t) => t.type === "expense" && t.date >= from && t.date <= to)
      .toArray();

    const map = new Map();
    for (const t of txs) {
      if (!t.categoryId) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + (t.amount ?? 0));
    }
    return map;
  }, [activeProfileId, month]);

  const catNameById = useMemo(() => {
    const map = new Map();
    for (const c of expenseCategories ?? []) map.set(c.id, c.name);
    return map;
  }, [expenseCategories]);

  async function upsertBudget() {
    if (!activeProfileId) return;

    const catId = Number(categoryId);
    const lim = Number(limit);
    if (!Number.isFinite(catId) || catId <= 0) return alert("Вибери категорію");
    if (!Number.isFinite(lim) || lim <= 0) return alert("Ліміт має бути числом > 0");
    if (!month) return alert("Вкажи місяць");

    const existing = await db.budgets.where({ profileId: activeProfileId, month, categoryId: catId }).first();

    if (existing?.id) {
      await db.budgets.update(existing.id, { limit: lim });
    } else {
      await db.budgets.add({ profileId: activeProfileId, month, categoryId: catId, limit: lim });
    }

    setLimit("");
  }

  async function deleteBudget(id) {
    const ok = window.confirm("Видалити бюджет?");
    if (!ok) return;
    await db.budgets.delete(id);
  }

  return (
    <div className="card">
      <h2>Бюджети (план-факт)</h2>

      <div className="grid3">
        <label className="labelCol">
          Місяць (перегляд/створення)
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>

        <label className="labelCol">
          Категорія (витрати)
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— вибери —</option>
            {(expenseCategories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="labelCol">
          Ліміт (UAH)
          <input
            className="input"
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(",", "."))}
            placeholder="Напр. 5000"
          />
        </label>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button className="btn" type="button" onClick={upsertBudget} disabled={!activeProfileId}>
            Зберегти
          </button>
        </div>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Категорія</th>
              <th>Ліміт</th>
              <th>Витрачено</th>
              <th>Статус</th>
              <th style={{ width: 220 }}>Прогрес</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(budgetsForMonth ?? []).map((b) => {
              const spent = spentByCategory?.get(b.categoryId) ?? 0;
              const pct = clampPct((spent / (b.limit || 1)) * 100);

              let status = "OK";
              if (spent >= b.limit) status = "Перевищено";
              else if (pct >= 80) status = "Майже";

              return (
                <tr key={b.id}>
                  <td>{catNameById.get(b.categoryId) ?? "—"}</td>
                  <td>{b.limit}</td>
                  <td>{Math.round(spent * 100) / 100}</td>
                  <td>
                    <span className="badge">{status}</span>
                  </td>
                  <td>
                    <div className="progress" title={`${Math.round(pct)}%`}>
                      <div className="progressFill" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btnDanger" type="button" onClick={() => deleteBudget(b.id)}>
                      Видалити
                    </button>
                  </td>
                </tr>
              );
            })}

            {(budgetsForMonth ?? []).length === 0 && (
              <tr>
                <td colSpan="6" className="muted" style={{ padding: 12 }}>
                  На цей місяць бюджетів ще немає
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        План-факт рахується по витратах поточного профілю за вибраний місяць.
      </p>
    </div>
  );
}
