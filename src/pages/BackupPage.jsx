import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import {
  analyzeBackupCompatibility,
  buildAllBackupFilename,
  buildProfileBackupFilename,
  downloadJson,
  exportAllBackup,
  exportProfileBackup,
  importBackupAsNewProfile,
  mergeProfileFromBackup,
  replaceProfileFromBackup,
} from "../services/backupService";

export default function BackupPage() {
  const { activeProfileId } = useProfile();
  const [mode, setMode] = useState("new"); // new | replace | merge
  const [status, setStatus] = useState("");

  const profiles = useLiveQuery(async () => {
    const p = await db.profiles.toArray();
    p.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return p;
  }, []);

  const activeProfile = useMemo(() => {
    return (profiles ?? []).find((p) => p.id === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  async function onExportActive() {
    if (!activeProfileId || !activeProfile) return alert("Спочатку обери профіль");
    setStatus("Експорт профілю...");
    const data = await exportProfileBackup(activeProfileId);
    downloadJson(data, buildProfileBackupFilename(activeProfile));
    setStatus("Готово ✅");
  }

  async function onExportAll() {
    setStatus("Експорт усіх даних...");
    const data = await exportAllBackup();
    downloadJson(data, buildAllBackupFilename());
    setStatus("Готово ✅");
  }

  async function onImportFile(file) {
    try {
      setStatus("Читаю файл...");
      const text = await file.text();
      const parsed = JSON.parse(text);

      const check = analyzeBackupCompatibility(parsed);
      if (!check.ok) {
        setStatus(`Помилка: ${check.errors.join(" | ")}`);
        return;
      }

      if (check.warnings.length > 0) {
        const ok = window.confirm(
          `Є попередження сумісності:\n- ${check.warnings.join("\n- ")}\n\nПродовжити імпорт?`
        );
        if (!ok) {
          setStatus("Скасовано користувачем.");
          return;
        }
      }

      if (mode === "new") {
        setStatus("Імпортую як новий профіль...");
        const res = await importBackupAsNewProfile(parsed);
        setStatus(`Імпортовано ✅ Новий профіль: ${res.newName}. Перемкнись у селекторі профілю.`);
        return;
      }

      if (mode === "replace") {
        if (!activeProfileId) return alert("Спочатку обери активний профіль (для replace)");
        const ok = window.confirm("⚠️ Це замінить дані АКТИВНОГО профілю. Продовжити?");
        if (!ok) return;
        setStatus("Заміна даних активного профілю...");
        await replaceProfileFromBackup(activeProfileId, parsed);
        setStatus("Замінено ✅ Онови сторінку/перейди між вкладками.");
        return;
      }

      // merge
      if (!activeProfileId) return alert("Спочатку обери активний профіль (для merge)");
      const ok = window.confirm(
        "Merge імпорт додасть дані в активний профіль БЕЗ видалення існуючих.\n" +
          "Дублікати будуть пропускатись (за правилами дедупу).\n\nПродовжити?"
      );
      if (!ok) return;

      setStatus("Merge-імпорт у активний профіль...");
      const stats = await mergeProfileFromBackup(activeProfileId, parsed);

      setStatus(
        `Merge ✅ (sourceProfileId=${stats.sourceProfileId}${stats.sourceProfileName ? `, "${stats.sourceProfileName}"` : ""})\n` +
          `Added: cat=${stats.added.categories}, tx=${stats.added.transactions}, budgets=${stats.added.budgets}, pays=${stats.added.payments}, debts=${stats.added.debts}, debtPays=${stats.added.debtPayments}\n` +
          `Updated: budgets=${stats.updated.budgets}\n` +
          `Skipped: cat=${stats.skipped.categories}, tx=${stats.skipped.transactions}, budgets=${stats.skipped.budgets}, pays=${stats.skipped.payments}, debts=${stats.skipped.debts}, debtPays=${stats.skipped.debtPayments}`
      );
    } catch (e) {
      console.error(e);
      setStatus(`Помилка імпорту: ${e.message ?? String(e)}`);
    }
  }

  return (
    <>
      <h1>Резервні копії</h1>

      <div className="card">
        <h2>Експорт</h2>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={onExportActive} disabled={!activeProfileId}>
            Експорт активного профілю
          </button>
          <button className="btn" type="button" onClick={onExportAll}>
            Експорт усіх профілів
          </button>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Експорт — JSON (local-first). Ім’я файлу включає назву профілю/час.
        </p>
      </div>

      <div className="card">
        <h2>Імпорт</h2>

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="label">
            Режим:
            <select
              className="select"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="new">Імпорт як новий профіль (рекомендовано)</option>
              <option value="merge">Merge у активний профіль (без видалення)</option>
              <option value="replace">Замінити дані активного профілю</option>
            </select>
          </label>

          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {mode === "replace" && (
          <p className="muted" style={{ marginTop: 8 }}>
            ⚠️ Replace видаляє дані активного профілю і імпортує з файлу заново.
          </p>
        )}

        {mode === "merge" && (
          <p className="muted" style={{ marginTop: 8 }}>
            Merge додає дані в активний профіль, дублікати пропускаються (категорії — по name+type; транзакції — по date/type/amount/category/note; бюджети — upsert).
          </p>
        )}

        <pre className="muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
          {status}
        </pre>
      </div>

      <div className="card">
        <h2>Профілі</h2>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Назва</th>
                <th>Активний</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.id === activeProfileId ? "✅" : ""}</td>
                </tr>
              ))}
              {(profiles ?? []).length === 0 && (
                <tr>
                  <td colSpan="3" className="muted" style={{ padding: 12 }}>
                    Нема профілів
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
