import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem: (key) => (key === "device_token" ? "mock-device-token" : null),
  removeItem: () => {},
  setItem: () => {},
};

test("Sprint 3: child-pwa api exposes fetchChildFreeze and purchaseChildFreeze", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        available_count: 2,
        last_granted_month: "2026-11",
        usages: [],
      }),
    };
  };

  const { fetchChildFreeze, purchaseChildFreeze } = await import("../src/api.js");

  const freeze = await fetchChildFreeze();
  assert.equal(calls[0].url, "/api/v1/child/shop/freeze");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer mock-device-token");
  assert.equal(freeze.available_count, 2);

  const purchased = await purchaseChildFreeze();
  assert.equal(calls[1].url, "/api/v1/child/shop/freeze/purchase");
  assert.equal(calls[1].opts.method, "POST");
  assert.equal(calls[1].opts.headers.Authorization, "Bearer mock-device-token");
  assert.equal(purchased.available_count, 2);
});
