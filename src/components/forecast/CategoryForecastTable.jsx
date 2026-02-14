import React from "react";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function CategoryForecastTable({ months, nextMonth, rows }) {
  return (
    <div className="card">
      <h2>Прогноз витрат по категоріях</h2>

      <p className="muted">
        Метод: ковзне середнє за останні 3 місяці → прогноз на {nextMonth}.
      </p>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Категорія</th>
              <th>{months?.[0]}</th>
              <th>{months?.[1]}</th>
              <th>{months?.[2]}</th>
              <th>Середнє</th>
              <th>Прогноз ({nextMonth})</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.categoryId}>
                <td>{r.name}</td>
                <td>{fmtUAH(r.m1)}</td>
                <td>{fmtUAH(r.m2)}</td>
                <td>{fmtUAH(r.m3)}</td>
                <td>{fmtUAH(r.avg)}</td>
                <td>
                  <span className="badge">{fmtUAH(r.forecast)}</span>
                </td>
              </tr>
            ))}

            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan="6" className="muted" style={{ padding: 12 }}>
                  Нема витрат з категоріями за останні 3 місяці
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        {/* Прогноз є базовим і пояснюваним: використовує історичні витрати (без ML, без сервера). */}
      </p>
    </div>
  );
}
