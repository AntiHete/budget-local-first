import { db } from "../db/db";

export const ACCOUNT_TYPES = [
  { value: "cash", label: "Готівка" },
  { value: "card", label: "Картка" },
  { value: "bank", label: "Банк" },
  { value: "savings", label: "Заощадження" },
  { value: "other", label: "Інше" },
];

export async function ensureDefaultAccount(profileId) {
  if (!profileId) return null;

  const accounts = await db.accounts.where("profileId").equals(profileId).toArray();
  let currentDefault = accounts.find((a) => a.isDefault);

  if (currentDefault) return currentDefault;

  if (accounts.length > 0) {
    const first = accounts[0];
    await db.accounts.update(first.id, {
      isDefault: true,
      updatedAt: new Date().toISOString(),
    });
    return { ...first, isDefault: true };
  }

  const now = new Date().toISOString();
  const id = await db.accounts.add({
    profileId,
    name: "Основний рахунок",
    type: "cash",
    currency: "UAH",
    openingBalance: 0,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });

  return db.accounts.get(id);
}

export async function setDefaultAccount(profileId, accountId) {
  await db.transaction("rw", db.accounts, async () => {
    const accounts = await db.accounts.where("profileId").equals(profileId).toArray();
    const now = new Date().toISOString();

    for (const account of accounts) {
      await db.accounts.update(account.id, {
        isDefault: account.id === accountId,
        updatedAt: now,
      });
    }
  });
}

export async function createLocalAccount(profileId, input) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Назва рахунку обов’язкова");

  const currency = String(input.currency ?? "UAH").trim().toUpperCase();
  const openingBalance = Number(input.openingBalance ?? 0);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    throw new Error("Початковий баланс має бути невід’ємним числом");
  }

  const existing = await db.accounts.where("profileId").equals(profileId).toArray();
  const shouldBeDefault = Boolean(input.isDefault) || existing.length === 0;

  const now = new Date().toISOString();

  if (shouldBeDefault) {
    await setDefaultAccount(profileId, -1);
  }

  const id = await db.accounts.add({
    profileId,
    name,
    type: input.type || "cash",
    currency,
    openingBalance,
    isDefault: shouldBeDefault,
    createdAt: now,
    updatedAt: now,
  });

  if (shouldBeDefault) {
    await setDefaultAccount(profileId, id);
  }

  return db.accounts.get(id);
}

export async function deleteLocalAccount(profileId, accountId) {
  const account = await db.accounts.get(accountId);
  if (!account || account.profileId !== profileId) {
    throw new Error("Рахунок не знайдено");
  }

  const linked = await db.transactions
    .where("profileId")
    .equals(profileId)
    .filter((t) => t.accountId === accountId)
    .count();

  if (linked > 0) {
    throw new Error("Не можна видалити рахунок, до якого прив’язані транзакції");
  }

  await db.accounts.delete(accountId);

  if (account.isDefault) {
    const fallback = await db.accounts.where("profileId").equals(profileId).first();
    if (fallback) {
      await setDefaultAccount(profileId, fallback.id);
    }
  }
}