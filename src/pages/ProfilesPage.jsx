import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addProfileMember,
  createProfile,
  deleteProfile,
  listProfileMembers,
  listProfiles,
  removeProfileMember,
  renameProfile,
  selectProfile,
  updateProfileMemberRole,
} from "../api/profiles";
import { clearToken, setToken } from "../lib/authToken";
import { parseJwtPayload } from "../lib/jwtPayload";
import { useAuthToken } from "../hooks/useAuthToken";

const ROLE_OPTIONS = ["owner", "editor", "viewer"];

export default function ProfilesPage() {
  const navigate = useNavigate();
  const token = useAuthToken();
  const activeProfileId = useMemo(
    () => parseJwtPayload(token)?.profileId ?? null,
    [token]
  );

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const [profiles, setProfiles] = useState([]);
  const [members, setMembers] = useState([]);

  const [name, setName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState({});

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("viewer");

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  const refreshProfiles = async () => {
    const data = await listProfiles();
    const nextProfiles = data.profiles || [];
    setProfiles(nextProfiles);

    setRenameDrafts((prev) => {
      const next = { ...prev };
      for (const profile of nextProfiles) {
        if (typeof next[profile.id] !== "string") {
          next[profile.id] = profile.name;
        }
      }
      return next;
    });
  };

  const refreshMembers = async () => {
    if (!activeProfileId) {
      setMembers([]);
      return;
    }
    const data = await listProfileMembers();
    setMembers(data.members || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshProfiles();
      await refreshMembers();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId]);

  const onCreate = async () => {
    if (!name.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const data = await createProfile({ name: name.trim() });
      setName("");
      await refreshProfiles();

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

  const onRename = async (profileId) => {
    const nextName = (renameDrafts[profileId] || "").trim();
    if (!nextName) return;

    setWorking(true);
    setError(null);
    try {
      await renameProfile(profileId, nextName);
      await refreshProfiles();
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
        ? "Видалити активний профіль? Це також видалить усі пов’язані дані та розлогінить тебе."
        : "Видалити профіль? Це також видалить усі пов’язані дані."
    );
    if (!ok) return;

    setWorking(true);
    setError(null);
    try {
      await deleteProfile(profileId);

      if (isActive) {
        clearToken();
        navigate("/login", { replace: true });
        return;
      }

      await refreshAll();
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  const onAddMember = async () => {
    if (!memberEmail.trim()) return;

    setWorking(true);
    setError(null);
    try {
      await addProfileMember(memberEmail.trim(), memberRole);
      setMemberEmail("");
      setMemberRole("viewer");
      await refreshMembers();
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  const onChangeMemberRole = async (memberId, role) => {
    setWorking(true);
    setError(null);
    try {
      await updateProfileMemberRole(memberId, role);
      await refreshMembers();
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  const onRemoveMember = async (memberId) => {
    const ok = window.confirm("Видалити учасника з профілю?");
    if (!ok) return;

    setWorking(true);
    setError(null);
    try {
      const data = await removeProfileMember(memberId);
      if (data?.removedCurrentUser) {
        clearToken();
        navigate("/profiles", { replace: true });
        return;
      }
      await refreshMembers();
    } catch (e) {
      setError(e);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Profiles</h2>

      <p>
        Active profileId: <code>{activeProfileId ?? "—"}</code>
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New profile name"
          disabled={working}
        />
        <button onClick={onCreate} disabled={working || !name.trim()}>
          Create
        </button>
        <button onClick={refreshAll} disabled={working}>
          Refresh
        </button>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {String(error?.message ?? error)}
        </div>
      ) : null}

      <div style={{ marginBottom: 16 }}>
        {loading ? "Loading…" : `Count: ${profiles.length}`}{" "}
        {working ? "| Working…" : ""}
      </div>

      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {profiles.map((p) => {
          const isActive = p.id === activeProfileId;
          return (
            <div
              key={p.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {p.name} {isActive ? "(active)" : ""}
              </div>
              <div>
                <code>{p.id}</code>
              </div>
              <div>Role: {p.role}</div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <input
                  value={renameDrafts[p.id] ?? ""}
                  onChange={(e) =>
                    setRenameDrafts((prev) => ({
                      ...prev,
                      [p.id]: e.target.value,
                    }))
                  }
                  disabled={working}
                  placeholder="Rename profile"
                />
                <button onClick={() => onRename(p.id)} disabled={working}>
                  Rename
                </button>
                <button
                  onClick={() => onSelect(p.id)}
                  disabled={working || isActive}
                >
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
          );
        })}
      </div>

      <hr />

      <h3 style={{ marginTop: 24 }}>
        Members {activeProfile ? `— ${activeProfile.name}` : ""}
      </h3>

      {!activeProfileId ? (
        <p>Select a profile first.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="User email"
              disabled={working}
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              disabled={working}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              onClick={onAddMember}
              disabled={working || !memberEmail.trim()}
            >
              Add member
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {m.name || m.email} {m.isCurrentUser ? "(you)" : ""}
                </div>
                <div>{m.email}</div>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <select
                    value={m.role}
                    onChange={(e) => onChangeMemberRole(m.id, e.target.value)}
                    disabled={working}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => onRemoveMember(m.id)}
                    disabled={working}
                    style={{ border: "1px solid #f4433633" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {!members.length ? <div>No members yet.</div> : null}
          </div>
        </>
      )}
    </div>
  );
}