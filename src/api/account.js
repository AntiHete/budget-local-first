import { apiRequest } from "../lib/apiClient";

export function getMe() {
  return apiRequest("/api/me");
}

export function updateMe(input) {
  return apiRequest("/api/me", {
    method: "PATCH",
    body: input,
  });
}

export function changePassword(currentPassword, newPassword, confirmPassword) {
  return apiRequest("/api/auth/change-password", {
    method: "POST",
    body: {
      currentPassword,
      newPassword,
      confirmPassword,
    },
  });
}
