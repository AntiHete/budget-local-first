import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function CashflowChart({ points }) {
  return (
    <div className="card">
      <h2>Cash-flow (прогноз балансу на 30 днів)</h2>

      {(!points || points.length === 0) && <div className="muted">Нема даних</div>}

      {points && points.length > 0 && (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={points}>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(5)} // MM-DD
                minTickGap={20}
              />
              <YAxis />
              <Tooltip formatter={(v) => fmtUAH(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="balance"
                name="Баланс"
                stroke="#3b82f6"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="muted" style={{ marginTop: 8 }}>
        Планові платежі (payments зі статусом planned) враховуються як витрати у відповідну дату.
      </p>
    </div>
  );
}
