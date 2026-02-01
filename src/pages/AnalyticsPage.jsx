import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../context/ProfileContext";
import { currentMonth } from "../services/dateService";
import { getMonthlyExpenseByCategory, getMonthlyDailyFlow } from "../services/analyticsService";
import CategoryPie from "../components/analytics/CategoryPie";
import DailyFlowChart from "../components/analytics/DailyFlowChart";

export default function AnalyticsPage() {
  const { activeProfileId } = useProfile();
  const [month, setMonth] = useState(currentMonth());

  const pieData = useLiveQuery(async () => {
    if (!activeProfileId || !month) return [];
    return getMonthlyExpenseByCategory(activeProfileId, month);
  }, [activeProfileId, month]);

  const flowData = useLiveQuery(async () => {
    if (!activeProfileId || !month) return [];
    return getMonthlyDailyFlow(activeProfileId, month);
  }, [activeProfileId, month]);

  const totalExpense = useMemo(() => {
    return (pieData ?? []).reduce((s, x) => s + (x.value ?? 0), 0);
  }, [pieData]);

  return (
    <>
      <h1>Аналітика</h1>

      <div className="card">
        <div className="rowBetween">
          <div className="row">
            <label className="label">
              Місяць:
              <input
                className="input"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
          </div>

          <div className="badge">Витрати за місяць: {Math.round(totalExpense * 100) / 100} UAH</div>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Дані беруться з транзакцій активного профілю (local-first).
        </p>
      </div>

      <CategoryPie data={pieData} />
      <DailyFlowChart data={flowData} />
    </>
  );
}
