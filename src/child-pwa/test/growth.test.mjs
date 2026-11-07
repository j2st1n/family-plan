import test from "node:test";
import assert from "node:assert/strict";
import { growthSnapshot, calendarCells, durationLabel } from "../../shared-web/growth.js";
import { drawGrowthReport } from "../../shared-web/growthPoster.js";

const data = { child_id: "private-id", days: 7, start_date: "2026-11-02", end_date: "2026-11-08", heatmap: [
  { date: "2026-11-02", total_tasks: 2, completed_tasks: 1, status: "missed", title: "PRIVATE TASK" },
  { date: "2026-11-03", total_tasks: 0, completed_tasks: 0, status: "rest" },
], summary: { completed_tasks: 1, total_tasks: 2, qualified_days: 0, recorded_tasks: 1, actual_seconds: 125 }, categories: [], insights: { attention_needed: { title: "PRIVATE TASK" }, stars: { current_stars: 999, stars_spent: 80, stars_earned: "1.25" }, streak: { current_streak_days: 58, longest_streak_days: 60 } } };
function canvasLog() {
  const texts = [];
  const ctx = new Proxy({ fillText: text => texts.push(String(text)), measureText: text => ({ width: text.length * 10 }) }, { get(target, key) { return target[key] ?? (() => {}); } });
  return { canvas: { getContext: () => ctx }, texts };
}
test("share snapshot allows only aggregate values, excludes task names, ledger and identity", () => {
  const report = growthSnapshot(data, "昵称示例");
  assert.equal(report.stars_earned, "1.25"); assert.equal(report.current_streak_days, 58);
  assert.equal(report.qualified_days, 0); assert.equal(report.recorded_tasks, 1);
  const json = JSON.stringify(report);
  for (const secret of ["private-id", "PRIVATE TASK", "current_stars", "stars_spent", "attention_needed"]) assert.ok(!json.includes(secret), secret);
  assert.equal(calendarCells(report.heatmap)[0].date, "2026-11-02");
});
test("poster privacy toggle removes nickname from actual drawing and hides absent timing", () => {
  const report = growthSnapshot(data, "昵称示例"), shown = canvasLog(), hidden = canvasLog();
  drawGrowthReport(shown.canvas, report, true); drawGrowthReport(hidden.canvas, { ...report, recorded_tasks: 0 }, false);
  assert.ok(shown.texts.includes("昵称示例的成长"));
  assert.ok(shown.texts.some(t => t.includes("2 分 5 秒")));
  assert.ok(hidden.texts.includes("我的成长"));
  assert.ok(!hidden.texts.some(t => /昵称示例|实际用时|未记录|PRIVATE TASK|999/.test(t)));
  assert.ok(hidden.texts.includes("Small steps. Shared growth."));
});
test("calendar alignment, protected days and decimal stars survive the child projection", () => {
  const child = { ...data, insights: undefined, child_name: "合成孩子", stars_earned: "0.25", streak: { current_streak_days: 8 }, summary: undefined, heatmap: [
    { date: "2026-11-06", total_tasks: 4, completed_tasks: 4, status: "vacation" },
    { date: "2026-11-07", total_tasks: 2, completed_tasks: 0, status: "frozen" },
  ] };
  const report = growthSnapshot(child);
  assert.equal(report.qualified_days, 0); assert.equal(report.stars_earned, "0.25");
  assert.equal(calendarCells(report.heatmap).filter(x => x === null).length, 4);
  assert.equal(durationLabel(0), "0 秒"); assert.equal(durationLabel(3660), "1 小时 1 分");
});
