import { db } from "../db/db";

/**
 * Helpers
 */
function ymToDateRange(ym) {
  return { from: `${ym}-01`, to: `${ym}-31` };
}

function addMonths(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function round2(x) {
  return Math.round((x ?? 0) * 100) / 100;
}

/**
 * Base forecast: rolling average (3 months) for expenses by category
 * Returns:
 * {
 *   months: [m1, m2, m3],
 *   nextMonth: "YYYY-MM",
 *   rows: [{ categoryId, name, m1, m2, m3, avg, forecast }]
 * }
 */
export async function forecastExpenseByCategory(profileId, baseMonth, windowMonths = 3) {
  const months = [];
  for (let i = windowMonths; i >= 1; i--) {
    months.push(addMonths(baseMonth, -i));
  }
  const nextMonth = addMonths(baseMonth, 1);

  // categories (expense)
  const cats = await db.categories.where({ profileId, type: "expense" }).toArray();
  cats.sort((a, b) => a.name.localeCompare(b.name));

  // month -> (categoryId -> sum)
  const sumsByMonth = new Map();

  for (const m of months) {
    const { from, to } = ymToDateRange(m);

    const txs = await db.transactions
      .where("profileId")
      .equals(profileId)
      .and((t) => t.type === "expense" && t.date >= from && t.date <= to)
      .toArray();

    const map = new Map();
    for (const t of txs) {
      if (!t.categoryId) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + (t.amount ?? 0));
    }
    sumsByMonth.set(m, map);
  }

  const rows = cats.map((c) => {
    const values = months.map((m) => sumsByMonth.get(m)?.get(c.id) ?? 0);
    const avg = values.reduce((s, v) => s + v, 0) / months.length;
    const roundedAvg = round2(avg);

    return {
      categoryId: c.id,
      name: c.name,
      m1: round2(values[0]),
      m2: round2(values[1]),
      m3: round2(values[2]),
      avg: roundedAvg,
      forecast: roundedAvg,
    };
  });

  rows.sort((a, b) => b.forecast - a.forecast);

  return { months, nextMonth, rows };
}

/**
 * Apply a scenario to a base forecast.
 *
 * scenario:
 * {
 *   enabled: boolean,
 *   type: "expense" | "income",
 *   month: "YYYY-MM",       // month affected (we use nextMonth in UI)
 *   categoryId?: number|null,
 *   amount: number
 * }
 *
 * Rules:
 * - If type = "expense": add amount to forecast (by category if provided, else to "Без категорії")
 * - If type = "income": doesn't change category forecast (expenses), but returns netImpact for dashboard info
 */
export function applyScenarioToForecast(baseForecast, scenario) {
  if (!baseForecast) return null;

  const out = {
    ...baseForecast,
    rows: baseForecast.rows.map((r) => ({ ...r })),
    scenarioInfo: {
      enabled: false,
      netImpact: 0,
      appliedToCategory: null,
    },
  };

  if (!scenario?.enabled) return out;
  if (!scenario.amount || !Number.isFinite(scenario.amount)) return out;

  const amount = round2(scenario.amount);

  // We expect scenario.month to be baseForecast.nextMonth
  // But we keep it generic.
  if (scenario.type === "income") {
    out.scenarioInfo = {
      enabled: true,
      netImpact: +amount,
      appliedToCategory: null,
    };
    return out;
  }

  // expense scenario
  const catId = scenario.categoryId ? Number(scenario.categoryId) : null;

  if (catId) {
    const row = out.rows.find((r) => r.categoryId === catId);
    if (row) {
      row.forecast = round2(row.forecast + amount);
      out.scenarioInfo = {
        enabled: true,
        netImpact: -amount,
        appliedToCategory: row.name,
      };
      out.rows.sort((a, b) => b.forecast - a.forecast);
      return out;
    }
  }

  // If no category selected or category not found: add a synthetic row
  out.rows.push({
    categoryId: -1,
    name: "Сценарій (без категорії)",
    m1: 0,
    m2: 0,
    m3: 0,
    avg: 0,
    forecast: amount,
  });

  out.scenarioInfo = {
    enabled: true,
    netImpact: -amount,
    appliedToCategory: "Сценарій (без категорії)",
  };

  out.rows.sort((a, b) => b.forecast - a.forecast);
  return out;
}
