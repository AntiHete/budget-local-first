import { db } from "../db/db";
import { todayISO } from "./dateService";

/** Create debt */
export async function createDebt({
  profileId,
  direction,
  counterparty,
  principal,
  currency = "UAH",
  startDate,
  dueDate = null,
}) {
  const now = new Date().toISOString();

  const id = await db.debts.add({
    profileId,
    direction,
    counterparty,
    principal,
    currency,
    startDate,
    dueDate,
    status: "active",
    createdAt: now,
  });

  return id;
}

/**
 * Add a payment to a debt (optionally creates a transaction).
 * - direction = "i_owe"      => transaction type = "expense"
 * - direction = "owed_to_me" => transaction type = "income"
 */
export async function addDebtPayment({
  profileId,
  debtId,
  date,
  amount,
  note = null,
  createTransaction = false,
  txCategoryId = null,
}) {
  const now = new Date().toISOString();

  const debt = await db.debts.get(debtId);
  if (!debt || debt.profileId !== profileId) {
    throw new Error("Debt not found for active profile");
  }

  // 1) optionally create a transaction
  let createdTxId = null;

  if (createTransaction) {
    const txType = debt.direction === "i_owe" ? "expense" : "income";

    createdTxId = await db.transactions.add({
      profileId,
      date,
      type: txType,
      amount,
      categoryId: txCategoryId ? Number(txCategoryId) : null,
      note: note ? `[Debt] ${note}` : "[Debt] payment",
      createdAt: now,
    });
  }

  // 2) save debt payment with transactionId link
  await db.debtPayments.add({
    profileId,
    debtId,
    transactionId: createdTxId,
    date,
    amount,
    note,
    createdAt: now,
  });

  // 3) recalc status
  await recalcDebtStatus(profileId, debtId);

  return { createdTxId };
}

/** Calculate remaining + update status */
export async function recalcDebtStatus(profileId, debtId) {
  const debt = await db.debts.get(debtId);
  if (!debt || debt.profileId !== profileId) return;

  const payments = await db.debtPayments.where({ profileId, debtId }).toArray();
  const paid = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const remaining = Math.max(0, (debt.principal ?? 0) - paid);

  let status = "active";
  if (remaining <= 0.000001) status = "closed";
  else if (debt.dueDate && debt.dueDate < todayISO()) status = "overdue";

  await db.debts.update(debtId, { status });
  return { remaining, paid, status };
}

/** Get debts with computed stats (remaining/paid) */
export async function getDebtsWithStats(profileId) {
  const debts = await db.debts.where("profileId").equals(profileId).toArray();

  // Fetch all payments in one go
  const payments = await db.debtPayments.where("profileId").equals(profileId).toArray();
  const payByDebt = new Map();
  for (const p of payments) {
    payByDebt.set(p.debtId, (payByDebt.get(p.debtId) ?? 0) + (p.amount ?? 0));
  }

  const today = todayISO();

  const result = debts.map((d) => {
    const paid = payByDebt.get(d.id) ?? 0;
    const remaining = Math.max(0, (d.principal ?? 0) - paid);

    // compute fresh status for UI safety
    let status = d.status;
    if (remaining <= 0.000001) status = "closed";
    else if (d.dueDate && d.dueDate < today) status = "overdue";
    else status = "active";

    return { ...d, paid, remaining, computedStatus: status };
  });

  // Sort: overdue -> active -> closed, then by dueDate
  const order = { overdue: 0, active: 1, closed: 2 };
  result.sort((a, b) => {
    const sa = order[a.computedStatus] ?? 9;
    const sb = order[b.computedStatus] ?? 9;
    if (sa !== sb) return sa - sb;
    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });

  return result;
}

/** Get payments for a debt */
export async function getDebtPayments(profileId, debtId) {
  const list = await db.debtPayments.where({ profileId, debtId }).toArray();
  list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return list;
}

/** Delete debt (and its payments) */
export async function deleteDebt(profileId, debtId) {
  await db.transaction("rw", db.debtPayments, db.debts, async () => {
    await db.debtPayments.where({ profileId, debtId }).delete();
    await db.debts.delete(debtId);
  });
}

/**
 * Delete a debt payment.
 * If it has transactionId, asks whether to delete the linked transaction too.
 */
export async function deleteDebtPayment(profileId, paymentId) {
  const p = await db.debtPayments.get(paymentId);
  if (!p || p.profileId !== profileId) return;

  const linkedTx = p.transactionId ? await db.transactions.get(p.transactionId) : null;
  const deleteLinkedTx = linkedTx ? window.confirm("Також видалити пов’язану транзакцію?") : false;

  await db.transaction("rw", db.debtPayments, db.transactions, async () => {
    await db.debtPayments.delete(paymentId);
    if (deleteLinkedTx && p.transactionId) {
      await db.transactions.delete(p.transactionId);
    }
  });

  await recalcDebtStatus(profileId, p.debtId);
}
