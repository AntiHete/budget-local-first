import { useEffect, useMemo, useState } from "react";
import { listProfiles, createProfile, selectProfile } from "../api/profiles";
import { setToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "../hooks/useAuthToken";

export default function ProfilesPage() {
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
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    setWorking(true);
    setError(null);
    try {
      await createProfile({ name: name.trim() });
      setName("");
      await refresh();
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
      // після setToken — всі hooks з useAuthToken автоматично перемкнуться на новий profileId
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New profile name" />
        <button onClick={onCreate} disabled={working || !name.trim()}>Create</button>
        <button onClick={refresh} disabled={working}>Refresh</button>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {String(error?.message ?? error)}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        {loading ? "Loading…" : `Count: ${profiles.length}`} {working ? "| Working…" : ""}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {profiles.map((p) => {
          const isActive = p.id === activeProfileId;
          return (
            <div key={p.id} style={{ border: "1px solid #3333", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600 }}>
                {p.name} {isActive ? "(active)" : ""}
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {p.id}
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => onSelect(p.id)} disabled={working || isActive}>
                  Select
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}