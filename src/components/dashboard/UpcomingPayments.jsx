import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

export default function UpcomingPayments() {
  const { activeProfileId } = useProfile();

  const list = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const planned = await db.payments
      .where({ profileId: activeProfileId, status: "planned" })
      .toArray();

    planned.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    return planned.slice(0, 5);
  }, [activeProfileId]);

  return (
    <div className="card">
      <h2>Найближчі платежі</h2>

      {(!list || list.length === 0) && <div className="muted">Нема запланованих платежів</div>}

      {list?.length > 0 && (
        <ul className="list">
          {list.map((p) => (
            <li key={p.id} className="listItem">
              <span>
                <strong>{p.dueDate}</strong> — {p.title}
              </span>
              <span className="badge">{p.amount} UAH</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
