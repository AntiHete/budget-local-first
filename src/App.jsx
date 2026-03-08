import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";

import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import BudgetsPage from "./pages/BudgetsPage";
import DebtsPage from "./pages/DebtsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ForecastPage from "./pages/ForecastPage";
import SettingsPage from "./pages/SettingsPage";
import BackupPage from "./pages/BackupPage";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilesPage from "./pages/ProfilesPage";
import LogoutPage from "./pages/LogoutPage";

import { useAuthToken } from "./hooks/useAuthToken";
import { parseJwtPayload } from "./lib/jwtPayload";

function RequireAuth({ children }) {
  const token = useAuthToken();
  const loc = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

function RequireProfile({ children }) {
  const token = useAuthToken();
  const loc = useLocation();
  const profileId = parseJwtPayload(token)?.profileId ?? null;

  if (!profileId) {
    return <Navigate to="/profiles" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/logout" element={<LogoutPage />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path="/profiles" element={<ProfilesPage />} />

                <Route
                  path="/*"
                  element={
                    <RequireProfile>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/transactions" element={<TransactionsPage />} />
                        <Route path="/budgets" element={<BudgetsPage />} />
                        <Route path="/debts" element={<DebtsPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/forecast" element={<ForecastPage />} />
                        <Route path="/backup" element={<BackupPage />} />
                        <Route path="/settings" element={<SettingsPage />} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </RequireProfile>
                  }
                />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
