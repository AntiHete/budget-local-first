import { useSyncExternalStore } from "react";
import { subscribeToken, getToken } from "../lib/authToken";

export function useAuthToken() {
  return useSyncExternalStore(subscribeToken, getToken, () => null);
}