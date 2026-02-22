const KEY = "blf_token";

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  if (!token) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}