import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../../context/ProfileContext";
import { db } from "../../db/db";
import { addDebtPayment, deleteDebtPayment, getDebtPayments, recalcDebtStatus } from "../../services/debtService";
import { todayISO } from "../../services/dateService";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function DebtDetails({ debtId, onClose }) {
  const { activeProfileId } = useProfile();

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [createTx, setCreateTx] = useState(true);
  const [txCategoryId, setTxCategoryId] = useState("");

  const debt = useLiveQuery(async () => {
    if (!activeProfileId || !debtId) return null;
    const d = await db.debts.get(debtId);
    if (!d || d.profileId !== activeProfileId) return null;
    return d;
  }, [activeProfileId, debtId]);

  const payments = useLiveQuery(async () => {
    if (!activeProfileId || !debtId) return [];
    return getDebtPayments(activeProfileId, debtId);
  }, [activeProfileId, debtId]);

  // Категорії для транзакції — залежно від напрямку
  const txCategories = useLiveQuery(async () => {
    if (!activeProfileId || !debt) return [];
    const needType = debt.direction === "i_owe" ? "expense" : "income";
    const cats = await db.categories.where({ profileId: activeProfileId, type: needType }).toArray();
    cats.sort((a, b) => a.name.localeCompare(b.name));
    return cats;
  }, [activeProfileId, debt?.direction]);

  const paid = useMemo(() => (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0), [payments]);
  const remaining = useMemo(() => Math.max(0, (debt?.principal ?? 0) - paid), [debt, paid]);

  async function addPayment() {
    if (!activeProfileId || !debtId || !debt) return;

    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return alert("Сума має бути > 0");
    if (!date) return alert("Вкажи дату");

    await addDebtPayment({
      profileId: activeProfileId,
      debtId,
      date,
      amount: num,
      note: note.trim() || null,
      createTransaction: createTx,
      txCategoryId: txCategoryId ? Number(txCategoryId) : null,
    });

    setAmount("");
    setNote("");
    await recalcDebtStatus(activeProfileId, debtId);
  }

  async function removePayment(id) {
    if (!activeProfileId) return;
    const ok = window.confirm("Видалити платіж?");
    if (!ok) return;
    await deleteDebtPayment(activeProfileId, id);
  }

  if (!debt) return null;

  const txTypeLabel = debt.direction === "i_owe" ? "витрату" : "дохід";
  const txTypeNeed = debt.direction === "i_owe" ? "expense" : "income";

  return (
    <div className="card">
      <div className="rowBetween">
        <h2>Борг: {debt.counterparty}</h2>
        <button className="btn" type="button" onClick={onClose}>
          Закрити
        </button>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <span className="badge">{debt.direction === "i_owe" ? "Я винен" : "Мені винні"}</span>
        <span className="badge">Статус: {debt.status}</span>
        <span className="pill">Сума: {fmtUAH(debt.principal)}</span>
        <span className="pill">Сплачено: {fmtUAH(paid)}</span>
        <span className="pill">Залишок: {fmtUAH(remaining)}</span>
        {debt.dueDate && <span className="badge">Дедлайн: {debt.dueDate}</span>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Додати платіж</h3>

        <div className="row" style={{ marginBottom: 10 }}>
          <label className="label" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={createTx}
              onChange={(e) => setCreateTx(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Створити транзакцію ({txTypeLabel})
          </label>

          {createTx && (
            <span className="muted">
              (тип транзакції: {txTypeNeed})
            </span>
          )}
        </div>

        {createTx && (
          <div className="row" style={{ marginBottom: 10 }}>
            <label className="label">
              Категорія для транзакції:
              <select
                className="select"
                value={txCategoryId}
                onChange={(e) => setTxCategoryId(e.target.value)}
                style={{ marginLeft: 8 }}
              >
                <option value="">— без категорії —</option>
                {(txCategories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="grid3">
          <label className="labelCol">
            Дата
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="labelCol">
            Сума
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
          </label>

          <label className="labelCol">
            Коментар (опц.)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn" type="button" onClick={addPayment}>
              Додати
            </button>
          </div>
        </div>
      </div>

      <h3>Історія платежів</h3>
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Сума</th>
              <th>Коментар</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{fmtUAH(p.amount)}</td>
                <td>{p.note ?? ""}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btnDanger" type="button" onClick={() => removePayment(p.id)}>
                    Видалити
                  </button>
                </td>
              </tr>
            ))}

            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan="4" className="muted" style={{ padding: 12 }}>
                  Поки немає платежів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Якщо увімкнено “Створити транзакцію”, платіж впливатиме на аналітику/бюджети як звичайна транзакція.
      </p>
    </div>
  );
}
