import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../context/ProfileContext";
import { currentMonth } from "../services/dateService";
import { applyScenarioToForecast, forecastExpenseByCategory } from "../services/forecastService";
import CategoryForecastTable from "../components/forecast/CategoryForecastTable";
import ScenarioPanel from "../components/forecast/ScenarioPanel";
import { db } from "../db/db";

import { buildCashflowForecast } from "../services/cashflowService";
import CashflowChart from "../components/forecast/CashflowChart";
import CashflowTable from "../components/forecast/CashflowTable";

function toNumberOrZero(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export default function ForecastPage() {
  const { activeProfileId } = useProfile();
  const [baseMonth, setBaseMonth] = useState(currentMonth());

  // --- Category forecast (rolling avg)
  const baseForecast = useLiveQuery(async () => {
    if (!activeProfileId || !baseMonth) return null;
    return forecastExpenseByCategory(activeProfileId, baseMonth, 3);
  }, [activeProfileId, baseMonth]);

  const expenseCategories = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const cats = await db.categories.where({ profileId: activeProfileId, type: "expense" }).toArray();
    cats.sort((a, b) => a.name.localeCompare(b.name));
    return cats;
  }, [activeProfileId]);

  const [scenario, setScenario] = useState({
    enabled: false,
    type: "expense", // expense | income
    amount: "",
    categoryId: null,
  });

  const nextMonth = baseForecast?.nextMonth ?? "";

  const scenarioResult = useMemo(() => {
    if (!baseForecast) return null;
    const sc = {
      enabled: scenario.enabled,
      type: scenario.type,
      month: nextMonth,
      categoryId: scenario.categoryId,
      amount: toNumberOrZero(scenario.amount),
    };
    return applyScenarioToForecast(baseForecast, sc);
  }, [baseForecast, scenario, nextMonth]);

  const info = scenarioResult?.scenarioInfo;

  // --- Cash-flow (30 days)
  const cashflow = useLiveQuery(async () => {
    if (!activeProfileId) return null;
    return buildCashflowForecast(activeProfileId, 30);
  }, [activeProfileId]);

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
          Тут: (1) прогноз по категоріях (rolling avg) + (2) сценарій “що буде, якщо…” + (3) cash-flow на 30 днів.
        </p>
      </div>

      <ScenarioPanel
        scenario={scenario}
        setScenario={setScenario}
        nextMonth={nextMonth}
        expenseCategories={expenseCategories}
      />

      {info?.enabled && (
        <div className="card">
          <h2>Ефект сценарію</h2>
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <span className="badge">
              Net impact: {info.netImpact > 0 ? `+${info.netImpact}` : `${info.netImpact}`} UAH
            </span>
            {info.appliedToCategory && <span className="badge">Категорія: {info.appliedToCategory}</span>}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Сценарій змінює прогноз витрат (expense) або показує чистий ефект (income).
          </p>
        </div>
      )}

      <CategoryForecastTable
        months={scenarioResult?.months}
        nextMonth={scenarioResult?.nextMonth}
        rows={scenarioResult?.rows}
      />

      <CashflowChart points={cashflow?.points ?? []} />
      <CashflowTable points={cashflow?.points ?? []} />
    </>
  );
}
