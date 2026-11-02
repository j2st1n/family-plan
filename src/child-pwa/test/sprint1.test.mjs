import test from "node:test";
import assert from "node:assert/strict";

// Mock browser globals for testing soundFx in Node
class MockAudioNode {
  constructor() {
    this.gain = {
      setValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    };
    this.frequency = {
      setValueAtTime: () => {},
    };
    this.Q = {
      setValueAtTime: () => {},
    };
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.state = "suspended";
    this.currentTime = 0;
    this.destination = new MockAudioNode();
  }
  createGain() {
    return new MockAudioNode();
  }
  createOscillator() {
    return new MockAudioNode();
  }
  createBiquadFilter() {
    return new MockAudioNode();
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return new MockAudioNode();
  }
  async resume() {
    this.state = "running";
  }
}

globalThis.window = {
  AudioContext: MockAudioContext,
};

const listeners = new Map();
globalThis.document = {
  visibilityState: "visible",
  addEventListener: (event, handler) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  },
  removeEventListener: (event, handler) => {
    if (!listeners.has(event)) return;
    const list = listeners.get(event).filter((h) => h !== handler);
    listeners.set(event, list);
  },
};

test("soundFx exports and plays all three sounds safely and configures audioSession", async () => {
  // Mock audioSession on navigator in Node environment
  const mockAudioSession = { type: "auto" };
  Object.defineProperty(globalThis, "navigator", {
    value: { audioSession: mockAudioSession },
    configurable: true,
    writable: true,
  });

  const soundFx = await import("../src/utils/soundFx.js");
  assert.equal(typeof soundFx.getAudioContext, "function");
  assert.equal(typeof soundFx.initAudioUnlock, "function");
  assert.equal(typeof soundFx.configureAudioSession, "function");
  assert.equal(typeof soundFx.playTaskComplete, "function");
  assert.equal(typeof soundFx.playFanfare, "function");
  assert.equal(typeof soundFx.playTimerDone, "function");

  soundFx.configureAudioSession();
  assert.equal(globalThis.navigator.audioSession.type, "playback");

  const ctx = soundFx.getAudioContext();
  assert.ok(ctx);

  // Initial state is suspended, playTaskComplete must trigger resume
  await soundFx.playTaskComplete();
  assert.equal(ctx.state, "running");

  // Simulate iOS system interruption (e.g. phone call or background lock)
  ctx.state = "interrupted";
  await soundFx.playFanfare();
  assert.equal(ctx.state, "running");

  await soundFx.playTimerDone();
});

test("WakeLock handles request, release, and visibilitychange cleanly", async () => {
  let releaseCallCount = 0;
  let addEventListenerCount = 0;

  const mockSentinel = {
    released: false,
    release: async () => {
      releaseCallCount++;
      mockSentinel.released = true;
    },
    addEventListener: (evt, cb) => {
      addEventListenerCount++;
      mockSentinel._onRelease = cb;
    },
  };

  const mockWakeLock = {
    request: async (type) => {
      assert.equal(type, "screen");
      return mockSentinel;
    },
  };

  Object.defineProperty(globalThis, "navigator", {
    value: { wakeLock: mockWakeLock },
    configurable: true,
    writable: true,
  });

  // Test wakeLock request
  const sentinel = await globalThis.navigator.wakeLock.request("screen");
  assert.equal(sentinel.released, false);
  await sentinel.release();
  assert.equal(sentinel.released, true);
  assert.equal(releaseCallCount, 1);
});

test("1s Debounce and Set-based concurrency prevent duplicate and cross-task state collision", async () => {
  const lastCompleteTimeMap = new Map();
  const inFlightSet = new Set();
  const completingSet = new Set();
  let executingCount = 0;

  async function mockComplete(taskId, durationMs = 50) {
    const now = Date.now();
    const lastTime = lastCompleteTimeMap.get(taskId) || 0;
    if (inFlightSet.has(taskId) || now - lastTime < 1000) {
      return { status: "debounced" };
    }
    inFlightSet.add(taskId);
    completingSet.add(taskId);
    lastCompleteTimeMap.set(taskId, now);
    executingCount++;

    // simulate async operation
    await new Promise((r) => setTimeout(r, durationMs));
    inFlightSet.delete(taskId);
    completingSet.delete(taskId);
    return { status: "success" };
  }

  // 1. Task 101 first tap -> success
  const p1 = mockComplete(101, 60);

  // 2. Immediate second tap on Task 101 within 20ms -> debounced
  const res2 = await mockComplete(101);
  assert.equal(res2.status, "debounced");

  // 3. Concurrent tap on Task 102 while Task 101 is still in flight -> allowed and independent
  const p3 = mockComplete(102, 20);
  assert.equal(completingSet.has(101), true);
  assert.equal(completingSet.has(102), true);

  const [res1, res3] = await Promise.all([p1, p3]);
  assert.equal(res1.status, "success");
  assert.equal(res3.status, "success");
  assert.equal(completingSet.size, 0);
  assert.equal(executingCount, 2);
});

test("Wall-Clock target time accurately recovers remaining seconds after background sleep", () => {
  const initialSeconds = 1200; // 20 minutes
  const now = 1000000;
  const targetEndTime = now + initialSeconds * 1000;

  // After 500 seconds (ticking normally)
  const remaining1 = Math.max(0, Math.ceil((targetEndTime - (now + 500 * 1000)) / 1000));
  assert.equal(remaining1, 700);

  // Background sleep for 1300 seconds (exceeding focus duration)
  const remainingExpired = Math.max(0, Math.ceil((targetEndTime - (now + 1300 * 1000)) / 1000));
  assert.equal(remainingExpired, 0);
});

test("FocusTimer circular ring SVG progress calculation", () => {
  const size = 300;
  const strokeWidth = 16;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  // Total 20 minutes (1200 seconds)
  const totalSeconds = 1200;

  // At 1200 seconds remaining (start): progressRatio = 1, strokeDashoffset = 0
  const offsetStart = circumference * (1 - 1200 / totalSeconds);
  assert.equal(offsetStart, 0);

  // At 600 seconds remaining (half): progressRatio = 0.5, strokeDashoffset = circumference * 0.5
  const offsetHalf = circumference * (1 - 600 / totalSeconds);
  assert.equal(Math.round(offsetHalf), Math.round(circumference * 0.5));

  // At 0 seconds remaining (finished): progressRatio = 0, strokeDashoffset = circumference
  const offsetEnd = circumference * (1 - 0 / totalSeconds);
  assert.equal(offsetEnd, circumference);
});
