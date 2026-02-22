import { apiRequest } from "../lib/apiClient";

export function listDebtPayments(debtId, params = {}) {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest(`/api/debts/${encodeURIComponent(debtId)}/payments${suffix}`);
}

export function createDebtPayment(debtId, input) {
  return apiRequest(`/api/debts/${encodeURIComponent(debtId)}/payments`, {
    method: "POST",
    body: input,
  });
}

export function patchDebtPayment(debtId, paymentId, patch) {
  return apiRequest(`/api/debts/${encodeURIComponent(debtId)}/payments/${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteDebtPayment(debtId, paymentId) {
  return apiRequest(`/api/debts/${encodeURIComponent(debtId)}/payments/${encodeURIComponent(paymentId)}`, {
    method: "DELETE",
  });
}