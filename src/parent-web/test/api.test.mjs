import test from "node:test";
import assert from "node:assert/strict";

test("parent-web api exposes approveTask, rejectTask, revokeTask with correct endpoints", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "task-123", status: "ok" }),
    };
  };

  const { default: api } = await import("../src/api.js");

  assert.equal(typeof api.approveTask, "function");
  assert.equal(typeof api.rejectTask, "function");
  assert.equal(typeof api.revokeTask, "function");

  // Test approveTask
  await api.approveTask("tok-1", "task-abc");
  assert.equal(calls[0].url, "/api/v1/plans/tasks/task-abc/approve");
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok-1");

  // Test rejectTask
  await api.rejectTask("tok-2", "task-def");
  assert.equal(calls[1].url, "/api/v1/plans/tasks/task-def/reject");
  assert.equal(calls[1].opts.method, "POST");
  assert.equal(calls[1].opts.headers.Authorization, "Bearer tok-2");

  // Test revokeTask
  await api.revokeTask("tok-3", "task-ghi");
  assert.equal(calls[2].url, "/api/v1/plans/tasks/task-ghi/revoke");
  assert.equal(calls[2].opts.method, "POST");
  assert.equal(calls[2].opts.headers.Authorization, "Bearer tok-3");
});

test("parent-web api handles errors and extracts detail.message properly", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      detail: { code: "conflict", message: "Task is not submitted for approval" },
    }),
  });

  const { default: api } = await import("../src/api.js");

  await assert.rejects(
    async () => {
      await api.approveTask("tok", "task-123");
    },
    {
      name: "Error",
      message: "Task is not submitted for approval",
    }
  );
});
