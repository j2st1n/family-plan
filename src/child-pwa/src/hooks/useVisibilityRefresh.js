import { useEffect, useRef } from "react";

export default function useVisibilityRefresh({ enabled = true, onRefresh }) {
  const refreshRef = useRef(onRefresh);
  const hiddenAtRef = useRef(null);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return undefined;
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current === null || Date.now() - hiddenAtRef.current >= 5000) {
        refreshRef.current?.();
      }
      hiddenAtRef.current = null;
    }
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [enabled]);
}
