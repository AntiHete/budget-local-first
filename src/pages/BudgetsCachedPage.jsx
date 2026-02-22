import { useMemo, useState } from "react";
import { useCachedBudgets } from "../hooks/useCachedBudgets";

function currentMonth() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export default function BudgetsCachedPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const { items, loading, syncing, error, upsert, remove, profileId } = useCachedBudgets({ month });

  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("0");

  const totalLimit = useMemo(() => items.reduce((a, b) => a + (b.limitCents || 0), 0), [items]);
  const totalSpent = useMemo(() => items.reduce((a, b) => a + (b.spentCents || 0), 0), [items]);

  const onSave = async () => {
    const limitNum = Number(limit);
    if (!Number.isFinite(limitNum) || limitNum < 0) return;

    await upsert({
      month,
      category: category.trim(),
      limitCents: Math.round(limitNum * 100),
      currency: "UAH",
    });

    setCategory("");
    setLimit("0");
  };

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Budgets (API + Dexie cache)</h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Active profileId: <code>{profileId ?? "—"}</code>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="YYYY-MM" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
        <input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Limit (UAH)" inputMode="decimal" />
        <button onClick={onSave} disabled={syncing || !category.trim()}>Upsert</button>
      </div>

      {error ? <div style={{ color: "crimson", marginBottom: 12 }}>{String(error?.message ?? error)}</div> : null}

      <div style={{ marginBottom: 12 }}>
        {loading ? "Loading…" : `Count: ${items.length}`} | Sync: {syncing ? "…" : "ok"} | Total limit:{" "}
        {(totalLimit / 100).toFixed(2)} UAH | Total spent: {(totalSpent / 100).toFixed(2)} UAH
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items
          .slice()
          .sort((a, b) => (a.category > b.category ? 1 : a.category < b.category ? -1 : 0))
          .map((b) => (
            <div key={b.key} style={{ border: "1px solid #3333", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600 }}>
                {b.month} • {b.category}
              </div>
              <div style={{ opacity: 0.8 }}>
                Limit: {(b.limitCents / 100).toFixed(2)} {b.currency} | Spent: {(b.spentCents / 100).toFixed(2)}{" "}
                {b.currency} | Used: {b.percentUsed}%
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                Remaining: {(b.remainingCents / 100).toFixed(2)} {b.currency}
              </div>

              <div style={{ marginTop: 8 }}>
                <button onClick={() => remove(b.key)} disabled={syncing}>Delete</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}