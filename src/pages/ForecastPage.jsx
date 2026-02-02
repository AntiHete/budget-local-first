import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../context/ProfileContext";
import { currentMonth } from "../services/dateService";
import { forecastExpenseByCategory } from "../services/forecastService";
import CategoryForecastTable from "../components/forecast/CategoryForecastTable";

export default function ForecastPage() {
  const { activeProfileId } = useProfile();
  const [baseMonth, setBaseMonth] = useState(currentMonth());

  const forecast = useLiveQuery(async () => {
    if (!activeProfileId || !baseMonth) return null;
    return forecastExpenseByCategory(activeProfileId, baseMonth, 3);
  }, [activeProfileId, baseMonth]);

  return (
    <>
      <h1>Прогноз</h1>

      <div className="card">
        <div className="rowBetween">
          <label className="label">
            Базовий місяць:
            <input
              className="input"
              type="month"
              value={baseMonth}
              onChange={(e) => setBaseMonth(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>

          <span className="badge">Профіль: {activeProfileId ?? "—"}</span>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Ми беремо 3 місяці до вибраного базового місяця, рахуємо середні витрати по категоріях і прогнозуємо наступний.
        </p>
      </div>

      <CategoryForecastTable
        months={forecast?.months}
        nextMonth={forecast?.nextMonth}
        rows={forecast?.rows}
      />
    </>
  );
}
