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

  const stats = useLiveQuery(async () => {
    const [
      profilesCount,
      categoriesCount,
      accountsCount,
      transactionsCount,
      budgetsCount,
      paymentsCount,
      debtsCount,
      debtPaymentsCount,
    ] = await Promise.all([
      db.profiles.count(),
      db.categories.count(),
      db.accounts?.count?.() ?? 0,
      db.transactions.count(),
      db.budgets.count(),
      db.payments.count(),
      db.debts.count(),
      db.debtPayments.count(),
    ]);

    return {
      profilesCount,
      categoriesCount,
      accountsCount,
      transactionsCount,
      budgetsCount,
      paymentsCount,
      debtsCount,
      debtPaymentsCount,
    };
  }, []);

  async function onExportActive() {
    if (!activeProfileId || !activeProfile) {
      alert("Спочатку обери профіль");
      return;
    }

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
        setStatus(
          `Імпортовано ✅ Новий профіль: ${res.newName}. Перемкнись у селекторі профілю.`
        );
        return;
      }

      if (mode === "replace") {
        if (!activeProfileId) {
          alert("Спочатку обери активний профіль (для replace)");
          return;
        }

        const ok = window.confirm(
          "⚠️ Це замінить дані АКТИВНОГО профілю. Продовжити?"
        );
        if (!ok) return;

        setStatus("Заміна даних активного профілю...");
        await replaceProfileFromBackup(activeProfileId, parsed);
        setStatus("Замінено ✅ Онови сторінку або перейди між вкладками.");
        return;
      }

      if (!activeProfileId) {
        alert("Спочатку обери активний профіль (для merge)");
        return;
      }

      const ok = window.confirm(
        "Merge імпорт додасть дані в активний профіль БЕЗ видалення існуючих.\n" +
          "Дублікати будуть пропускатись (за правилами дедупу).\n\nПродовжити?"
      );
      if (!ok) return;

      setStatus("Merge-імпорт у активний профіль...");
      const stats = await mergeProfileFromBackup(activeProfileId, parsed);

      setStatus(
        `Merge ✅ (sourceProfileId=${stats.sourceProfileId}${
          stats.sourceProfileName ? `, "${stats.sourceProfileName}"` : ""
        })\n` +
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
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Backup / Restore</h1>
        <p>
          Тут можна зробити резервну копію локальних даних у JSON або імпортувати
          backup у новий чи активний профіль.
        </p>
      </section>

      <section className="statsGrid">
        <article className="statCard">
          <div className="statLabel">Профілі</div>
          <div className="statValue">{stats?.profilesCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Категорії</div>
          <div className="statValue">{stats?.categoriesCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Рахунки</div>
          <div className="statValue">{stats?.accountsCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Транзакції</div>
          <div className="statValue">{stats?.transactionsCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Бюджети</div>
          <div className="statValue">{stats?.budgetsCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Платежі</div>
          <div className="statValue">{stats?.paymentsCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Борги</div>
          <div className="statValue">{stats?.debtsCount ?? 0}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Платежі по боргах</div>
          <div className="statValue">{stats?.debtPaymentsCount ?? 0}</div>
        </article>
      </section>

      <section className="card">
        <h2>Експорт</h2>

        <div className="rowActions">
          <button
            type="button"
            onClick={onExportActive}
            disabled={!activeProfileId}
          >
            Експорт активного профілю
          </button>

          <button type="button" onClick={onExportAll}>
            Експорт усіх профілів
          </button>
        </div>

        <p className="mutedText" style={{ marginTop: 12 }}>
          Активний профіль:{" "}
          <strong>{activeProfile?.name || "не обрано"}</strong>
        </p>
      </section>

      <section className="card">
        <h2>Імпорт</h2>

        <div className="formGrid twoCols">
          <label className="field">
            <span>Режим імпорту</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="new">Імпорт як новий профіль (рекомендовано)</option>
              <option value="merge">Merge у активний профіль</option>
              <option value="replace">Замінити дані активного профілю</option>
            </select>
          </label>

          <label className="field">
            <span>JSON-файл backup</span>
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {mode === "replace" ? (
          <p className="mutedText" style={{ marginTop: 12 }}>
            ⚠️ Replace повністю замінює дані активного профілю.
          </p>
        ) : null}

        {mode === "merge" ? (
          <p className="mutedText" style={{ marginTop: 12 }}>
            Merge додає дані в активний профіль без видалення існуючих.
            Дублікати пропускаються за правилами дедуплікації.
          </p>
        ) : null}

        <pre
          className="mutedText"
          style={{
            marginTop: 16,
            whiteSpace: "pre-wrap",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          {status || "Статус операцій backup з’явиться тут."}
        </pre>
      </section>

      <section className="card">
        <h2>Профілі</h2>

        {!profiles?.length ? (
          <div className="emptyState">Нема профілів</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Назва</th>
                <th>Активний</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.id === activeProfileId ? "✅" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
