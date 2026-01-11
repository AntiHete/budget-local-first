import React, { useRef, useState } from "react";
import { db } from "../../db/db";

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

export default function ExportImport() {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    try {
      const data = {
        meta: {
          app: "budget-local-first",
          exportedAt: new Date().toISOString(),
          dbName: db.name,
        },
        profiles: await db.profiles.toArray(),
        categories: await db.categories.toArray(),
        transactions: await db.transactions.toArray(),
        budgets: await db.budgets.toArray(),
        payments: await db.payments.toArray(),
      };

      downloadJSON(`budget-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file) {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const ok = window.confirm(
        "Імпорт перезапише локальні дані (очистить поточну БД і завантажить з файлу). Продовжити?"
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

      alert("Імпорт завершено. Онови сторінку (F5), якщо потрібно.");
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
          Експорт
        </button>

        <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          Імпорт
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
        Експорт/імпорт потрібен для перенесення даних між пристроями та резервного копіювання.
      </p>
    </div>
  );
}
