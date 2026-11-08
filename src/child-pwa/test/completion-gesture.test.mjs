import test from "node:test";
import assert from "node:assert/strict";
import { acceptsCompletionSlide, slideProgress } from "../src/utils/completionGesture.js";
const gesture = { startX: 50, startY: 100, travel: 200, moved: true };
test("only a deliberate full drag ending at the right edge is accepted", () => {
  assert.equal(acceptsCompletionSlide(gesture, 250, 100), true);
  assert.equal(acceptsCompletionSlide(gesture, 241, 100), false);
  assert.equal(acceptsCompletionSlide(gesture, 150, 100), false);
  assert.equal(acceptsCompletionSlide(gesture, 50, 100), false);
  assert.equal(acceptsCompletionSlide({ ...gesture, moved: false }, 250, 100), false);
});
test("cancelled, vertical, invalid and undersized gestures never complete", () => {
  for (const g of [null, { ...gesture, cancelled: true }, { ...gesture, travel: 30 }]) assert.equal(acceptsCompletionSlide(g, 250, 100), false);
  assert.equal(acceptsCompletionSlide(gesture, 250, 141), false);
  assert.equal(acceptsCompletionSlide(gesture, NaN, 100), false);
  assert.equal(acceptsCompletionSlide(gesture, 250, NaN), false);
});
test("progress clamps at either end and cannot be fabricated from invalid geometry", () => {
  assert.equal(slideProgress(50, 30, 200), 0);
  assert.equal(slideProgress(50, 150, 200), .5);
  assert.equal(slideProgress(50, 350, 200), 1);
  for (const travel of [0, -20, NaN]) assert.equal(slideProgress(50, 250, travel), 0);
});
