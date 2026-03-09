import { apiRequest } from "../lib/apiClient";

export function listTransactions(params = {}) {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.before) qs.set("before", params.before);
  if (params.after) qs.set("after", params.after);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/api/transactions${suffix}`);
}

export function createTransaction(input) {
  return apiRequest("/api/transactions", { method: "POST", body: input });
}

export function getTransaction(id) {
  return apiRequest(`/api/transactions/${encodeURIComponent(id)}`);
}

export function patchTransaction(id, patch) {
  return apiRequest(`/api/transactions/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export function deleteTransaction(id) {
  return apiRequest(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
}