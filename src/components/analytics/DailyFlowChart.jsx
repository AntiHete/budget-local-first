import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function DailyFlowChart({ data }) {
  return (
    <div className="card">
      <h2>Доходи/витрати по днях (місяць)</h2>

      {!data && <div className="muted">Завантаження...</div>}

      {data && data.length > 0 && (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <XAxis dataKey="day" tickMargin={8} />
              <YAxis tickFormatter={(v) => `${v}`} />
              <Tooltip formatter={(v) => fmtUAH(v)} />
              <Legend />
              <Bar dataKey="income" name="Доходи" fill="#10b981" />
              <Bar dataKey="expense" name="Витрати" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
