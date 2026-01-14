export function currentMonth() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthBounds(month) {
  return { from: `${month}-01`, to: `${month}-31` };
}

export function clampPct(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
