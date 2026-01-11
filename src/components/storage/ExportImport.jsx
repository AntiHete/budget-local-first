import React, { useRef, useState } from "react";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ExportImport() {
  const { activeProfileId } = useProfile();
  const fileRef = useRef(null);
  const importModeRef = useRef("overwrite"); // overwrite | newProfile
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    try {
      const data = {
        meta: {
          schemaVersion: 1,
          scope: "all",
          exportedAt: new Date().toISOString(),
          dbName: db.name,
        },
        profiles: await db.profiles.toArray(),
        categories: await db.categories.toArray(),
        transactions: await db.transactions.toArray(),
        budgets: await db.budgets.toArray(),
        payments: await db.payments.toArray(),
      };
      downloadJSON(`budget-backup-all-${todayISO()}.json`, data);
    } finally {
      setBusy(false);
    }
  }

  async function exportActiveProfile() {
    if (!activeProfileId) {
      alert("Нема активного профілю");
      return;
    }
    setBusy(true);
    try {
      const profile = await db.profiles.get(activeProfileId);
      if (!profile) {
        alert("Профіль не знайдено");
        return;
      }

      const data = {
        meta: {
          schemaVersion: 1,
          scope: "profile",
          exportedAt: new Date().toISOString(),
          dbName: db.name,
        },
        profiles: [profile],
        categories: await db.categories.where("profileId").equals(activeProfileId).toArray(),
        transactions: await db.transactions.where("profileId").equals(activeProfileId).toArray(),
        budgets: await db.budgets.where("profileId").equals(activeProfileId).toArray(),
        payments: await db.payments.where("profileId").equals(activeProfileId).toArray(),
      };

      downloadJSON(`budget-backup-${profile.name}-${todayISO()}.json`, data);
    } finally {
      setBusy(false);
    }
  }

  async function importOverwriteAll(data) {
    const ok = window.confirm(
      "Імпорт з перезаписом: буде очищено локальну БД і завантажено дані з файлу. Продовжити?"
    );
    if (!ok) return;

    await db.transaction("rw", db.profiles, db.categories, db.transactions, db.budgets, db.payments, async () => {
      await db.payments.clear();
      await db.budgets.clear();
      await db.transactions.clear();
      await db.categories.clear();
      await db.profiles.clear();

      if (Array.isArray(data.profiles)) await db.profiles.bulkAdd(data.profiles);
      if (Array.isArray(data.categories)) await db.categories.bulkAdd(data.categories);
      if (Array.isArray(data.transactions)) await db.transactions.bulkAdd(data.transactions);
      if (Array.isArray(data.budgets)) await db.budgets.bulkAdd(data.budgets);
      if (Array.isArray(data.payments)) await db.payments.bulkAdd(data.payments);
    });

    alert("Імпорт завершено. За потреби онови сторінку (F5).");
  }

  async function importAsNewProfile(data) {
    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    if (profiles.length !== 1) {
      alert("Імпорт як новий профіль працює для файлу з 1 профілем (експорт активного профілю).");
      return;
    }

    const baseName = profiles[0]?.name ? String(profiles[0].name) : "Imported";
    const newName = `${baseName} (import)`;
    const ok = window.confirm(`Імпортувати як новий профіль: "${newName}" ?`);
    if (!ok) return;

    const oldProfileId = profiles[0].id;

    // створюємо новий профіль
    const newProfileId = await db.profiles.add({
      name: newName,
      createdAt: new Date().toISOString(),
    });

    // мапа категорій: oldCatId -> newCatId
    const catIdMap = new Map();
    const categories = Array.isArray(data.categories) ? data.categories : [];

    for (const c of categories) {
      // імпортуємо тільки категорії старого профілю (на всяк випадок)
      if (c.profileId !== oldProfileId) continue;

      const newCatId = await db.categories.add({
        profileId: newProfileId,
        type: c.type,
        name: c.name,
      });
      catIdMap.set(c.id, newCatId);
    }

    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    for (const t of transactions) {
      if (t.profileId !== oldProfileId) continue;

      await db.transactions.add({
        profileId: newProfileId,
        date: t.date,
        type: t.type,
        amount: t.amount,
        note: t.note ?? null,
        createdAt: t.createdAt ?? new Date().toISOString(),
        categoryId: t.categoryId ? (catIdMap.get(t.categoryId) ?? null) : null,
      });
    }

    const budgets = Array.isArray(data.budgets) ? data.budgets : [];
    for (const b of budgets) {
      if (b.profileId !== oldProfileId) continue;

      const mappedCat = catIdMap.get(b.categoryId);
      if (!mappedCat) continue;

      await db.budgets.add({
        profileId: newProfileId,
        month: b.month,
        categoryId: mappedCat,
        limit: b.limit,
      });
    }

    const payments = Array.isArray(data.payments) ? data.payments : [];
    for (const p of payments) {
      if (p.profileId !== oldProfileId) continue;

      await db.payments.add({
        profileId: newProfileId,
        dueDate: p.dueDate,
        title: p.title,
        amount: p.amount,
        status: p.status ?? "planned",
        createdAt: p.createdAt ?? new Date().toISOString(),
        categoryId: p.categoryId ? (catIdMap.get(p.categoryId) ?? null) : null,
      });
    }

    alert("Імпорт як новий профіль завершено.");
  }

  async function importFile(file) {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (importModeRef.current === "overwrite") {
        await importOverwriteAll(data);
      } else {
        await importAsNewProfile(data);
      }
    } catch (e) {
      console.error(e);
      alert("Помилка імпорту JSON. Перевір формат файлу.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Резервна копія (JSON)</h2>

      <div className="row">
        <button className="btn" type="button" onClick={exportAll} disabled={busy}>
          Експорт (всі профілі)
        </button>

        <button className="btn" type="button" onClick={exportActiveProfile} disabled={busy || !activeProfileId}>
          Експорт (активний профіль)
        </button>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => {
            importModeRef.current = "overwrite";
            fileRef.current?.click();
          }}
        >
          Імпорт з перезаписом
        </button>

        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => {
            importModeRef.current = "newProfile";
            fileRef.current?.click();
          }}
        >
          Імпорт як новий профіль
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Рекомендовано: експорт/імпорт активного профілю (безпечніше), або імпорт як новий профіль.
      </p>
    </div>
  );
}
