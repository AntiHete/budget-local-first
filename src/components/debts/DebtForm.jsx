import React, { useState } from "react";
import { useProfile } from "../../context/ProfileContext";
import { createDebt } from "../../services/debtService";
import { todayISO } from "../../services/dateService";

export default function DebtForm() {
  const { activeProfileId } = useProfile();

  const [direction, setDirection] = useState("i_owe");
  const [counterparty, setCounterparty] = useState("");
  const [principal, setPrincipal] = useState("");
  const [currency, setCurrency] = useState("UAH");
  const [startDate, setStartDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");

  async function onCreate() {
    if (!activeProfileId) return;

    const name = counterparty.trim();
    const sum = Number(principal);

    if (!name) return alert("Вкажи контрагента");
    if (!Number.isFinite(sum) || sum <= 0) return alert("Сума має бути > 0");
    if (!startDate) return alert("Вкажи дату початку");

    await createDebt({
      profileId: activeProfileId,
      direction,
      counterparty: name,
      principal: sum,
      currency,
      startDate,
      dueDate: dueDate ? dueDate : null,
    });

    setCounterparty("");
    setPrincipal("");
    setDueDate("");
  }

  return (
    <div className="card">
      <h2>Додати борг</h2>

      <div className="grid3">
        <label className="labelCol">
          Напрям
          <select className="select" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="i_owe">Я винен</option>
            <option value="owed_to_me">Мені винні</option>
          </select>
        </label>

        <label className="labelCol">
          Контрагент
          <input className="input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Ім'я / Організація" />
        </label>

        <label className="labelCol">
          Сума
          <input className="input" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value.replace(",", "."))} placeholder="Напр. 2000" />
        </label>

        <label className="labelCol">
          Валюта
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="UAH">UAH</option>
          </select>
        </label>

        <label className="labelCol">
          Дата початку
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>

        <label className="labelCol">
          Дедлайн (опц.)
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button className="btn" type="button" onClick={onCreate} disabled={!activeProfileId}>
            Створити
          </button>
        </div>
      </div>
    </div>
  );
}
