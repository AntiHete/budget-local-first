import { apiRequest } from "../lib/apiClient";

export function listAccounts() {
  return apiRequest("/api/accounts");
}

export function createAccount(input) {
  return apiRequest("/api/accounts", {
    method: "POST",
    body: input,
  });
}

export function patchAccount(input) {
  return apiRequest("/api/accounts", {
    method: "PATCH",
    body: input,
  });
}

export function deleteAccount(id) {
  return apiRequest("/api/accounts", {
    method: "DELETE",
    body: { id },
  });
}