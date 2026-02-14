import React from "react";
import MonthlySummary from "../components/dashboard/MonthlySummary";
import BudgetAlerts from "../components/dashboard/BudgetAlerts";
import UpcomingPayments from "../components/dashboard/UpcomingPayments";

export default function DashboardPage() {
  return (
    <>
      <h1>Дашборд</h1>

      <div className="gridDash">
        <MonthlySummary />
        <BudgetAlerts />
      </div>

      <UpcomingPayments />

      <div className="muted" style={{ marginTop: 10 }}>
        {/* Далі додамо: графіки та експорт/імпорт. */}
      </div>
    </>
  );
}
