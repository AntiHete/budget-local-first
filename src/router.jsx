import { createBrowserRouter, Navigate } from "react-router-dom";

import RequireAuth from "./components/RequireAuth";
import RequireProfile from "./components/RequireProfile";
import AppLayout from "./components/AppLayout";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilesPage from "./pages/ProfilesPage";

import TransactionsSyncedPage from "./pages/TransactionsSyncedPage";
import BudgetsCachedPage from "./pages/BudgetsCachedPage";
import DebtsCachedPage from "./pages/DebtsCachedPage";

function NotFound() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Not found</h2>
      <div style={{ opacity: 0.8 }}>Page does not exist.</div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/transactions" replace /> },

  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/profiles", element: <ProfilesPage /> },

          {
            element: <RequireProfile />,
            children: [
              { path: "/transactions", element: <TransactionsSyncedPage /> },
              { path: "/budgets", element: <BudgetsCachedPage /> },
              { path: "/debts", element: <DebtsCachedPage /> },
            ],
          },
        ],
      },
    ],
  },

  { path: "*", element: <NotFound /> },
]);