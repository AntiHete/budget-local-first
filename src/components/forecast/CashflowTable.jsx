import React from "react";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function CashflowTable({ points }) {
  return (
    <div className="card">
      <h2>Деталі по днях</h2>

      <div className="tableWrap">
        <table className="table">
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
            {(points ?? []).map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{fmtUAH(p.deltaIncome)}</td>
                <td>{fmtUAH(p.deltaExpense)}</td>
                <td>{fmtUAH(p.deltaPlannedPayments)}</td>
                <td>
                  <span className="badge">{fmtUAH(p.balance)}</span>
                </td>
              </tr>
            ))}

            {(points ?? []).length === 0 && (
              <tr>
                <td colSpan="5" className="muted" style={{ padding: 12 }}>
                  Нема даних
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
