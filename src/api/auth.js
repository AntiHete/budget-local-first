import { apiRequest } from "../lib/apiClient";

export function login(email, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function register(email, password, name) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: { email, password, ...(name ? { name } : {}) },
  });
}