import { useMemo, useState } from "react";
import { useCachedDebts } from "../hooks/useCachedDebts";
import { useCachedDebtPayments } from "../hooks/useCachedDebtPayments";

export default function DebtsCachedPage() {
  const [status, setStatus] = useState("open");
  const { items, loading, syncing, error, add, update, remove, profileId } = useCachedDebts({ status });

  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(() => items.find((d) => d.id === selectedId) ?? null, [items, selectedId]);
  const paymentsHook = useCachedDebtPayments(selectedId);

  const [direction, setDirection] = useState("i_owe");
  const [counterparty, setCounterparty] = useState("");
  const [principal, setPrincipal] = useState("0");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const onAddDebt = async () => {
    const p = Number(principal);
    if (!Number.isFinite(p) || p < 0) return;

    const d = await add({
      direction,
      counterparty: counterparty.trim(),
      principalCents: Math.round(p * 100),
      currency: "UAH",
      title: title.trim() || null,
      note: note.trim() || null,
    });

    setCounterparty("");
    setPrincipal("0");
    setTitle("");
    setNote("");
    setSelectedId(d.id);
  };

  const [payAmount, setPayAmount] = useState("0");
  const onAddPayment = async () => {
    const a = Number(payAmount);
    if (!Number.isFinite(a) || a < 0 || !selectedId) return;

    await paymentsHook.add({
      amountCents: Math.round(a * 100),
      occurredAt: new Date().toISOString(),
      note: null,
    });

    setPayAmount("0");
  };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2>Debts (API + Dexie cache)</h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Active profileId: <code>{profileId ?? "—"}</code>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <label>Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="">all</option>
        </select>
      </div>

      {error ? <div style={{ color: "crimson", marginBottom: 12 }}>{String(error?.message ?? error)}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <div style={{ marginBottom: 10, padding: 10, border: "1px solid #3333", borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Create debt</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="i_owe">i_owe</option>
                <option value="owed_to_me">owed_to_me</option>
              </select>
              <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Counterparty" />
              <input value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Principal (UAH)" inputMode="decimal" />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
              <button onClick={onAddDebt} disabled={syncing || !counterparty.trim()}>Create</button>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            {loading ? "Loading…" : `Count: ${items.length}`} | Sync: {syncing ? "…" : "ok"}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {items
              .slice()
              .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
              .map((d) => (
                <div
                  key={d.id}
                  style={{
                    border: "1px solid #3333",
                    borderRadius: 8,
                    padding: 10,
                    cursor: "pointer",
                    background: d.id === selectedId ? "#00000008" : "transparent",
                  }}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div style={{ fontWeight: 600 }}>
                    {d.direction} • {d.counterparty} • {d.status}
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    Principal: {(d.principalCents / 100).toFixed(2)} {d.currency} | Paid: {(d.paidCents / 100).toFixed(2)}{" "}
                    {d.currency} | Balance: {(d.balanceCents / 100).toFixed(2)} {d.currency}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    {d.title ?? ""} {d.note ? `• ${d.note}` : ""}
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        update(d.id, { status: d.status === "open" ? "closed" : "open" });
                      }}
                      disabled={syncing}
                    >
                      Toggle status
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(d.id);
                        if (selectedId === d.id) setSelectedId(null);
                      }}
                      disabled={syncing}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div>
          <div style={{ border: "1px solid #3333", borderRadius: 8, padding: 10, minHeight: 200 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Payments</div>

            {!selected ? (
              <div style={{ opacity: 0.7 }}>Select a debt to see payments</div>
            ) : (
              <>
                <div style={{ opacity: 0.85, marginBottom: 10 }}>
                  Selected: <code>{selected.id}</code>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <input
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Payment (UAH)"
                    inputMode="decimal"
                  />
                  <button onClick={onAddPayment} disabled={paymentsHook.syncing}>Add payment</button>
                  <button onClick={paymentsHook.refresh} disabled={paymentsHook.syncing}>Refresh</button>
                </div>

                {paymentsHook.error ? (
                  <div style={{ color: "crimson", marginBottom: 10 }}>
                    {String(paymentsHook.error?.message ?? paymentsHook.error)}
                  </div>
                ) : null}

                <div style={{ marginBottom: 10 }}>
                  {paymentsHook.loading ? "Loading…" : `Count: ${paymentsHook.items.length}`} | Sync:{" "}
                  {paymentsHook.syncing ? "…" : "ok"}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {paymentsHook.items.map((p) => (
                    <div key={p.id} style={{ border: "1px solid #3333", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>
                        {(p.amountCents / 100).toFixed(2)} • {p.occurredAt}
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>{p.note ?? ""}</div>

                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => paymentsHook.remove(p.id)} disabled={paymentsHook.syncing}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}