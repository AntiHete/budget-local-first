import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../../context/ProfileContext";
import { currentMonth } from "../../services/dateService";
import { getBudgetAlerts } from "../../services/budgetService";

export default function BudgetAlerts() {
  const { activeProfileId } = useProfile();
  const month = currentMonth();

  const data = useLiveQuery(async () => {
    if (!activeProfileId) return { items: [], month };
    const items = await getBudgetAlerts(activeProfileId, month, 3);
    return { items, month };
  }, [activeProfileId, month]);

  const has = (data?.items?.length ?? 0) > 0;

  return (
    <div className="card">
      <h2>Бюджети “на межі”</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Місяць: {data?.month}</div>

      {!has && <div className="muted">Нема бюджетів на цей місяць або витрат</div>}

      {has && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.items.map((i) => (
            <div key={i.budgetId}>
              <div className="rowBetween">
                <div>
                  <strong>{i.category}</strong> <span className="badge">{i.status}</span>
                </div>
                <div className="muted">{Math.round(i.pct)}%</div>
              </div>
              <div className="progress" title={`${Math.round(i.pct)}%`}>
                <div className="progressFill" style={{ width: `${i.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
