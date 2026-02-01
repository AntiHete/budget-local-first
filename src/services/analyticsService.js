import { db } from "../db/db";
import { monthBounds } from "./dateService";

/**
 * Returns expense breakdown for a month:
 * [{ name: "Продукти", value: 1234.5 }, ...]
 */
export async function getMonthlyExpenseByCategory(profileId, month) {
  const { from, to } = monthBounds(month);

  const txs = await db.transactions
    .where("profileId")
    .equals(profileId)
    .and((t) => t.type === "expense" && t.date >= from && t.date <= to)
    .toArray();

  // categoryId -> sum
  const sums = new Map();
  for (const t of txs) {
    if (!t.categoryId) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + (t.amount ?? 0));
  }

  // categoryId -> name
  const cats = await db.categories.where({ profileId, type: "expense" }).toArray();
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  // build result
  const result = [];
  for (const [catId, value] of sums.entries()) {
    result.push({
      name: catName.get(catId) ?? "—",
      value: Math.round(value * 100) / 100,
    });
  }

  result.sort((a, b) => b.value - a.value);
  return result;
}

/**
 * Returns daily flow for month:
 * [{ day: "01", income: 1000, expense: 400 }, ...]
 */
export async function getMonthlyDailyFlow(profileId, month) {
  const { from, to } = monthBounds(month);

  const txs = await db.transactions
    .where("profileId")
    .equals(profileId)
    .and((t) => t.date >= from && t.date <= to)
    .toArray();

  const map = new Map(); // day -> { income, expense }
  for (const t of txs) {
    const day = (t.date ?? "").slice(8, 10); // "DD"
    if (!day) continue;

    const cur = map.get(day) ?? { income: 0, expense: 0 };
    if (t.type === "income") cur.income += t.amount ?? 0;
    else cur.expense += t.amount ?? 0;

    map.set(day, cur);
  }

  // build day list 01..31 (simple approach)
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const key = String(d).padStart(2, "0");
    const v = map.get(key) ?? { income: 0, expense: 0 };
    out.push({
      day: key,
      income: Math.round(v.income * 100) / 100,
      expense: Math.round(v.expense * 100) / 100,
    });
  }

  return out;
}
