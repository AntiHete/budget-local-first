import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useProfile } from "../../context/ProfileContext";
import { getUpcomingPayments } from "../../services/paymentService";

export default function UpcomingPayments() {
  const { activeProfileId } = useProfile();

  const list = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    return getUpcomingPayments(activeProfileId, 5);
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
