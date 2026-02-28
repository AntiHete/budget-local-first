const KEY = "blf_token";

const listeners = new Set();

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  if (!token) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, token);
  notify();
}

export function clearToken() {
  localStorage.removeItem(KEY);
  notify();
}

export function subscribeToken(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const fn of listeners) fn();
}

window.addEventListener("storage", (e) => {
  if (e.key === KEY) notify();
});