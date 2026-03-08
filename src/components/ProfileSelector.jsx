import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProfiles, createProfile, selectProfile } from "../api/profiles";
import { useAuthToken } from "../hooks/useAuthToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { setToken, clearToken } from "../lib/authToken";

export default function ProfileSelector() {
  const navigate = useNavigate();
  const token = useAuthToken();

  const activeProfileId = useMemo(() => parseJwtPayload(token)?.profileId ?? "", [token]);
  const isAuthed = !!token;

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");

  const refresh = async () => {
    if (!isAuthed) return;
    setLoading(true);
    setError("");
    try {
      const data = await listProfiles();
      setProfiles(data.profiles || []);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const onSelect = async (profileId) => {
    if (!profileId) return;
    setWorking(true);
    setError("");
    try {
      const data = await selectProfile(profileId);
      setToken(data.token);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    setWorking(true);
    setError("");
    try {
      const created = await createProfile({ name });
      setNewName("");

      // оновлюємо список і одразу робимо його активним
      await refresh();

      const createdId = created?.profile?.id;
      if (createdId) {
        const data = await selectProfile(createdId);
        setToken(data.token);
      }
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  };

  const onLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  if (!isAuthed) return null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ opacity: 0.9 }}>Профіль:</span>

        <select
          value={activeProfileId}
          onChange={(e) => onSelect(e.target.value)}
          disabled={loading || working}
          style={{ minWidth: 200 }}
        >
          <option value="">— обери профіль —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button onClick={refresh} disabled={loading || working}>
          {loading ? "..." : "Оновити"}
        </button>

        <button onClick={() => navigate("/profiles")} disabled={working}>
          Profiles
        </button>

        <button onClick={onLogout} disabled={working}>
          Logout
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новий профіль (назва)"
          disabled={working}
          style={{ minWidth: 220 }}
        />
        <button onClick={onCreate} disabled={working || !newName.trim()}>
          Додати
        </button>
      </div>

      {error ? (
        <div style={{ color: "crimson", width: "100%" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
