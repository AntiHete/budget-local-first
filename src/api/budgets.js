import { apiRequest } from "../lib/apiClient";

export function listBudgets(params = {}) {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/api/budgets${suffix}`);
}

export function upsertBudget(input) {
  return apiRequest("/api/budgets", { method: "POST", body: input });
}

export function getBudget(id) {
  return apiRequest(`/api/budgets/${encodeURIComponent(id)}`);
}

export function patchBudget(id, patch) {
  return apiRequest(`/api/budgets/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export function deleteBudget(id) {
  return apiRequest(`/api/budgets/${encodeURIComponent(id)}`, { method: "DELETE" });
}