import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";

export default function ProfileSelector() {
  const { activeProfileId, setActiveProfileId } = useProfile();
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const [name, setName] = useState("");

  async function addProfile() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const id = await db.profiles.add({
      name: trimmed,
      createdAt: new Date().toISOString(),
    });
    setName("");
    setActiveProfileId(id);
  }

  async function deleteProfile(id) {
    const ok = window.confirm("Видалити профіль? Дані цього профілю теж буде видалено.");
    if (!ok) return;

    // Видаляємо пов'язані дані
    await db.transaction("rw", db.transactions, db.categories, db.profiles, async () => {
      await db.transactions.where("profileId").equals(id).delete();
      await db.categories.where("profileId").equals(id).delete();
      await db.profiles.delete(id);
    });

    const left = await db.profiles.orderBy("id").first();
    setActiveProfileId(left?.id ?? null);
  }

  if (!profiles) return null;

  return (
    <div className="profileBar">
      <div className="profileLeft">
        <label className="label">
          Профіль:
          <select
            className="select"
            value={activeProfileId ?? ""}
            onChange={(e) => setActiveProfileId(Number(e.target.value))}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="btn"
          type="button"
          onClick={() => deleteProfile(activeProfileId)}
          disabled={!activeProfileId || profiles.length <= 1}
          title={profiles.length <= 1 ? "Не можна видалити останній профіль" : "Видалити профіль"}
        >
          Видалити
        </button>
      </div>

      <div className="profileRight">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Новий профіль (назва)"
        />
        <button className="btn" type="button" onClick={addProfile}>
          Додати
        </button>
      </div>
    </div>
  );
}
