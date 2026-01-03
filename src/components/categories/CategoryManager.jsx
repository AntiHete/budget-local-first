import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

const TYPE_LABEL = {
  expense: "Витрати",
  income: "Доходи",
};

export default function CategoryManager() {
  const { activeProfileId } = useProfile();
  const [type, setType] = useState("expense");
  const [name, setName] = useState("");

  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.categories
      .where("profileId")
      .equals(activeProfileId)
      .toArray();
  }, [activeProfileId]);

  const grouped = useMemo(() => {
    const exp = [];
    const inc = [];
    for (const c of categories ?? []) {
      (c.type === "income" ? inc : exp).push(c);
    }
    exp.sort((a, b) => a.name.localeCompare(b.name));
    inc.sort((a, b) => a.name.localeCompare(b.name));
    return { expense: exp, income: inc };
  }, [categories]);

  async function addCategory() {
    const trimmed = name.trim();
    if (!trimmed || !activeProfileId) return;

    await db.categories.add({
      profileId: activeProfileId,
      type,
      name: trimmed,
    });

    setName("");
  }

  async function deleteCategory(catId) {
    const usedCount = await db.transactions.where("categoryId").equals(catId).count();
    if (usedCount > 0) {
      alert("Не можна видалити категорію, яка використовується в транзакціях.");
      return;
    }

    const ok = window.confirm("Видалити категорію?");
    if (!ok) return;
    await db.categories.delete(catId);
  }

  return (
    <div className="card">
      <h2>Категорії</h2>

      <div className="row">
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Витрати</option>
          <option value="income">Доходи</option>
        </select>

        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Назва категорії"
        />

        <button className="btn" type="button" onClick={addCategory} disabled={!activeProfileId}>
          Додати
        </button>
      </div>

      <div className="grid2">
        <div>
          <h3>Витрати</h3>
          <ul className="list">
            {grouped.expense.map((c) => (
              <li key={c.id} className="listItem">
                <span>{c.name}</span>
                <button className="btn btnDanger" onClick={() => deleteCategory(c.id)} type="button">
                  Видалити
                </button>
              </li>
            ))}
            {grouped.expense.length === 0 && <li className="muted">Нема категорій витрат</li>}
          </ul>
        </div>

        <div>
          <h3>Доходи</h3>
          <ul className="list">
            {grouped.income.map((c) => (
              <li key={c.id} className="listItem">
                <span>{c.name}</span>
                <button className="btn btnDanger" onClick={() => deleteCategory(c.id)} type="button">
                  Видалити
                </button>
              </li>
            ))}
            {grouped.income.length === 0 && <li className="muted">Нема категорій доходів</li>}
          </ul>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Профіль: {activeProfileId ? "активний" : "не вибрано"}
      </p>
    </div>
  );
}
