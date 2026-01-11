import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PaymentForm() {
  const { activeProfileId } = useProfile();

  const [dueDate, setDueDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const expenseCategories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const cats = await db.categories.where({ profileId: activeProfileId, type: "expense" }).toArray();
    cats.sort((a, b) => a.name.localeCompare(b.name));
    return cats;
  }, [activeProfileId]);

  const options = useMemo(() => expenseCategories ?? [], [expenseCategories]);

  async function addPayment() {
    if (!activeProfileId) return;

    const t = title.trim();
    const num = Number(amount);
    if (!t) return alert("Введи назву платежу");
    if (!dueDate) return alert("Вкажи дату");
    if (!Number.isFinite(num) || num <= 0) return alert("Сума має бути числом > 0");

    await db.payments.add({
      profileId: activeProfileId,
      dueDate,
      title: t,
      amount: num,
      categoryId: categoryId ? Number(categoryId) : null,
      status: "planned",
      createdAt: new Date().toISOString(),
    });

    setTitle("");
    setAmount("");
    setCategoryId("");
  }

  return (
    <div className="card">
      <h2>Додати платіж (нагадування)</h2>

      <div className="grid3">
        <label className="labelCol">
          Дата платежу
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <label className="labelCol">
          Назва
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Напр. Інтернет" />
        </label>

        <label className="labelCol">
          Сума (UAH)
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            placeholder="Напр. 350"
          />
        </label>

        <label className="labelCol">
          Категорія (опц.)
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— не вибрано —</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button className="btn" type="button" onClick={addPayment} disabled={!activeProfileId}>
            Додати
          </button>
        </div>
      </div>
    </div>
  );
}
