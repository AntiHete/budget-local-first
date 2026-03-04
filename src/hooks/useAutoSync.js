import { useEffect } from "react";
import { fullSync } from "../sync/fullSync";

export function useAutoSync() {
  useEffect(() => {
    const run = () => {
      fullSync().catch(() => {});
    };

    run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);
}