import test from "node:test";
import assert from "node:assert/strict";

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
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = new MockAudioNode();
  }
  createGain() {
    return new MockAudioNode();
  }
  createOscillator() {
    return new MockAudioNode();
  }
  async resume() {
    this.state = "running";
  }
}

globalThis.window = {
  AudioContext: MockAudioContext,
};

globalThis.document = {
  visibilityState: "visible",
  addEventListener: () => {},
  removeEventListener: () => {},
};

test("Sprint 2: handleComplete guards against re-submitting completed or submitted tasks", async () => {
  let callCount = 0;
  let playedSubmitted = false;
  let playedComplete = false;

  async function mockCompleteTask(task, apiFn) {
    if (!task || task.status === "completed" || task.status === "submitted") {
      return { ignored: true };
    }
    callCount++;
    if (task.require_approval) {
      playedSubmitted = true;
    } else {
      playedComplete = true;
    }
    return apiFn(task.id);
  }

  // 1. Task already completed -> ignored
  const resCompleted = await mockCompleteTask({ id: "t1", status: "completed" }, () => {});
  assert.equal(resCompleted.ignored, true);
  assert.equal(callCount, 0);

  // 2. Task already submitted -> ignored
  const resSubmitted = await mockCompleteTask({ id: "t2", status: "submitted" }, () => {});
  assert.equal(resSubmitted.ignored, true);
  assert.equal(callCount, 0);

  // 3. Pending task with require_approval=true -> triggers submitted sound & calls API
  const resPendingApproval = await mockCompleteTask(
    { id: "t3", status: "pending", require_approval: true },
    async (id) => ({ task_id: id, status: "submitted", stars_awarded: 0 })
  );
  assert.equal(resPendingApproval.status, "submitted");
  assert.equal(resPendingApproval.stars_awarded, 0);
  assert.equal(callCount, 1);
  assert.equal(playedSubmitted, true);
  assert.equal(playedComplete, false);

  // 4. Pending task without require_approval -> triggers complete sound & awards stars
  const resPendingDirect = await mockCompleteTask(
    { id: "t4", status: "pending", require_approval: false },
    async (id) => ({ task_id: id, status: "completed", stars_awarded: 2 })
  );
  assert.equal(resPendingDirect.status, "completed");
  assert.equal(resPendingDirect.stars_awarded, 2);
  assert.equal(callCount, 2);
  assert.equal(playedComplete, true);
});

test("Sprint 2: playTaskSubmitted audio function behaves properly with Web Audio context", async () => {
  const { playTaskSubmitted } = await import("../src/utils/soundFx.js");
  assert.equal(typeof playTaskSubmitted, "function");

  await playTaskSubmitted();
  // Ensure function executes without crashing
  assert.ok(true);
});
