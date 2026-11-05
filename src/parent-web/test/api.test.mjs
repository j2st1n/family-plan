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

test("parent-web api exposes Sprint 3 analytics, vacation, and freeze endpoints", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    };
  };

  const { default: api } = await import("../src/api.js");

  // Test fetchAnalytics
  await api.fetchAnalytics("tok-a", "child-1", 30);
  assert.equal(calls[0].url, "/api/v1/plans/children/child-1/analytics?days=30");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok-a");

  // Test fetchVacations
  await api.fetchVacations("tok-b", "child-1");
  assert.equal(calls[1].url, "/api/v1/plans/children/child-1/vacations");

  // Test createVacation
  await api.createVacation("tok-c", "child-1", {
    start_date: "2026-11-01",
    end_date: "2026-11-03",
    reason: "Holiday",
  });
  assert.equal(calls[2].url, "/api/v1/plans/children/child-1/vacations");
  assert.equal(calls[2].opts.method, "POST");
  assert.equal(JSON.parse(calls[2].opts.body).reason, "Holiday");

  // Test deleteVacation
  await api.deleteVacation("tok-d", "child-1", "vac-999");
  assert.equal(calls[3].url, "/api/v1/plans/children/child-1/vacations/vac-999");
  assert.equal(calls[3].opts.method, "DELETE");

  // Test fetchChildFreeze
  await api.fetchChildFreeze("tok-e", "child-1");
  assert.equal(calls[4].url, "/api/v1/shop/children/child-1/freeze");
});
