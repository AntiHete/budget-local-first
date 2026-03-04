import { Link, Outlet, useLocation } from "react-router-dom";
import { clearToken } from "../lib/authToken";
import { useAuthToken } from "../hooks/useAuthToken";
import { parseJwtPayload } from "../lib/jwtPayload";

function NavLink({ to, children }) {
  const loc = useLocation();
  const active = loc.pathname === to;

  return (
    <Link
      to={to}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        border: "1px solid #00000022",
        background: active ? "#0000000a" : "transparent",
        color: "inherit",
      }}
    >
      {children}
    </Link>
  );
}

export default function AppLayout() {
  const token = useAuthToken();
  const email = parseJwtPayload(token)?.email ?? null;
  const profileId = parseJwtPayload(token)?.profileId ?? null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/budgets">Budgets</NavLink>
          <NavLink to="/debts">Debts</NavLink>
          <NavLink to="/profiles">Profiles</NavLink>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ opacity: 0.8, fontSize: 13, textAlign: "right" }}>
            <div>{email ?? "—"}</div>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              {profileId ? `profile: ${profileId}` : "profile: —"}
            </div>
          </div>

          <button onClick={clearToken}>Logout</button>
        </div>
      </div>

      <Outlet />
    </div>
  );
}