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

/**
 * Returns forecast for expenses by category:
 * {
 *   months: [m1, m2, m3],   // last 3 months used
 *   nextMonth: "YYYY-MM",
 *   rows: [
 *     { categoryId, name, m1, m2, m3, avg, forecast },
 *     ...
 *   ]
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
    const roundedAvg = Math.round(avg * 100) / 100;

    return {
      categoryId: c.id,
      name: c.name,
      // dynamic month keys by order
      m1: Math.round(values[0] * 100) / 100,
      m2: Math.round(values[1] * 100) / 100,
      m3: Math.round(values[2] * 100) / 100,
      avg: roundedAvg,
      forecast: roundedAvg,
    };
  });

  // sort by forecast desc
  rows.sort((a, b) => b.forecast - a.forecast);

  return { months, nextMonth, rows };
}
