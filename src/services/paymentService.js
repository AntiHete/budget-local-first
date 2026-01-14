import { db } from "../db/db";
import { todayISO } from "./dateService";

/** Отримати найближчі заплановані платежі */
export async function getUpcomingPayments(profileId, limit = 5) {
  const planned = await db.payments.where({ profileId, status: "planned" }).toArray();
  planned.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  return planned.slice(0, limit);
}

/** Чи прострочений платіж */
export function isPaymentOverdue(payment) {
  const today = todayISO();
  return payment.status === "planned" && (payment.dueDate || "") < today;
}
