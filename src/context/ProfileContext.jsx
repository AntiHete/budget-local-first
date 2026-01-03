import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db } from "../db/db";

const ProfileContext = createContext(null);
const STORAGE_KEY = "budgetapp.activeProfileId";

export function ProfileProvider({ children }) {
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : null;
  });

  useEffect(() => {
    if (activeProfileId == null) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, String(activeProfileId));
  }, [activeProfileId]);

  // Створити дефолтний профіль при першому запуску
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const count = await db.profiles.count();
      if (cancelled) return;

      if (count === 0) {
        const id = await db.profiles.add({
          name: "Мій профіль",
          createdAt: new Date().toISOString(),
        });
        if (!cancelled) setActiveProfileId(id);
      } else if (activeProfileId == null) {
        const first = await db.profiles.orderBy("id").first();
        if (!cancelled && first?.id) setActiveProfileId(first.id);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ activeProfileId, setActiveProfileId }),
    [activeProfileId]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
