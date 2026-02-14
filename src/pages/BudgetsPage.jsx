import React from "react";
import MonthlySummary from "../components/dashboard/MonthlySummary";
import BudgetAlerts from "../components/dashboard/BudgetAlerts";

export default function DashboardPage() {
  return (
    <>
      <h1>Дашборд</h1>

      <div className="gridDash">
        <MonthlySummary />
        <BudgetAlerts />
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        {/* Далі додамо: нагадування, графіки та прогнозування. */}
      </div>
    </>
  );
}
