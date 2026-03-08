import { useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { login } from "../api/auth";
import { setToken } from "../lib/authToken";
import { useAuthToken } from "../hooks/useAuthToken";
import { parseJwtPayload } from "../lib/jwtPayload";

export default function LoginPage() {
  const token = useAuthToken();
  const location = useLocation();
  const from = location.state?.from ?? "/transactions";

  const hasProfile = useMemo(() => !!parseJwtPayload(token)?.profileId, [token]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const data = await login(email, password);
      setToken(data.token);
    } catch (err) {
      const msg =
        err?.status === 401
          ? "Невірний email або пароль"
          : String(err?.message ?? err);
      setError(msg);
    } finally {
      setWorking(false);
    }
  };

  if (token) {
    return <Navigate to={hasProfile ? from : "/profiles"} replace />;
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h2>Login</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
        />
        <button disabled={working || !email || !password} type="submit">
          {working ? "..." : "Login"}
        </button>
      </form>

      {error ? (
        <div style={{ color: "crimson", marginTop: 10 }}>{error}</div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        No account? <Link to="/register">Register</Link>
      </div>
    </div>
  );
}