import { useEffect, useRef } from "react";
import { nextRefreshOrder } from "../utils/refreshQueue.js";

export default function useVisibilityRefresh({ enabled = true, onRefresh }) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return undefined;
    let awayAt = document.visibilityState === "visible" ? null : Date.now();
    let timer;
    function markAway() {
      if (awayAt === null) awayAt = Date.now();
      window.clearTimeout(timer);
    }
    function refreshIfReturned() {
      if (document.visibilityState !== "visible" || awayAt === null) return;
      const elapsed = Date.now() - awayAt;
      awayAt = null;
      if (elapsed < 5000) return;
      const observedAt = nextRefreshOrder();
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") refreshRef.current?.({ observedAt });
      }, 100);
    }
    function visibilityChanged() {
      if (document.visibilityState === "visible") refreshIfReturned();
      else markAway();
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("blur", markAway);
    window.addEventListener("focus", refreshIfReturned);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("blur", markAway);
      window.removeEventListener("focus", refreshIfReturned);
    };
  }, [enabled]);
}
