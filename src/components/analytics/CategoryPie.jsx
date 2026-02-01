import React from "react";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

// Recharts потребує colors тільки для matplotlib.
// Тут це UI-бібліотека, без кольорів pie виглядає погано.
// Зробимо нейтральну палітру.
const COLORS = ["#64748b", "#94a3b8", "#475569", "#a1a1aa", "#6b7280", "#9ca3af"];

export default function CategoryPie({ data }) {
  return (
    <div className="card">
      <h2>Структура витрат за категоріями</h2>

      {(!data || data.length === 0) && <div className="muted">Нема витрат з категоріями за цей період</div>}

      {data && data.length > 0 && (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                label={(p) => `${p.name}: ${Math.round(p.percent * 100)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip formatter={(v) => fmtUAH(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
