import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { register } from "../api/auth";
import { setToken } from "../lib/authToken";
import { useAuthToken } from "../hooks/useAuthToken";
import { parseJwtPayload } from "../lib/jwtPayload";

export default function RegisterPage() {
  const token = useAuthToken();
  const hasProfile = useMemo(() => !!parseJwtPayload(token)?.profileId, [token]);
  if (token) {
    return <Navigate to={hasProfile ? "/transactions" : "/profiles"} replace />;
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const data = await register(email, password, name);
      setToken(data.token);
    } catch (err) {
      setError(err);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h2>Register</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        <button disabled={working || !email || !password} type="submit">
          {working ? "..." : "Register"}
        </button>
      </form>

      {error ? (
        <div style={{ color: "crimson", marginTop: 10 }}>
          {String(error?.message ?? error)}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        Have an account? <Link to="/login">Login</Link>
      </div>
    </div>
  );
}