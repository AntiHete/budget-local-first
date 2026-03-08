import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../lib/authToken";

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    clearToken();
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h2>Logging out…</h2>
    </div>
  );
}