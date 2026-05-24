import { useEffect, useRef } from "react";

export default function useSseRefresh({ token, enabled = true, topics = [], childId, onRefresh, onExpired }) {
  const refreshRef = useRef(onRefresh);
  const timerRef = useRef(null);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !token) return undefined;
    const controller = new AbortController();
    const allowed = new Set(topics);

    function scheduleRefresh() {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => refreshRef.current?.(), 600);
    }

    function handlePayload(payload) {
      try {
        const data = JSON.parse(payload);
        if (allowed.size > 0 && !allowed.has(data.topic)) return;
        if (childId && data.child_id && data.child_id !== childId) return;
        scheduleRefresh();
      } catch (error) {
        console.warn("Ignoring malformed SSE payload", error);
      }
    }

    readSseStream("/api/v1/events/parent", token, controller.signal, handlePayload, scheduleRefresh, onExpired);

    return () => {
      controller.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [token, enabled, topics.join("|"), childId, onExpired]);
}

async function readSseStream(url, token, signal, onPayload, onOpen, onExpired) {
  let delay = 1000;
  while (!signal.aborted) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (response.status === 401) {
        localStorage.removeItem("parent_token");
        onExpired?.();
        return;
      }
      if (!response.ok || !response.body) throw new Error(`SSE request failed: ${response.status}`);
      onOpen();
      delay = 1000;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const dataLine = part.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) onPayload(dataLine.slice(6));
        }
      }
    } catch (error) {
      if (!signal.aborted) console.warn("SSE refresh stream ended", error);
    }
    if (!signal.aborted) await sleep(delay, signal);
    delay = Math.min(delay * 2, 30000);
  }
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    function done() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    const timer = window.setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}
