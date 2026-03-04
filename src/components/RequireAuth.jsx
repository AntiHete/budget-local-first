import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthToken } from "../hooks/useAuthToken";

export default function RequireAuth() {
  const token = useAuthToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}