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

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function MonthlySummary() {
  const { activeProfileId } = useProfile();
  const month = currentMonth();

  const totals = useLiveQuery(async () => {
    if (!activeProfileId) return { inc: 0, exp: 0 };
    const { from, to } = monthBounds(month);

    const txs = await db.transactions
      .where("profileId")
      .equals(activeProfileId)
      .and((t) => t.date >= from && t.date <= to)
      .toArray();

    let inc = 0;
    let exp = 0;
    for (const t of txs) {
      if (t.type === "income") inc += t.amount ?? 0;
      else exp += t.amount ?? 0;
    }
    return { inc, exp };
  }, [activeProfileId, month]);

  const net = useMemo(() => (totals?.inc ?? 0) - (totals?.exp ?? 0), [totals]);

  return (
    <div className="card">
      <h2>Зведення за місяць</h2>
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <span className="pill">Доходи: {fmtUAH(totals?.inc ?? 0)}</span>
        <span className="pill">Витрати: {fmtUAH(totals?.exp ?? 0)}</span>
        <span className="pill">Баланс: {fmtUAH(net)}</span>
        <span className="badge">{month}</span>
      </div>
    </div>
  );
}
