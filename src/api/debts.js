import { apiRequest } from "../lib/apiClient";

export function listDebts(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status); // open|closed
  if (params.limit != null) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/api/debts${suffix}`);
}

export function createDebt(input) {
  return apiRequest("/api/debts", { method: "POST", body: input });
}

export function getDebt(id) {
  return apiRequest(`/api/debts/${encodeURIComponent(id)}`);
}

export function patchDebt(id, patch) {
  return apiRequest(`/api/debts/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export function deleteDebt(id) {
  return apiRequest(`/api/debts/${encodeURIComponent(id)}`, { method: "DELETE" });
}