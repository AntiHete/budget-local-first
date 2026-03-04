import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthToken } from "../hooks/useAuthToken";
import { parseJwtPayload } from "../lib/jwtPayload";

export default function RequireProfile() {
  const token = useAuthToken();
  const location = useLocation();

  const profileId = parseJwtPayload(token)?.profileId ?? null;

  if (!profileId) {
    return <Navigate to="/profiles" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}