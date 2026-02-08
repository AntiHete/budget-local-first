import { db } from "../db/db";

function nowISO() {
  return new Date().toISOString();
}

function makeFilename(prefix) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${ts}.json`;
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export async function exportAllBackup() {
  const [profiles, categories, transactions, budgets, payments, debts, debtPayments] = await Promise.all([
    db.profiles.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.payments.toArray(),
    db.debts.toArray(),
    db.debtPayments.toArray(),
  ]);

  return {
    meta: {
      app: "budget-local-first",
      exportedAt: nowISO(),
      dbVersion: db.verno,
      scope: "all",
    },
    data: { profiles, categories, transactions, budgets, payments, debts, debtPayments },
  };
}

export async function exportProfileBackup(profileId) {
  const profile = await db.profiles.get(profileId);
  if (!profile) throw new Error("Profile not found");

  const [categories, transactions, budgets, payments, debts, debtPayments] = await Promise.all([
    db.categories.where("profileId").equals(profileId).toArray(),
    db.transactions.where("profileId").equals(profileId).toArray(),
    db.budgets.where("profileId").equals(profileId).toArray(),
    db.payments.where("profileId").equals(profileId).toArray(),
    db.debts.where("profileId").equals(profileId).toArray(),
    db.debtPayments.where("profileId").equals(profileId).toArray(),
  ]);

  return {
    meta: {
      app: "budget-local-first",
      exportedAt: nowISO(),
      dbVersion: db.verno,
      scope: "profile",
      profileId,
      profileName: profile.name,
    },
    data: {
      profiles: [profile],
      categories,
      transactions,
      budgets,
      payments,
      debts,
      debtPayments,
    },
  };
}

function validateBackupShape(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.meta || !obj.data) return false;
  const d = obj.data;
  const keys = ["profiles", "categories", "transactions", "budgets", "payments", "debts", "debtPayments"];
  for (const k of keys) if (!Array.isArray(d[k])) return false;
  return true;
}

export async function deleteProfileData(profileId) {
  await db.transaction("rw", db.categories, db.transactions, db.budgets, db.payments, db.debts, db.debtPayments, async () => {
    await db.categories.where("profileId").equals(profileId).delete();
    await db.transactions.where("profileId").equals(profileId).delete();
    await db.budgets.where("profileId").equals(profileId).delete();
    await db.payments.where("profileId").equals(profileId).delete();
    await db.debts.where("profileId").equals(profileId).delete();
    await db.debtPayments.where("profileId").equals(profileId).delete();
  });
}

/**
 * Import as a NEW profile (safe default).
 * Remaps:
 * - profileId
 * - categoryId
 * - debtId
 * - transactionId (for debtPayments)
 */
export async function importBackupAsNewProfile(parsedBackup) {
  if (!validateBackupShape(parsedBackup)) throw new Error("Invalid backup file");

  const d = parsedBackup.data;
  const sourceProfile = d.profiles?.[0];
  const newName = `${sourceProfile?.name ?? "Imported"} (imported)`;
  const createdAt = nowISO();

  let newProfileId = null;

  const categoryIdMap = new Map();   // old -> new
  const debtIdMap = new Map();       // old -> new
  const txIdMap = new Map();         // old -> new

  await db.transaction("rw", db.profiles, db.categories, db.transactions, db.budgets, db.payments, db.debts, db.debtPayments, async () => {
    newProfileId = await db.profiles.add({ name: newName, createdAt });

    // categories
    for (const c of d.categories) {
      const oldId = c.id;
      const newId = await db.categories.add({
        profileId: newProfileId,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt ?? createdAt,
      });
      if (oldId != null) categoryIdMap.set(oldId, newId);
    }

    // debts
    for (const debt of d.debts) {
      const oldId = debt.id;
      const newId = await db.debts.add({
        profileId: newProfileId,
        direction: debt.direction,
        counterparty: debt.counterparty,
        principal: debt.principal,
        currency: debt.currency ?? "UAH",
        startDate: debt.startDate,
        dueDate: debt.dueDate ?? null,
        status: debt.status ?? "active",
        createdAt: debt.createdAt ?? createdAt,
      });
      if (oldId != null) debtIdMap.set(oldId, newId);
    }

    // transactions
    for (const t of d.transactions) {
      const oldId = t.id;
      const newId = await db.transactions.add({
        profileId: newProfileId,
        date: t.date,
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null,
        note: t.note ?? null,
        createdAt: t.createdAt ?? createdAt,
      });
      if (oldId != null) txIdMap.set(oldId, newId);
    }

    // budgets
    for (const b of d.budgets) {
      await db.budgets.add({
        profileId: newProfileId,
        month: b.month,
        categoryId: b.categoryId ? (categoryIdMap.get(b.categoryId) ?? null) : null,
        limit: b.limit,
      });
    }

    // payments (planned/done)
    for (const p of d.payments) {
      await db.payments.add({
        profileId: newProfileId,
        dueDate: p.dueDate,
        title: p.title,
        amount: p.amount,
        categoryId: p.categoryId ? (categoryIdMap.get(p.categoryId) ?? null) : null,
        status: p.status ?? "planned",
        createdAt: p.createdAt ?? createdAt,
      });
    }

    // debtPayments (link remap)
    for (const dp of d.debtPayments) {
      await db.debtPayments.add({
        profileId: newProfileId,
        debtId: dp.debtId ? (debtIdMap.get(dp.debtId) ?? null) : null,
        transactionId: dp.transactionId ? (txIdMap.get(dp.transactionId) ?? null) : null,
        date: dp.date,
        amount: dp.amount,
        note: dp.note ?? null,
        createdAt: dp.createdAt ?? createdAt,
      });
    }
  });

  return { newProfileId, newName };
}

/**
 * Replace ACTIVE profile data from backup (dangerous).
 * Keeps the same profile id, deletes its existing data, imports backup content into it.
 */
export async function replaceProfileFromBackup(profileId, parsedBackup) {
  if (!validateBackupShape(parsedBackup)) throw new Error("Invalid backup file");

  const d = parsedBackup.data;
  const createdAt = nowISO();

  const categoryIdMap = new Map();
  const debtIdMap = new Map();
  const txIdMap = new Map();

  await db.transaction("rw", db.categories, db.transactions, db.budgets, db.payments, db.debts, db.debtPayments, async () => {
    await deleteProfileData(profileId);

    // categories
    for (const c of d.categories) {
      const oldId = c.id;
      const newId = await db.categories.add({
        profileId,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt ?? createdAt,
      });
      if (oldId != null) categoryIdMap.set(oldId, newId);
    }

    // debts
    for (const debt of d.debts) {
      const oldId = debt.id;
      const newId = await db.debts.add({
        profileId,
        direction: debt.direction,
        counterparty: debt.counterparty,
        principal: debt.principal,
        currency: debt.currency ?? "UAH",
        startDate: debt.startDate,
        dueDate: debt.dueDate ?? null,
        status: debt.status ?? "active",
        createdAt: debt.createdAt ?? createdAt,
      });
      if (oldId != null) debtIdMap.set(oldId, newId);
    }

    // transactions
    for (const t of d.transactions) {
      const oldId = t.id;
      const newId = await db.transactions.add({
        profileId,
        date: t.date,
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null,
        note: t.note ?? null,
        createdAt: t.createdAt ?? createdAt,
      });
      if (oldId != null) txIdMap.set(oldId, newId);
    }

    // budgets
    for (const b of d.budgets) {
      await db.budgets.add({
        profileId,
        month: b.month,
        categoryId: b.categoryId ? (categoryIdMap.get(b.categoryId) ?? null) : null,
        limit: b.limit,
      });
    }

    // payments
    for (const p of d.payments) {
      await db.payments.add({
        profileId,
        dueDate: p.dueDate,
        title: p.title,
        amount: p.amount,
        categoryId: p.categoryId ? (categoryIdMap.get(p.categoryId) ?? null) : null,
        status: p.status ?? "planned",
        createdAt: p.createdAt ?? createdAt,
      });
    }

    // debtPayments
    for (const dp of d.debtPayments) {
      await db.debtPayments.add({
        profileId,
        debtId: dp.debtId ? (debtIdMap.get(dp.debtId) ?? null) : null,
        transactionId: dp.transactionId ? (txIdMap.get(dp.transactionId) ?? null) : null,
        date: dp.date,
        amount: dp.amount,
        note: dp.note ?? null,
        createdAt: dp.createdAt ?? createdAt,
      });
    }
  });

  return { profileId };
}
