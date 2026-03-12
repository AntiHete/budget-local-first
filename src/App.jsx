import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import AccountsPage from "./pages/AccountsPage";
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

function ProtectedPage({ children, requireProfile = true }) {
  const content = requireProfile ? (
    <RequireProfile>
      <AppShell>{children}</AppShell>
    </RequireProfile>
  ) : (
    <AppShell>{children}</AppShell>
  );

  return <RequireAuth>{content}</RequireAuth>;
}

export default function App() {
  const token = useAuthToken();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/logout" element={<LogoutPage />} />

      <Route
        path="/profiles"
        element={
          <ProtectedPage requireProfile={false}>
            <ProfilesPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedPage>
            <DashboardPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/transactions"
        element={
          <ProtectedPage>
            <TransactionsPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/accounts"
        element={
          <ProtectedPage>
            <AccountsPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/budgets"
        element={
          <ProtectedPage>
            <BudgetsPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/debts"
        element={
          <ProtectedPage>
            <DebtsPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedPage>
            <AnalyticsPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/forecast"
        element={
          <ProtectedPage>
            <ForecastPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedPage>
            <SettingsPage />
          </ProtectedPage>
        }
      />

      <Route
        path="/backup"
        element={
          <ProtectedPage>
            <BackupPage />
          </ProtectedPage>
        }
      />

      <Route
        path="*"
        element={<Navigate to={token ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
