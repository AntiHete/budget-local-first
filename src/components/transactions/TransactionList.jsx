import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

function formatUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function TransactionList() {
  const { activeProfileId } = useProfile();
  const [typeFilter, setTypeFilter] = useState("all"); // all | expense | income

  const categories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const all = await db.categories.where("profileId").equals(activeProfileId).toArray();
    const map = new Map();
    for (const c of all) map.set(c.id, c.name);
    return map;
  }, [activeProfileId]);

  const txs = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const all = await db.transactions
      .where("profileId")
      .equals(activeProfileId)
      .toArray();

    all.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return all;
  }, [activeProfileId]);

  const filtered = useMemo(() => {
    const list = txs ?? [];
    if (typeFilter === "all") return list;
    return list.filter((t) => t.type === typeFilter);
  }, [txs, typeFilter]);

  const totals = useMemo(() => {
    let exp = 0;
    let inc = 0;
    for (const t of filtered) {
      if (t.type === "income") inc += t.amount;
      else exp += t.amount;
    }
    return { exp, inc, net: inc - exp };
  }, [filtered]);

  async function deleteTx(id) {
    const ok = window.confirm("Видалити транзакцію?");
    if (!ok) return;
    await db.transactions.delete(id);
  }

  return (
    <div className="card">
      <div className="rowBetween">
        <h2>Транзакції</h2>

        <div className="row">
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Всі</option>
            <option value="expense">Витрати</option>
            <option value="income">Доходи</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <span className="pill">Доходи: {formatUAH(totals.inc)}</span>
        <span className="pill">Витрати: {formatUAH(totals.exp)}</span>
        <span className="pill">Баланс: {formatUAH(totals.net)}</span>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th>Категорія</th>
              <th>Сума</th>
              <th>Нотатка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.type === "income" ? "Дохід" : "Витрата"}</td>
                <td>{t.categoryId ? (categories?.get(t.categoryId) ?? "—") : "—"}</td>
                <td>{formatUAH(t.amount)}</td>
                <td>{t.note ?? ""}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btnDanger" type="button" onClick={() => deleteTx(t.id)}>
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="muted" style={{ padding: 12 }}>
                  Поки немає транзакцій
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
