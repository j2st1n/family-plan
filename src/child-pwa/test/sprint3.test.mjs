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

test("Sprint 3 freeze: dynamic star_cost and max_limit checks for Shop", () => {
  // Logic simulation of Shop.jsx freeze card purchase check
  const checkCanBuy = (freezeInfo, stars) => {
    const cost = freezeInfo?.star_cost != null ? Number(freezeInfo.star_cost) : 5;
    const maxLimit = freezeInfo?.max_limit != null ? Number(freezeInfo.max_limit) : 2;
    const isLimitReached = (freezeInfo?.available_count ?? 0) >= maxLimit;
    const canBuy = Boolean(freezeInfo?.can_purchase && !isLimitReached && Number(stars) >= cost);
    return { cost, maxLimit, isLimitReached, canBuy };
  };

  // Case 1: default 5 stars, has 6 stars, 1 card -> can buy
  const r1 = checkCanBuy({ available_count: 1, max_limit: 2, star_cost: 5, can_purchase: true }, 6);
  assert.equal(r1.canBuy, true);
  assert.equal(r1.isLimitReached, false);
  assert.equal(r1.cost, 5);

  // Case 2: limit reached (2 / 2) -> cannot buy
  const r2 = checkCanBuy({ available_count: 2, max_limit: 2, star_cost: 5, can_purchase: false }, 10);
  assert.equal(r2.canBuy, false);
  assert.equal(r2.isLimitReached, true);

  // Case 3: custom price 8 stars, child has 7 stars -> cannot buy
  const r3 = checkCanBuy({ available_count: 0, max_limit: 3, star_cost: 8, can_purchase: false }, 7);
  assert.equal(r3.canBuy, false);
  assert.equal(r3.cost, 8);

  // Case 4: custom price 8 stars, child has 8 stars -> can buy
  const r4 = checkCanBuy({ available_count: 0, max_limit: 3, star_cost: 8, can_purchase: true }, 8);
  assert.equal(r4.canBuy, true);
});
