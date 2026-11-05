import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("alignHeatmapToCalendar correctly aligns dates to Monday-Sunday columns", async () => {
  const { alignHeatmapToCalendar } = await import("../src/utils/calendar.js");

  // 1. Empty input
  assert.deepEqual(alignHeatmapToCalendar([]), []);
  assert.deepEqual(alignHeatmapToCalendar(null), []);

  // 2. 2026-11-02 is a Monday (getDay() === 1) -> 0 leading blanks
  const mondayRaw = [
    { date: "2026-11-02", status: "perfect", completed_tasks: 5, total_tasks: 5 },
    { date: "2026-11-03", status: "qualified", completed_tasks: 4, total_tasks: 5 },
  ];
  const mondayAligned = alignHeatmapToCalendar(mondayRaw);
  assert.equal(mondayAligned.length, 7); // padded to 1 full week
  assert.equal(mondayAligned[0].isPlaceholder, false);
  assert.equal(mondayAligned[0].date, "2026-11-02");
  assert.equal(mondayAligned[1].date, "2026-11-03");
  assert.equal(mondayAligned[2].isPlaceholder, true);

  // 3. 2026-11-04 is a Wednesday (getDay() === 3) -> 2 leading blanks (Mon, Tue)
  const wedRaw = [
    { date: "2026-11-04", status: "perfect", completed_tasks: 5, total_tasks: 5 },
  ];
  const wedAligned = alignHeatmapToCalendar(wedRaw);
  assert.equal(wedAligned.length, 7);
  assert.equal(wedAligned[0].isPlaceholder, true); // Mon
  assert.equal(wedAligned[1].isPlaceholder, true); // Tue
  assert.equal(wedAligned[2].isPlaceholder, false); // Wed
  assert.equal(wedAligned[2].date, "2026-11-04");
  assert.equal(wedAligned[3].isPlaceholder, true); // Thu

  // 4. 2026-11-01 is a Sunday (getDay() === 0) -> 6 leading blanks
  const sunRaw = [
    { date: "2026-11-01", status: "frozen", completed_tasks: 0, total_tasks: 5 },
  ];
  const sunAligned = alignHeatmapToCalendar(sunRaw);
  assert.equal(sunAligned.length, 7);
  assert.equal(sunAligned.filter((x) => x.isPlaceholder).length, 6);
  assert.equal(sunAligned[6].isPlaceholder, false);
  assert.equal(sunAligned[6].date, "2026-11-01");
});

test("parent-web api exposes adjustChildFreeze and updateFreezeSettings", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ child_id: "c-1", available_count: 3 }),
    };
  };

  const { default: api } = await import("../src/api.js");

  // 1. adjustChildFreeze
  await api.adjustChildFreeze("tok-adj", "c-1", 1, "发烧生病特许免死金牌");
  assert.equal(calls[0].url, "/api/v1/shop/children/c-1/freeze/adjust");
  assert.equal(calls[0].opts.method, "PATCH");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok-adj");
  const adjBody = JSON.parse(calls[0].opts.body);
  assert.equal(adjBody.delta, 1);
  assert.equal(adjBody.reason, "发烧生病特许免死金牌");

  // 2. updateFreezeSettings
  await api.updateFreezeSettings("tok-set", "c-1", {
    star_cost: 8,
    max_limit: 3,
    monthly_grant: 1,
  });
  assert.equal(calls[1].url, "/api/v1/shop/children/c-1/freeze/settings");
  assert.equal(calls[1].opts.method, "PUT");
  const setBody = JSON.parse(calls[1].opts.body);
  assert.equal(setBody.star_cost, 8);
  assert.equal(setBody.max_limit, 3);
  assert.equal(setBody.monthly_grant, 1);
});

test("Heatmap CSS enforces max-width: 26px and aspect-ratio: 1 for compact layout", () => {
  const cssPath = path.resolve(__dirname, "../src/index.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  // Check .heatmap-cell has max-width: 26px and aspect-ratio: 1
  assert.ok(
    cssContent.includes(".heatmap-cell"),
    "index.css must contain .heatmap-cell class"
  );
  assert.ok(
    cssContent.includes("max-width: 26px") || cssContent.includes("max-width:26px"),
    "index.css must constrain cell max-width to 26px"
  );
  assert.ok(
    cssContent.includes("aspect-ratio: 1"),
    "index.css must maintain aspect-ratio: 1 for square cells"
  );

  // Check weekday header and matrix box
  assert.ok(
    cssContent.includes(".weekday-header-row"),
    "index.css must contain .weekday-header-row"
  );
  assert.ok(
    cssContent.includes(".compact-legend-row"),
    "index.css must contain .compact-legend-row"
  );
  assert.ok(
    cssContent.includes(".selected-pill"),
    "index.css must contain .selected-pill"
  );
});
