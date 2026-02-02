import React from "react";

export default function ScenarioPanel({
  scenario,
  setScenario,
  nextMonth,
  expenseCategories,
}) {
  const enabled = scenario.enabled;

  return (
    <div className="card">
      <h2>Сценарій “Що буде, якщо…”</h2>

      <label className="label" style={{ cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            setScenario((s) => ({ ...s, enabled: e.target.checked }))
          }
          style={{ marginRight: 8 }}
        />
        Увімкнути сценарій (вплине на прогноз {nextMonth})
      </label>

      {enabled && (
        <>
          <div className="grid3" style={{ marginTop: 12 }}>
            <label className="labelCol">
              Тип події
              <select
                className="select"
                value={scenario.type}
                onChange={(e) =>
                  setScenario((s) => ({ ...s, type: e.target.value }))
                }
              >
                <option value="expense">Одноразова витрата</option>
                <option value="income">Одноразовий дохід</option>
              </select>
            </label>

            <label className="labelCol">
              Сума (UAH)
              <input
                className="input"
                inputMode="decimal"
                value={scenario.amount}
                onChange={(e) =>
                  setScenario((s) => ({
                    ...s,
                    amount: e.target.value.replace(",", "."),
                  }))
                }
                placeholder="Напр. 5000"
              />
            </label>

            <label className="labelCol">
              Місяць
              <input
                className="input"
                type="month"
                value={nextMonth}
                disabled
                title="У цьому сценарії впливаємо на наступний місяць"
              />
            </label>

            {scenario.type === "expense" && (
              <label className="labelCol" style={{ gridColumn: "span 2" }}>
                Категорія (опц.)
                <select
                  className="select"
                  value={scenario.categoryId ?? ""}
                  onChange={(e) =>
                    setScenario((s) => ({
                      ...s,
                      categoryId: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">— без категорії —</option>
                  {(expenseCategories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Витрата збільшує прогноз витрат (по категорії або “без категорії”). Дохід не змінює витрати, але показує
            чистий ефект (net impact).
          </p>
        </>
      )}
    </div>
  );
}
