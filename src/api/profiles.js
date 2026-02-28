import { apiRequest } from "../lib/apiClient";

export function listProfiles() {
  return apiRequest("/api/profiles");
}

export function createProfile(input) {
  return apiRequest("/api/profiles", { method: "POST", body: input });
}

export function selectProfile(profileId) {
  return apiRequest("/api/profiles/select", { method: "POST", body: { profileId } });
}