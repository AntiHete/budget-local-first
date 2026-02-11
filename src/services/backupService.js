import { db } from "../db/db";

function nowISO() {
  return new Date().toISOString();
}

function tsForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function safeFilenamePart(s) {
  return String(s ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "profile";
}

export function buildAllBackupFilename() {
  return `backup_all_${tsForFilename()}.json`;
}

export function buildProfileBackupFilename(profile) {
  const name = safeFilenamePart(profile?.name ?? "profile");
  const id = profile?.id ?? "x";
  return `backup_profile_${name}_id${id}_${tsForFilename()}.json`;
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

/**
 * Pick a "source" profile from backup to import.
 * - If scope=profile and meta.profileId exists -> use it
 * - Else -> use first profile in data.profiles (if any)
 */
export function getSourceProfileFromBackup(parsedBackup) {
  const meta = parsedBackup?.meta ?? {};
  const profiles = parsedBackup?.data?.profiles ?? [];

  if (meta.scope === "profile" && meta.profileId != null) {
    return {
      sourceProfileId: meta.profileId,
      sourceProfileName: meta.profileName ?? (profiles?.[0]?.name ?? null),
      sourceScope: "profile",
    };
  }

  if (Array.isArray(profiles) && profiles.length > 0) {
    return {
      sourceProfileId: profiles[0].id,
      sourceProfileName: profiles[0].name ?? null,
      sourceScope: meta.scope ?? "unknown",
    };
  }

  return { sourceProfileId: null, sourceProfileName: null, sourceScope: meta.scope ?? "unknown" };
}

/**
 * Returns: { ok: boolean, warnings: string[], errors: string[] }
 * - errors => stop
 * - warnings => confirm
 */
export function analyzeBackupCompatibility(parsedBackup) {
  const errors = [];
  const warnings = [];

  if (!parsedBackup || typeof parsedBackup !== "object") {
    errors.push("Файл не є коректним JSON об'єктом.");
    return { ok: false, warnings, errors };
  }

  if (!parsedBackup.meta || !parsedBackup.data) {
    errors.push("Немає meta/data у backup файлі.");
    return { ok: false, warnings, errors };
  }

  if (parsedBackup.meta.app && parsedBackup.meta.app !== "budget-local-first") {
    errors.push(`Невірний app у meta: ${parsedBackup.meta.app}`);
  }

  if (parsedBackup.meta.schemaVersion == null) {
    warnings.push("Backup без schemaVersion (старий формат). Імпорт можливий, але обережно.");
  }

  const backupDbVersion = Number(parsedBackup.meta.dbVersion ?? NaN);
  if (Number.isFinite(backupDbVersion)) {
    if (backupDbVersion > db.verno) {
      warnings.push(
        `Backup створено з новішої версії БД (backup: ${backupDbVersion}, у вас: ${db.verno}). Деякі поля можуть не імпортуватись.`
      );
    }
  } else {
    warnings.push("У meta.dbVersion немає числа — не можу перевірити сумісність версії БД.");
  }

  const d = parsedBackup.data;
  const keys = ["profiles", "categories", "transactions", "budgets", "payments", "debts", "debtPayments"];
  for (const k of keys) {
    if (!Array.isArray(d[k])) {
      errors.push(`Невірна структура data.${k} (має бути масив).`);
    }
  }

  // If backup has multiple profiles - warn (merge will import only one)
  const profiles = d.profiles ?? [];
  if (Array.isArray(profiles) && profiles.length > 1) {
    warnings.push(
      "Backup містить кілька профілів. Імпорт/merge виконуватиметься лише для першого профілю з файлу (краще експортувати профіль окремо)."
    );
  }

  // If we cannot identify source profile id - error
  const { sourceProfileId } = getSourceProfileFromBackup(parsedBackup);
  if (sourceProfileId == null) {
    errors.push("Не можу визначити source profileId з backup (немає meta.profileId і data.profiles).");
  }

  return { ok: errors.length === 0, warnings, errors };
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
      schemaVersion: 1,
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
      schemaVersion: 1,
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

function round2(x) {
  return Math.round((Number(x ?? 0) * 100)) / 100;
}

function normStr(s) {
  return String(s ?? "").trim().toLowerCase();
}

function categoryKey(c) {
  return `${c.type || "expense"}|${normStr(c.name)}`;
}

function txKey(t) {
  const note = normStr(t.note);
  const cat = t.categoryId ? String(t.categoryId) : "";
  return `${t.date || ""}|${t.type || ""}|${round2(t.amount)}|${cat}|${note}`;
}

function debtKey(d) {
  return `${d.direction || ""}|${normStr(d.counterparty)}|${round2(d.principal)}|${d.startDate || ""}|${d.dueDate || ""}|${d.currency || "UAH"}`;
}

function budgetKey(b) {
  const cat = b.categoryId ? String(b.categoryId) : "";
  return `${b.month || ""}|${cat}`;
}

function paymentKey(p) {
  const title = normStr(p.title);
  const cat = p.categoryId ? String(p.categoryId) : "";
  return `${p.dueDate || ""}|${title}|${round2(p.amount)}|${p.status || "planned"}|${cat}`;
}

function debtPaymentKey(dp) {
  const note = normStr(dp.note);
  const debt = dp.debtId ? String(dp.debtId) : "";
  const tx = dp.transactionId ? String(dp.transactionId) : "";
  return `${debt}|${dp.date || ""}|${round2(dp.amount)}|${note}|${tx}`;
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
  const d = parsedBackup.data;
  const { sourceProfileId } = getSourceProfileFromBackup(parsedBackup);

  const sourceProfile = (d.profiles ?? []).find((p) => p.id === sourceProfileId) ?? d.profiles?.[0];
  const newName = `${sourceProfile?.name ?? "Imported"} (imported)`;
  const createdAt = nowISO();

  const srcCategories = (d.categories ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcTx = (d.transactions ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcBudgets = (d.budgets ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcPayments = (d.payments ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcDebts = (d.debts ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcDebtPayments = (d.debtPayments ?? []).filter((x) => x.profileId === sourceProfileId);

  let newProfileId = null;

  const categoryIdMap = new Map(); // old -> new
  const debtIdMap = new Map(); // old -> new
  const txIdMap = new Map(); // old -> new

  await db.transaction("rw", db.profiles, db.categories, db.transactions, db.budgets, db.payments, db.debts, db.debtPayments, async () => {
    newProfileId = await db.profiles.add({ name: newName, createdAt });

    for (const c of srcCategories) {
      const oldId = c.id;
      const newId = await db.categories.add({
        profileId: newProfileId,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt ?? createdAt,
      });
      if (oldId != null) categoryIdMap.set(oldId, newId);
    }

    for (const debt of srcDebts) {
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

    for (const t of srcTx) {
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

    for (const b of srcBudgets) {
      await db.budgets.add({
        profileId: newProfileId,
        month: b.month,
        categoryId: b.categoryId ? (categoryIdMap.get(b.categoryId) ?? null) : null,
        limit: b.limit,
      });
    }

    for (const p of srcPayments) {
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

    for (const dp of srcDebtPayments) {
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
 */
export async function replaceProfileFromBackup(profileId, parsedBackup) {
  const d = parsedBackup.data;
  const { sourceProfileId } = getSourceProfileFromBackup(parsedBackup);
  const createdAt = nowISO();

  const srcCategories = (d.categories ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcTx = (d.transactions ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcBudgets = (d.budgets ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcPayments = (d.payments ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcDebts = (d.debts ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcDebtPayments = (d.debtPayments ?? []).filter((x) => x.profileId === sourceProfileId);

  const categoryIdMap = new Map();
  const debtIdMap = new Map();
  const txIdMap = new Map();

  await db.transaction("rw", db.categories, db.transactions, db.budgets, db.payments, db.debts, db.debtPayments, async () => {
    await deleteProfileData(profileId);

    for (const c of srcCategories) {
      const oldId = c.id;
      const newId = await db.categories.add({
        profileId,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt ?? createdAt,
      });
      if (oldId != null) categoryIdMap.set(oldId, newId);
    }

    for (const debt of srcDebts) {
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

    for (const t of srcTx) {
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

    for (const b of srcBudgets) {
      await db.budgets.add({
        profileId,
        month: b.month,
        categoryId: b.categoryId ? (categoryIdMap.get(b.categoryId) ?? null) : null,
        limit: b.limit,
      });
    }

    for (const p of srcPayments) {
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

    for (const dp of srcDebtPayments) {
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

/**
 * MERGE import into ACTIVE profile WITHOUT deleting existing data.
 * Dedup rules:
 * - Categories: (type + name) reuse or create
 * - Transactions: (date,type,amount,categoryId,note) skip if exists (but map old->existing)
 * - Budgets: (month,categoryId) upsert (update limit)
 * - Payments: (dueDate,title,amount,status,categoryId) skip if exists
 * - Debts: key reuse or create
 * - DebtPayments: key skip if exists
 */
export async function mergeProfileFromBackup(profileId, parsedBackup) {
  const d = parsedBackup.data;
  const { sourceProfileId, sourceProfileName } = getSourceProfileFromBackup(parsedBackup);
  const createdAt = nowISO();

  const srcCategories = (d.categories ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcTx = (d.transactions ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcBudgets = (d.budgets ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcPayments = (d.payments ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcDebts = (d.debts ?? []).filter((x) => x.profileId === sourceProfileId);
  const srcDebtPayments = (d.debtPayments ?? []).filter((x) => x.profileId === sourceProfileId);

  const stats = {
    sourceProfileId,
    sourceProfileName: sourceProfileName ?? null,
    added: { categories: 0, transactions: 0, budgets: 0, payments: 0, debts: 0, debtPayments: 0 },
    updated: { budgets: 0 },
    skipped: { categories: 0, transactions: 0, budgets: 0, payments: 0, debts: 0, debtPayments: 0 },
  };

  await db.transaction("rw", db.categories, db.transactions, db.budgets, db.payments, db.debts, db.debtPayments, async () => {
    // Load existing data for active profile
    const [existingCats, existingTx, existingBudgets, existingPayments, existingDebts, existingDebtPays] = await Promise.all([
      db.categories.where("profileId").equals(profileId).toArray(),
      db.transactions.where("profileId").equals(profileId).toArray(),
      db.budgets.where("profileId").equals(profileId).toArray(),
      db.payments.where("profileId").equals(profileId).toArray(),
      db.debts.where("profileId").equals(profileId).toArray(),
      db.debtPayments.where("profileId").equals(profileId).toArray(),
    ]);

    // ---- Categories map (key -> id)
    const catKeyToId = new Map();
    for (const c of existingCats) catKeyToId.set(categoryKey(c), c.id);

    // oldCategoryId -> localCategoryId
    const categoryIdMap = new Map();
    for (const c of srcCategories) {
      const key = categoryKey(c);
      const existingId = catKeyToId.get(key);
      if (existingId) {
        categoryIdMap.set(c.id, existingId);
        stats.skipped.categories++;
      } else {
        const newId = await db.categories.add({
          profileId,
          type: c.type,
          name: c.name,
          createdAt: c.createdAt ?? createdAt,
        });
        catKeyToId.set(key, newId);
        categoryIdMap.set(c.id, newId);
        stats.added.categories++;
      }
    }

    // ---- Debts map (key -> id)
    const debtKeyToId = new Map();
    for (const debt of existingDebts) debtKeyToId.set(debtKey(debt), debt.id);

    const debtIdMap = new Map(); // oldDebtId -> localDebtId
    for (const debt of srcDebts) {
      const key = debtKey(debt);
      const existingId = debtKeyToId.get(key);
      if (existingId) {
        debtIdMap.set(debt.id, existingId);
        stats.skipped.debts++;
      } else {
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
        debtKeyToId.set(key, newId);
        debtIdMap.set(debt.id, newId);
        stats.added.debts++;
      }
    }

    // ---- Transactions map (key -> id)
    const txKeyToId = new Map();
    for (const t of existingTx) txKeyToId.set(txKey(t), t.id);

    const txIdMap = new Map(); // oldTxId -> localTxId (even if skipped)
    for (const t of srcTx) {
      const localCatId = t.categoryId ? (categoryIdMap.get(t.categoryId) ?? null) : null;
      const candidate = {
        date: t.date,
        type: t.type,
        amount: t.amount,
        categoryId: localCatId,
        note: t.note ?? null,
      };
      const key = txKey(candidate);
      const existingId = txKeyToId.get(key);

      if (existingId) {
        txIdMap.set(t.id, existingId);
        stats.skipped.transactions++;
      } else {
        const newId = await db.transactions.add({
          profileId,
          date: t.date,
          type: t.type,
          amount: t.amount,
          categoryId: localCatId,
          note: t.note ?? null,
          createdAt: t.createdAt ?? createdAt,
        });
        txKeyToId.set(key, newId);
        txIdMap.set(t.id, newId);
        stats.added.transactions++;
      }
    }

    // ---- Budgets upsert by (month, categoryId)
    const budgetKeyToId = new Map();
    for (const b of existingBudgets) budgetKeyToId.set(budgetKey(b), b.id);

    for (const b of srcBudgets) {
      const localCatId = b.categoryId ? (categoryIdMap.get(b.categoryId) ?? null) : null;
      const candidate = { month: b.month, categoryId: localCatId };
      const key = budgetKey(candidate);
      const existingId = budgetKeyToId.get(key);

      if (existingId) {
        // update limit to imported value (merge = keep current data but align limits)
        const existingObj = existingBudgets.find((x) => x.id === existingId);
        if (existingObj && existingObj.limit !== b.limit) {
          await db.budgets.update(existingId, { limit: b.limit });
          stats.updated.budgets++;
        } else {
          stats.skipped.budgets++;
        }
      } else {
        const newId = await db.budgets.add({
          profileId,
          month: b.month,
          categoryId: localCatId,
          limit: b.limit,
        });
        budgetKeyToId.set(key, newId);
        stats.added.budgets++;
      }
    }

    // ---- Payments dedup
    const paymentKeySet = new Set();
    for (const p of existingPayments) paymentKeySet.add(paymentKey(p));

    for (const p of srcPayments) {
      const localCatId = p.categoryId ? (categoryIdMap.get(p.categoryId) ?? null) : null;
      const candidate = {
        dueDate: p.dueDate,
        title: p.title,
        amount: p.amount,
        status: p.status ?? "planned",
        categoryId: localCatId,
      };
      const key = paymentKey(candidate);

      if (paymentKeySet.has(key)) {
        stats.skipped.payments++;
      } else {
        await db.payments.add({
          profileId,
          dueDate: p.dueDate,
          title: p.title,
          amount: p.amount,
          categoryId: localCatId,
          status: p.status ?? "planned",
          createdAt: p.createdAt ?? createdAt,
        });
        paymentKeySet.add(key);
        stats.added.payments++;
      }
    }

    // ---- DebtPayments dedup (after mapping debtId and transactionId)
    const debtPaymentKeySet = new Set();
    for (const dp of existingDebtPays) debtPaymentKeySet.add(debtPaymentKey(dp));

    for (const dp of srcDebtPayments) {
      const localDebtId = dp.debtId ? (debtIdMap.get(dp.debtId) ?? null) : null;
      const localTxId = dp.transactionId ? (txIdMap.get(dp.transactionId) ?? null) : null;

      const candidate = {
        debtId: localDebtId,
        transactionId: localTxId,
        date: dp.date,
        amount: dp.amount,
        note: dp.note ?? null,
      };
      const key = debtPaymentKey(candidate);

      if (debtPaymentKeySet.has(key)) {
        stats.skipped.debtPayments++;
      } else {
        await db.debtPayments.add({
          profileId,
          debtId: localDebtId,
          transactionId: localTxId,
          date: dp.date,
          amount: dp.amount,
          note: dp.note ?? null,
          createdAt: dp.createdAt ?? createdAt,
        });
        debtPaymentKeySet.add(key);
        stats.added.debtPayments++;
      }
    }
  });

  return stats;
}
