import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { useProfile } from "../../context/ProfileContext";

function fmtUAH(x) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(x);
}

export default function PaymentList() {
  const { activeProfileId } = useProfile();
  const [statusFilter, setStatusFilter] = useState("planned"); // planned | done | all
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const catMap = useLiveQuery(async () => {
    if (!activeProfileId) return new Map();
    const cats = await db.categories.where("profileId").equals(activeProfileId).toArray();
    return new Map(cats.map((c) => [c.id, c.name]));
  }, [activeProfileId]);

  const items = useLiveQuery(async () => {
    if (!activeProfileId) return [];
    const all = await db.payments.where("profileId").equals(activeProfileId).toArray();
    all.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    return all;
  }, [activeProfileId]);

  const filtered = useMemo(() => {
    const list = items ?? [];
    if (statusFilter === "all") return list;
    return list.filter((p) => p.status === statusFilter);
  }, [items, statusFilter]);

  async function markDone(id) {
    await db.payments.update(id, { status: "done" });
  }

  async function markPlanned(id) {
    await db.payments.update(id, { status: "planned" });
  }

  async function deletePayment(id) {
    const ok = window.confirm("Видалити платіж?");
    if (!ok) return;
    await db.payments.delete(id);
  }

  return (
    <div className="card">
      <div className="rowBetween">
        <h2>Платежі</h2>

        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="planned">Заплановані</option>
          <option value="done">Виконані</option>
          <option value="all">Всі</option>
        </select>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Назва</th>
              <th>Категорія</th>
              <th>Сума</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((p) => {
              const isOverdue = p.status === "planned" && (p.dueDate || "") < today;

              return (
                <tr key={p.id}>
                  <td>{p.dueDate}</td>
                  <td>{p.title}</td>
                  <td>{p.categoryId ? (catMap?.get(p.categoryId) ?? "—") : "—"}</td>
                  <td>{fmtUAH(p.amount)}</td>

                  <td>
                    {isOverdue ? (
                      <span className="badge badgeDanger">Прострочено</span>
                    ) : (
                      <span className="badge">{p.status === "done" ? "Виконано" : "Заплановано"}</span>
                    )}
                  </td>

                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {p.status === "planned" ? (
                      <button className="btn" type="button" onClick={() => markDone(p.id)}>
                        Зроблено
                      </button>
                    ) : (
                      <button className="btn" type="button" onClick={() => markPlanned(p.id)}>
                        Повернути
                      </button>
                    )}

                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => deletePayment(p.id)}
                      style={{ marginLeft: 8 }}
                    >
                      Видалити
                    </button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="muted" style={{ padding: 12 }}>
                  Нема платежів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        Прострочені платежі визначаються локально (якщо дата &lt; сьогодні і статус “Заплановано”).
      </p>
    </div>
  );
}
