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

  const budgets = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const all = await db.budgets.where("profileId").equals(activeProfileId).toArray();
    all.sort((a, b) => (b.month || "").localeCompare(a.month || ""));
    return all;
  }, [activeProfileId]);

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

    // якщо бюджет для цього (profileId, month, categoryId) вже є — оновимо
    const existing = await db.budgets
      .where({ profileId: activeProfileId, month, categoryId: catId })
      .first();

    if (existing?.id) {
      await db.budgets.update(existing.id, { limit: lim });
    } else {
      await db.budgets.add({
        profileId: activeProfileId,
        month,
        categoryId: catId,
        limit: lim,
      });
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
      <h2>Бюджети (по категоріях)</h2>

      <div className="grid3">
        <label className="labelCol">
          Місяць
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
              <th>Місяць</th>
              <th>Категорія</th>
              <th>Ліміт</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(budgets ?? []).map((b) => (
              <tr key={b.id}>
                <td>{b.month}</td>
                <td>{catNameById.get(b.categoryId) ?? "—"}</td>
                <td>{b.limit}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btnDanger" type="button" onClick={() => deleteBudget(b.id)}>
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
            {(budgets ?? []).length === 0 && (
              <tr>
                <td colSpan="4" className="muted" style={{ padding: 12 }}>
                  Поки немає бюджетів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
