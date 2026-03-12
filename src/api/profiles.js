import { apiRequest } from "../lib/apiClient";

export function listProfiles() {
  return apiRequest("/api/profiles");
}

export function createProfile(input) {
  return apiRequest("/api/profiles", {
    method: "POST",
    body: input,
  });
}

export function renameProfile(profileId, name) {
  return apiRequest("/api/profiles", {
    method: "PATCH",
    body: { profileId, name },
  });
}

export function deleteProfile(profileId) {
  return apiRequest("/api/profiles", {
    method: "DELETE",
    body: { profileId },
  });
}

export function selectProfile(profileId) {
  return apiRequest("/api/profiles/select", {
    method: "POST",
    body: { profileId },
  });
}

export function listProfileMembers() {
  return apiRequest("/api/profiles/members");
}

export function addProfileMember(email, role) {
  return apiRequest("/api/profiles/members", {
    method: "POST",
    body: { email, role },
  });
}

export function updateProfileMemberRole(memberId, role) {
  return apiRequest("/api/profiles/members", {
    method: "PATCH",
    body: { memberId, role },
  });
}

export function removeProfileMember(memberId) {
  return apiRequest("/api/profiles/members", {
    method: "DELETE",
    body: { memberId },
  });
}