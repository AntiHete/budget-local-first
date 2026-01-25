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

/** Add a payment to a debt */
export async function addDebtPayment({ profileId, debtId, date, amount, note = null }) {
  const now = new Date().toISOString();

  await db.debtPayments.add({
    profileId,
    debtId,
    date,
    amount,
    note,
    createdAt: now,
  });

  // Після додавання платежу — оновимо статус боргу
  await recalcDebtStatus(profileId, debtId);
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

  // Підтягнемо всі платежі одним запитом
  const payments = await db.debtPayments.where("profileId").equals(profileId).toArray();
  const payByDebt = new Map();
  for (const p of payments) {
    payByDebt.set(p.debtId, (payByDebt.get(p.debtId) ?? 0) + (p.amount ?? 0));
  }

  const today = todayISO();

  const result = debts.map((d) => {
    const paid = payByDebt.get(d.id) ?? 0;
    const remaining = Math.max(0, (d.principal ?? 0) - paid);

    let status = d.status;
    // Безпечна авто-логіка: якщо статус застарів — підкажемо UI (але не пишемо в DB тут)
    if (remaining <= 0.000001) status = "closed";
    else if (d.dueDate && d.dueDate < today) status = "overdue";
    else status = "active";

    return { ...d, paid, remaining, computedStatus: status };
  });

  // Сортування: overdue -> active -> closed, потім за dueDate
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

/** Delete payment */
export async function deleteDebtPayment(profileId, paymentId) {
  const p = await db.debtPayments.get(paymentId);
  if (!p || p.profileId !== profileId) return;
  await db.debtPayments.delete(paymentId);
  await recalcDebtStatus(profileId, p.debtId);
}
