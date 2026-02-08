import { db } from "../db/db";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, days) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function round2(x) {
  return Math.round((x ?? 0) * 100) / 100;
}

/**
 * Compute current balance for profile as:
 * sum(income) - sum(expense)
 */
export async function getCurrentBalance(profileId) {
  const txs = await db.transactions.where("profileId").equals(profileId).toArray();
  let inc = 0;
  let exp = 0;
  for (const t of txs) {
    if (t.type === "income") inc += t.amount ?? 0;
    else exp += t.amount ?? 0;
  }
  return round2(inc - exp);
}

/**
 * Cash-flow forecast for N days starting today.
 *
 * scenario (optional):
 * {
 *   enabled: boolean,
 *   type: "expense" | "income",
 *   amount: number,
 *   date: "YYYY-MM-DD"
 * }
 *
 * - Applies transactions by date
 * - Applies planned payments by dueDate as expense
 * - Applies scenario as extra delta on scenario.date (no DB write)
 *
 * Returns:
 * {
 *  startDate,
 *  days,
 *  startBalance,
 *  points: [{ date, deltaIncome, deltaExpense, deltaPlannedPayments, deltaScenario, balance }]
 * }
 */
export async function buildCashflowForecast(profileId, days = 30, scenario = null) {
  const startDate = todayISO();
  const startBalance = await getCurrentBalance(profileId);

  // Load all transactions for profile once
  const txs = await db.transactions.where("profileId").equals(profileId).toArray();

  // date -> { income, expense }
  const txByDate = new Map();
  for (const t of txs) {
    const date = t.date;
    if (!date) continue;
    const cur = txByDate.get(date) ?? { income: 0, expense: 0 };
    if (t.type === "income") cur.income += t.amount ?? 0;
    else cur.expense += t.amount ?? 0;
    txByDate.set(date, cur);
  }

  // planned payments for profile
  const pays = await db.payments.where({ profileId, status: "planned" }).toArray();

  // date -> sum(payments)
  const payByDate = new Map();
  for (const p of pays) {
    const date = p.dueDate;
    if (!date) continue;
    payByDate.set(date, (payByDate.get(date) ?? 0) + (p.amount ?? 0));
  }

  // Scenario: inject virtual delta for a specific date (no DB write)
  let scenarioDate = null;
  let scenarioDelta = 0; // +income or -expense
  if (scenario?.enabled) {
    const amt = Number(scenario.amount);
    const dt = String(scenario.date ?? "");
    if (Number.isFinite(amt) && amt > 0 && dt.length === 10) {
      scenarioDate = dt;
      scenarioDelta = scenario.type === "income" ? +amt : -amt;
      scenarioDelta = round2(scenarioDelta);
    }
  }

  // Build timeline
  const points = [];
  let balance = startBalance;

  for (let i = 0; i < days; i++) {
    const date = addDaysISO(startDate, i);

    const tx = txByDate.get(date) ?? { income: 0, expense: 0 };
    const planned = payByDate.get(date) ?? 0;

    const deltaIncome = round2(tx.income);
    const deltaExpense = round2(tx.expense);
    const deltaPlannedPayments = round2(planned);

    const deltaScenario = date === scenarioDate ? scenarioDelta : 0;

    // apply: balance += income - expense - plannedPayments + scenarioDelta
    balance = round2(balance + deltaIncome - deltaExpense - deltaPlannedPayments + deltaScenario);

    points.push({
      date,
      deltaIncome,
      deltaExpense,
      deltaPlannedPayments,
      deltaScenario,
      balance,
    });
  }

  return { startDate, days, startBalance, points, scenarioAppliedDate: scenarioDate };
}
