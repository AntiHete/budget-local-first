import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import {
  ACCOUNT_TYPES,
  createLocalAccount,
  deleteLocalAccount,
  ensureDefaultAccount,
  setDefaultAccount,
} from "../services/accountLocalService";

function fmtMoney(x, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(x ?? 0);
}

export default function AccountsPage() {
  const { activeProfileId } = useProfile();

  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    type: "cash",
    currency: "UAH",
    openingBalance: "",
    isDefault: false,
  });

  useEffect(() => {
    if (!activeProfileId) return;
    ensureDefaultAccount(activeProfileId).catch((e) =>
      setError(String(e?.message ?? e))
    );
  }, [activeProfileId]);

  const accounts = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const items = await db.accounts.where("profileId").equals(activeProfileId).toArray();
    items.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return items;
  }, [activeProfileId]);

  const transactions = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return db.transactions.where("profileId").equals(activeProfileId).toArray();
  }, [activeProfileId]);

  const balances = useMemo(() => {
    const map = new Map();

    for (const account of accounts ?? []) {
      map.set(account.id, Number(account.openingBalance ?? 0));
    }

    for (const tx of transactions ?? []) {
      if (tx.accountId == null) continue;
      const current = map.get(tx.accountId) ?? 0;
      const delta = tx.type === "income" ? Number(tx.amount ?? 0) : -Number(tx.amount ?? 0);
      map.set(tx.accountId, current + delta);
    }

    return map;
  }, [accounts, transactions]);

  async function onCreate(e) {
    e.preventDefault();
    if (!activeProfileId) return;

    setWorking(true);
    setError("");

    try {
      await createLocalAccount(activeProfileId, {
        name: form.name,
        type: form.type,
        currency: form.currency,
        openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
        isDefault: form.isDefault,
      });

      setForm({
        name: "",
        type: "cash",
        currency: "UAH",
        openingBalance: "",
        isDefault: false,
      });
    } catch (e2) {
      setError(String(e2?.message ?? e2));
    } finally {
      setWorking(false);
    }
  }

  async function onMakeDefault(accountId) {
    if (!activeProfileId) return;
    setWorking(true);
    setError("");

    try {
      await setDefaultAccount(activeProfileId, accountId);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function onDelete(accountId) {
    if (!activeProfileId) return;
    const ok = window.confirm("Видалити рахунок?");
    if (!ok) return;

    setWorking(true);
    setError("");

    try {
      await deleteLocalAccount(activeProfileId, accountId);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Рахунки / гаманці</h1>
        <p>Кожна транзакція тепер може бути прив’язана до конкретного рахунку.</p>
      </section>

      <section className="card">
        <h2>Додати рахунок</h2>

        <form onSubmit={onCreate} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Назва</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={working}
              placeholder="Напр. Monobank / Готівка"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Тип</span>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              disabled={working}
            >
              {ACCOUNT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Валюта</span>
            <input
              type="text"
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              disabled={working}
              placeholder="UAH"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Початковий баланс</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.openingBalance}
              onChange={(e) => setForm((prev) => ({ ...prev, openingBalance: e.target.value }))}
              disabled={working}
              placeholder="0"
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              disabled={working}
            />
            <span>Зробити основним рахунком</span>
          </label>

          <div>
            <button type="submit" disabled={working || !form.name.trim()}>
              Створити рахунок
            </button>
          </div>
        </form>

        {error ? <div style={{ color: "crimson", marginTop: 12 }}>{error}</div> : null}
      </section>

      <section className="card">
        <h2>Список рахунків</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {(accounts ?? []).map((account) => (
            <div
              key={account.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {account.name} {account.isDefault ? "(основний)" : ""}
              </div>
              <div>Тип: {account.type}</div>
              <div>Валюта: {account.currency}</div>
              <div>Початковий баланс: {fmtMoney(account.openingBalance ?? 0, account.currency)}</div>
              <div>Поточний баланс: {fmtMoney(balances.get(account.id) ?? 0, account.currency)}</div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => onMakeDefault(account.id)}
                  disabled={working || account.isDefault}
                >
                  Зробити основним
                </button>

                <button
                  onClick={() => onDelete(account.id)}
                  disabled={working}
                  style={{ border: "1px solid #f4433633" }}
                >
                  Видалити
                </button>
              </div>
            </div>
          ))}

          {!(accounts ?? []).length ? <div>Ще немає рахунків.</div> : null}
        </div>
      </section>
    </div>
  );
}