// A read started after an observed event already covers that event. Otherwise,
// merge concurrent triggers into one follow-up read, never a parallel duplicate.
// A logical clock preserves event/read ordering even within one browser clock tick.
let order = 0;
export function nextRefreshOrder() { return ++order; }

export function createRefreshQueue(clock = nextRefreshOrder) {
  const entries = new Map();
  return function refresh(key, operation, { observedAt } = {}) {
    const previous = entries.get(key);
    if (Number.isFinite(observedAt) && previous?.startedAt > observedAt && (previous.running || previous.succeeded)) {
      return previous.promise;
    }
    if (previous?.running) { previous.next = operation; return previous.promise; }
    const entry = { next: operation, running: true, succeeded: false, startedAt: -Infinity, promise: null };
    entries.set(key, entry);
    entry.promise = Promise.resolve().then(async () => {
      for (;;) {
        const task = entry.next; entry.next = null; entry.startedAt = clock();
        let failure;
        try { entry.succeeded = (await task()) !== false; }
        catch (error) { entry.succeeded = false; failure = error; }
        if (!entry.next) {
          entry.running = false;
          if (failure) throw failure;
          return;
        }
      }
    });
    return entry.promise;
  };
}
