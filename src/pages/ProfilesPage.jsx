import { useEffect, useMemo, useState } from "react";
import { listProfiles, createProfile, selectProfile, deleteProfile } from "../api/profiles";
import { setToken, clearToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "../hooks/useAuthToken";
import { useNavigate } from "react-router-dom";

export default function ProfilesPage() {
  const navigate = useNavigate();
  const token = useAuthToken();
  const activeProfileId = useMemo(() => parseJwtPayload(token)?.profileId ?? null, [token]);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const [profiles, setProfiles] = useState([]);
  const [name, setName] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProfiles();
      setProfiles(data.profiles || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const data = await createProfile({ name: name.trim() });
      setName("");
      await refresh();

      // одразу активуємо створений профіль
      const createdId = data?.profile?.id;
      if (createdId) {
        const selected = await selectProfile(createdId);
        setToken(selected.token);
      }
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  const onSelect = async (profileId) => {
    setWorking(true);
    setError(null);
    try {
      const data = await selectProfile(profileId);
      setToken(data.token);
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  const onDelete = async (profileId) => {
    const isActive = profileId === activeProfileId;

    const ok = window.confirm(
      isActive
        ? "Видалити активний профіль? Це також видалить усі пов’язані дані (transactions/budgets/debts/payments). Після цього тебе розлогінить."
        : "Видалити профіль? Це також видалить усі пов’язані дані (transactions/budgets/debts/payments)."
    );
    if (!ok) return;

    setWorking(true);
    setError(null);
    try {
      await deleteProfile(profileId);

      if (isActive) {
        // активний профіль видалили — скидаємо токен і ведемо на profiles/login
        clearToken();
        navigate("/login", { replace: true });
        return;
      }

      await refresh();

      // якщо видалили не активний — просто оновили список
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Profiles</h2>

      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Active profileId: <code>{activeProfileId ?? "—"}</code>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New profile name"
        />
        <button onClick={onCreate} disabled={working || !name.trim()}>
          Create
        </button>
        <button onClick={refresh} disabled={working}>
          Refresh
        </button>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {String(error?.message ?? error)}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        {loading ? "Loading…" : `Count: ${profiles.length}`} {working ? "| Working…" : ""}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {profiles.map((p) => {
          const isActive = p.id === activeProfileId;
          return (
            <div key={p.id} style={{ border: "1px solid #3333", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.name} {isActive ? "(active)" : ""}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12, fontFamily: "monospace" }}>
                    {p.id}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => onSelect(p.id)} disabled={working || isActive}>
                    Select
                  </button>

                  <button
                    onClick={() => onDelete(p.id)}
                    disabled={working}
                    style={{ border: "1px solid #f4433633" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}