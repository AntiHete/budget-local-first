import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createProfile,
  listProfiles,
  selectProfile,
} from "../api/profiles";
import { setToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "../hooks/useAuthToken";

export default function ProfileSelector() {
  const navigate = useNavigate();
  const token = useAuthToken();

  const [profiles, setProfiles] = useState([]);
  const [working, setWorking] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [error, setError] = useState("");

  const activeProfileId = useMemo(() => {
    return parseJwtPayload(token)?.profileId ?? "";
  }, [token]);

  async function refreshProfiles() {
    if (!token) {
      setProfiles([]);
      return;
    }

    setError("");
    try {
      const data = await listProfiles();
      setProfiles(data?.profiles || []);
    } catch (e) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    refreshProfiles();
  }, [token]);

  async function handleSelect(profileId) {
    if (!profileId) return;

    setWorking(true);
    setError("");

    try {
      const data = await selectProfile(profileId);
      if (data?.token) {
        setToken(data.token);
      }
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleCreate() {
    const name = newProfileName.trim();
    if (!name) return;

    setWorking(true);
    setError("");

    try {
      const created = await createProfile({ name });
      const createdId = created?.profile?.id;

      setNewProfileName("");
      await refreshProfiles();

      if (createdId) {
        const selected = await selectProfile(createdId);
        if (selected?.token) {
          setToken(selected.token);
        }
      }
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  if (!token) return null;

  return (
    <div className="profileBar">
      <div className="profileBarGroup">
        <label className="profileBarLabel">Профіль</label>
        <select
          className="profileBarSelect"
          value={activeProfileId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={working}
        >
          <option value="">— обери профіль —</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
              {profile.role ? ` (${profile.role})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="profileBarActions">
        <button type="button" onClick={refreshProfiles} disabled={working}>
          Оновити
        </button>

        <button type="button" onClick={() => navigate("/profiles")}>
          Profiles
        </button>

        <button type="button" onClick={() => navigate("/logout")}>
          Logout
        </button>
      </div>

      <div className="profileBarCreate">
        <input
          className="profileBarInput"
          value={newProfileName}
          onChange={(e) => setNewProfileName(e.target.value)}
          placeholder="Новий профіль (назва)"
          disabled={working}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={working || !newProfileName.trim()}
        >
          Додати
        </button>
      </div>

      {error ? <div className="profileBarError">{error}</div> : null}
    </div>
  );
}
