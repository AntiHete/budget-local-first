import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../../context/ProfileContext";
import { getDebtsWithStats, deleteDebt } from "../../services/debtService";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function DebtList({ onOpen }) {
  const { activeProfileId } = useProfile();

  const debts = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return getDebtsWithStats(activeProfileId);
  }, [activeProfileId]);

  async function removeDebt(id) {
    if (!activeProfileId) return;
    const ok = window.confirm("Видалити борг та всі його платежі?");
    if (!ok) return;
    await deleteDebt(activeProfileId, id);
  }

  return (
    <div className="card">
      <h2>Список боргів</h2>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Напрям</th>
              <th>Контрагент</th>
              <th>Сума</th>
              <th>Сплачено</th>
              <th>Залишок</th>
              <th>Дедлайн</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {(debts ?? []).map((d) => (
              <tr key={d.id}>
                <td><span className="badge">{d.computedStatus}</span></td>
                <td>{d.direction === "i_owe" ? "Я винен" : "Мені винні"}</td>
                <td>
                  <button className="btn" type="button" onClick={() => onOpen(d.id)}>
                    {d.counterparty}
                  </button>
                </td>
                <td>{fmtUAH(d.principal)}</td>
                <td>{fmtUAH(d.paid)}</td>
                <td>{fmtUAH(d.remaining)}</td>
                <td>{d.dueDate ?? "—"}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btnDanger" type="button" onClick={() => removeDebt(d.id)}>
                    Видалити
                  </button>
                </td>
              </tr>
            ))}

            {(debts ?? []).length === 0 && (
              <tr>
                <td colSpan="8" className="muted" style={{ padding: 12 }}>
                  Поки немає боргів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        {/* Статус “overdue” визначається за дедлайном і непогашеним залишком. */}
      </p>
    </div>
  );
}
