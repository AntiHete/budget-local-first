import { db } from "../db/db";
import { monthBounds, clampPct } from "./dateService";

/** Map categoryId -> spent (expenses only) for month */
export async function getSpentByCategoryForMonth(profileId, month) {
  const { from, to } = monthBounds(month);

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
  return map;
}

/** Get budgets for month for profile */
export async function getBudgetsForMonth(profileId, month) {
  const list = await db.budgets.where({ profileId, month }).toArray();
  list.sort((a, b) => (a.categoryId ?? 0) - (b.categoryId ?? 0));
  return list;
}

/** Build top budget alerts: most used budgets first */
export async function getBudgetAlerts(profileId, month, top = 3) {
  const budgets = await getBudgetsForMonth(profileId, month);
  const cats = await db.categories.where({ profileId, type: "expense" }).toArray();
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const spentByCat = await getSpentByCategoryForMonth(profileId, month);

  const items = budgets.map((b) => {
    const spent = spentByCat.get(b.categoryId) ?? 0;
    const pct = clampPct((spent / (b.limit || 1)) * 100);

    let status = "OK";
    if (spent >= b.limit) status = "Перевищено";
    else if (pct >= 80) status = "Майже";

    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      category: catName.get(b.categoryId) ?? "—",
      spent,
      limit: b.limit,
      pct,
      status,
    };
  });

  items.sort((a, b) => b.pct - a.pct);
  return items.slice(0, top);
}
