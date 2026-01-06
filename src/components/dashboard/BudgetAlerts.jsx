import React, { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

function currentMonth() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function monthBounds(month) {
  return { from: `${month}-01`, to: `${month}-31` };
}

function clampPct(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

export default function BudgetAlerts() {
  const { activeProfileId } = useProfile();
  const month = currentMonth();

  const data = useLiveQuery(async () => {
    if (!activeProfileId) return { items: [], month };

    const budgets = await db.budgets.where({ profileId: activeProfileId, month }).toArray();
    const cats = await db.categories.where({ profileId: activeProfileId, type: "expense" }).toArray();
    const catName = new Map(cats.map((c) => [c.id, c.name]));

    const { from, to } = monthBounds(month);
    const txs = await db.transactions
      .where("profileId")
      .equals(activeProfileId)
      .and((t) => t.type === "expense" && t.date >= from && t.date <= to)
      .toArray();

    const spentByCat = new Map();
    for (const t of txs) {
      if (!t.categoryId) continue;
      spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + (t.amount ?? 0));
    }

    const items = budgets.map((b) => {
      const spent = spentByCat.get(b.categoryId) ?? 0;
      const pct = clampPct((spent / (b.limit || 1)) * 100);
      return {
        id: b.id,
        category: catName.get(b.categoryId) ?? "—",
        spent,
        limit: b.limit,
        pct,
      };
    });

    items.sort((a, b) => b.pct - a.pct);
    return { items: items.slice(0, 3), month };
  }, [activeProfileId, month]);

  const has = (data?.items?.length ?? 0) > 0;

  return (
    <div className="card">
      <h2>Бюджети “на межі”</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Місяць: {data?.month}</div>

      {!has && <div className="muted">Нема бюджетів на цей місяць або витрат</div>}

      {has && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.items.map((i) => {
            const status = i.spent >= i.limit ? "Перевищено" : i.pct >= 80 ? "Майже" : "OK";
            return (
              <div key={i.id}>
                <div className="rowBetween">
                  <div>
                    <strong>{i.category}</strong> <span className="badge">{status}</span>
                  </div>
                  <div className="muted">{Math.round(i.pct)}%</div>
                </div>
                <div className="progress" title={`${Math.round(i.pct)}%`}>
                  <div className="progressFill" style={{ width: `${i.pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
