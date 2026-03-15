import React, { useEffect, useMemo, useState } from "react";
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

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profiles, setProfiles] = useState([]);
  const [members, setMembers] = useState([]);

  const [newProfileName, setNewProfileName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState({});
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("viewer");

  const activeProfileId = useMemo(() => {
    return parseJwtPayload(token)?.profileId ?? "";
  }, [token]);

  const activeProfile = useMemo(() => {
    return profiles.find((profile) => profile.id === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  const isOwner = activeProfile?.role === "owner";

  async function refreshProfiles() {
    const data = await listProfiles();
    const nextProfiles = data?.profiles || [];
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

    return nextProfiles;
  }

  async function refreshMembers() {
    if (!activeProfileId) {
      setMembers([]);
      return [];
    }

    const data = await listProfileMembers();
    const nextMembers = data?.members || [];
    setMembers(nextMembers);
    return nextMembers;
  }

  async function refreshAll() {
    setLoading(true);
    setError("");

    try {
      await refreshProfiles();
      await refreshMembers();
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [activeProfileId]);

  async function handleCreateProfile(e) {
    e.preventDefault();

    const name = newProfileName.trim();
    if (!name) return;

    setWorking(true);
    setError("");
    setSuccess("");

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

      setSuccess("Профіль створено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleSelectProfile(profileId) {
    if (!profileId) return;

    setWorking(true);
    setError("");
    setSuccess("");

    try {
      const selected = await selectProfile(profileId);
      if (selected?.token) {
        setToken(selected.token);
      }
      setSuccess("Профіль перемкнено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleRenameProfile(profileId) {
    const nextName = String(renameDrafts[profileId] || "").trim();
    if (!nextName) return;

    setWorking(true);
    setError("");
    setSuccess("");

    try {
      await renameProfile(profileId, nextName);
      await refreshProfiles();
      setSuccess("Назву профілю оновлено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteProfile(profileId) {
    const isActive = profileId === activeProfileId;
    const ok = window.confirm(
      isActive
        ? "Видалити активний профіль? Після цього тебе буде розлогінено."
        : "Видалити профіль?"
    );
    if (!ok) return;

    setWorking(true);
    setError("");
    setSuccess("");

    try {
      await deleteProfile(profileId);

      if (isActive) {
        clearToken();
        navigate("/login", { replace: true });
        return;
      }

      await refreshAll();
      setSuccess("Профіль видалено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();

    const email = memberEmail.trim();
    if (!email) return;

    setWorking(true);
    setError("");
    setSuccess("");

    try {
      await addProfileMember(email, memberRole);
      setMemberEmail("");
      setMemberRole("viewer");
      await refreshMembers();
      setSuccess("Учасника додано");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleChangeMemberRole(memberId, role) {
    setWorking(true);
    setError("");
    setSuccess("");

    try {
      await updateProfileMemberRole(memberId, role);
      await refreshMembers();
      setSuccess("Роль учасника оновлено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function handleRemoveMember(memberId) {
    const ok = window.confirm("Видалити учасника з профілю?");
    if (!ok) return;

    setWorking(true);
    setError("");
    setSuccess("");

    try {
      const result = await removeProfileMember(memberId);

      if (result?.removedCurrentUser) {
        clearToken();
        navigate("/login", { replace: true });
        return;
      }

      await refreshMembers();
      setSuccess("Учасника видалено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Профілі та доступ</h1>
        <p>
          Тут можна створювати профілі, перемикати активний профіль, додавати
          учасників і керувати ролями доступу.
        </p>
      </section>

      <section className="statsGrid">
        <article className="statCard">
          <div className="statLabel">Усього профілів</div>
          <div className="statValue">{profiles.length}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Активний профіль</div>
          <div className="statValue">{activeProfile?.name || "—"}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Моя роль</div>
          <div className="statValue">{activeProfile?.role || "—"}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Учасників в активному профілі</div>
          <div className="statValue">{members.length}</div>
        </article>
      </section>

      <section className="card">
        <h2>Створити профіль</h2>

        <form onSubmit={handleCreateProfile} className="formGrid twoCols">
          <label className="field">
            <span>Назва нового профілю</span>
            <input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Напр. Сімейний бюджет"
              disabled={working}
            />
          </label>

          <div className="field fieldActions">
            <button type="submit" disabled={working || !newProfileName.trim()}>
              Створити профіль
            </button>

            <button type="button" onClick={refreshAll} disabled={working || loading}>
              Оновити дані
            </button>
          </div>
        </form>

        {(error || success) && (
          <div style={{ marginTop: 12 }}>
            {error ? <div className="inlineError">{error}</div> : null}
            {success ? <div style={{ color: "#7dffbf" }}>{success}</div> : null}
          </div>
        )}
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Мої профілі</h2>
            <p className="mutedText">
              Власник може перейменувати або видалити профіль. Учасник може лише
              перемикатись між доступними профілями.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mutedText">Завантаження профілів…</div>
        ) : !profiles.length ? (
          <div className="emptyState">Профілі ще не створені.</div>
        ) : (
          <div className="listGrid">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfileId;
              const canManage = profile.role === "owner";

              return (
                <article key={profile.id} className="budgetCard">
                  <div className="budgetCardTop">
                    <div>
                      <h3>{profile.name}</h3>
                      <div className="mutedText">{profile.id}</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge">{profile.role}</span>
                      {isActive ? <span className="badge">активний</span> : null}
                    </div>
                  </div>

                  <div className="formGrid twoCols">
                    <label className="field">
                      <span>Нова назва</span>
                      <input
                        value={renameDrafts[profile.id] ?? ""}
                        onChange={(e) =>
                          setRenameDrafts((prev) => ({
                            ...prev,
                            [profile.id]: e.target.value,
                          }))
                        }
                        disabled={working || !canManage}
                      />
                    </label>

                    <div className="field fieldActions">
                      <button
                        type="button"
                        onClick={() => handleRenameProfile(profile.id)}
                        disabled={working || !canManage || !String(renameDrafts[profile.id] || "").trim()}
                      >
                        Перейменувати
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectProfile(profile.id)}
                        disabled={working || isActive}
                      >
                        Обрати
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(profile.id)}
                        disabled={working || !canManage}
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Учасники активного профілю</h2>
            <p className="mutedText">
              Owner може додавати користувачів, змінювати ролі та видаляти учасників.
            </p>
          </div>
        </div>

        {!activeProfile ? (
          <div className="emptyState">Спочатку обери активний профіль.</div>
        ) : (
          <>
            <form onSubmit={handleAddMember} className="formGrid twoCols" style={{ marginBottom: 18 }}>
              <label className="field">
                <span>Email користувача</span>
                <input
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  disabled={working || !isOwner}
                />
              </label>

              <label className="field">
                <span>Роль</span>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  disabled={working || !isOwner}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field fieldActions">
                <button
                  type="submit"
                  disabled={working || !isOwner || !memberEmail.trim()}
                >
                  Додати учасника
                </button>
              </div>
            </form>

            {!members.length ? (
              <div className="emptyState">У цьому профілі ще немає учасників.</div>
            ) : (
              <div className="listGrid">
                {members.map((member) => (
                  <article key={member.id} className="budgetCard">
                    <div className="budgetCardTop">
                      <div>
                        <h3>{member.name || member.email}</h3>
                        <div className="mutedText">{member.email}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="badge">{member.role}</span>
                        {member.isCurrentUser ? <span className="badge">ви</span> : null}
                      </div>
                    </div>

                    <div className="formGrid twoCols">
                      <label className="field">
                        <span>Змінити роль</span>
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                          disabled={working || !isOwner}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="field fieldActions">
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={working || !isOwner}
                        >
                          Видалити з профілю
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}