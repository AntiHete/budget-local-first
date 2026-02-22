import { useMemo, useState } from "react";
import { useSyncedTransactions } from "../hooks/useSyncedTransactions";

export default function TransactionsSyncedPage() {
  const { items, loading, syncing, error, add, remove, sync, profileId } =
    useSyncedTransactions({ limit: 200 });

  const [direction, setDirection] = useState("expense");
  const [amount, setAmount] = useState("0");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString());

  const sumCents = useMemo(
    () => items.reduce((acc, t) => acc + (t.direction === "income" ? t.amountCents : -t.amountCents), 0),
    [items]
  );

  const onAdd = async () => {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) return;

    await add({
      direction,
      amountCents: Math.round(amountNum * 100),
      currency: "UAH",
      category: category.trim() || null,
      note: note.trim() || null,
      occurredAt,
    });

    setAmount("0");
    setCategory("");
    setNote("");
    setOccurredAt(new Date().toISOString());
  };

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Transactions (API + Dexie cache)</h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Active profileId: <code>{profileId ?? "—"}</code>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="expense">expense</option>
          <option value="income">income</option>
        </select>

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (UAH)"
          inputMode="decimal"
        />

        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />

        <input
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          placeholder="occurredAt (ISO)"
          style={{ minWidth: 320 }}
        />

        <button onClick={onAdd}>Add</button>
        <button onClick={sync} disabled={syncing}>Sync</button>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {String(error?.message ?? error)}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        {loading ? "Loading…" : `Count: ${items.length}`} | Sync: {syncing ? "…" : "ok"} | Balance:{" "}
        {(sumCents / 100).toFixed(2)} UAH
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              border: "1px solid #3333",
              borderRadius: 8,
              padding: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {t.direction} {(t.amountCents / 100).toFixed(2)} {t.currency}{" "}
                {t.category ? `• ${t.category}` : ""}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13, wordBreak: "break-word" }}>
                {t.note ?? ""}
              </div>
              <div style={{ opacity: 0.6, fontSize: 12 }}>
                occurredAt: {t.occurredAt} | updatedAt: {t.updatedAt} | status: {t.syncStatus}
              </div>
            </div>

            <button onClick={() => remove(t.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}