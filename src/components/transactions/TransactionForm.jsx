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

export default function TransactionForm() {
  const { activeProfileId } = useProfile();

  const [type, setType] = useState("expense");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.categories.where({ profileId: activeProfileId, type }).toArray();
  }, [activeProfileId, type]);

  const categoryOptions = useMemo(() => (categories ?? []).sort((a, b) => a.name.localeCompare(b.name)), [categories]);

  async function addTx() {
    if (!activeProfileId) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      alert("Сума має бути числом > 0");
      return;
    }
    if (!date) {
      alert("Вкажи дату");
      return;
    }

    const catId = categoryId ? Number(categoryId) : null;

    await db.transactions.add({
      profileId: activeProfileId,
      type,
      date,
      categoryId: catId,
      amount: num,
      note: note.trim() || null,
      createdAt: new Date().toISOString(),
    });

    setAmount("");
    setNote("");
  }

  return (
    <div className="card">
      <h2>Додати транзакцію</h2>

      <div className="grid3">
        <label className="labelCol">
          Тип
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Витрата</option>
            <option value="income">Дохід</option>
          </select>
        </label>

        <label className="labelCol">
          Дата
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="labelCol">
          Категорія
          <select
            className="select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— без категорії —</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
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
            placeholder="Напр. 250.50"
          />
        </label>

        <label className="labelCol" style={{ gridColumn: "span 2" }}>
          Нотатка (опц.)
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Коментар" />
        </label>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button className="btn" type="button" onClick={addTx} disabled={!activeProfileId}>
            Додати
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Порада: спочатку створи категорії для витрат/доходів.
      </p>
    </div>
  );
}
