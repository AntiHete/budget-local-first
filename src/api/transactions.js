import { apiRequest } from "../lib/apiClient";

function buildQuery(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listTransactions(params = {}) {
  return apiRequest(`/api/transactions${buildQuery(params)}`);
}

export function getTransaction(id) {
  return apiRequest(`/api/transactions/${id}`);
}

export function createTransaction(input) {
  return apiRequest("/api/transactions", {
    method: "POST",
    body: input,
  });
}

export function updateTransaction(id, input) {
  return apiRequest(`/api/transactions/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteTransaction(id) {
  return apiRequest(`/api/transactions/${id}`, {
    method: "DELETE",
  });
}