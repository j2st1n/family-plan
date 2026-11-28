import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createMockCanvas() {
  const operations = [];
  const textDrawn = [];
  const ctx = {
    save: () => operations.push({ op: "save" }),
    translate: (x, y) => operations.push({ op: "translate", x, y }),
    bezierCurveTo: (...points) => operations.push({ op: "bezierCurveTo", points }),
    restore: () => operations.push({ op: "restore" }),
    scale: (x, y) => operations.push({ op: "scale", x, y }),
    fillRect: (x, y, w, h) => operations.push({ op: "fillRect", x, y, w, h }),
    measureText: value => ({ width: Array.from(value).length * 7 }),
    beginPath: () => operations.push({ op: "beginPath" }),
    closePath: () => operations.push({ op: "closePath" }),
    moveTo: (x, y) => operations.push({ op: "moveTo", x, y }),
    lineTo: (x, y) => operations.push({ op: "lineTo", x, y }),
    arcTo: (x1, y1, x2, y2, r) => operations.push({ op: "arcTo", x1, y1, x2, y2, r }),
    arc: (cx, cy, r, s, e) => operations.push({ op: "arc", cx, cy, r, s, e }),
    roundRect: (x, y, w, h, r) => operations.push({ op: "roundRect", x, y, w, h, r }),
    fill: () => operations.push({ op: "fill" }),
    stroke: () => operations.push({ op: "stroke" }),
    fillText: (text, x, y) => {
      operations.push({ op: "fillText", text, x, y });
      textDrawn.push(String(text));
    },
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    textAlign: "left",
    textBaseline: "top",
  };

  return {
    width: 0,
    height: 0,
    getContext: (type) => (type === "2d" ? ctx : null),
    toDataURL: (type) => `data:${type || "image/png"};base64,mockPngBase64`,
    toBlob: (cb, type) => {
      if (typeof Blob !== "undefined") {
        cb(new Blob(["mock-image-bytes"], { type: type || "image/png" }));
      } else {
        cb({ size: 1024, type: type || "image/png" });
      }
    },
    _operations: operations,
    _textDrawn: textDrawn,
    _ctx: ctx,
  };
}

test("Child PWA renders the daily achievement card at 2x", async () => {
  const { drawGrowthPoster } = await import("../src/utils/posterCanvas.js");

  const canvas = createMockCanvas();
  drawGrowthPoster(canvas, {
    childName: "天天",
    dateStr: "11月4日 星期三",
    completionRate: 100,
    completedCount: 2,
    totalCount: 2,
    streakDays: 5,
    stars: 20,
    tasks: [
      { id: "t1", title: "整理书包", reward_stars: 1, status: "completed" },
      { id: "t2", title: "练习跳绳", reward_stars: 2, status: "completed" },
    ],
  });

  assert.equal(canvas.width, 720, "Must be 720 for 2x Retina");
  assert.ok(canvas.height > 800 && canvas.height < 1200, "Canvas height must scale adaptively with DPR 2x");

  const texts = canvas._textDrawn.join(" ");
  assert.ok(canvas._textDrawn.includes("Today"), "Must label a card for today");
  assert.ok(canvas._textDrawn.includes("天天"), "Must display the child’s name");
  assert.ok(texts.includes("100%"), "Must render 100% completion rate");
  assert.ok(texts.includes("5 天"), "Must render streak");
  assert.ok(texts.includes("20"), "Must render stars");
  assert.ok(texts.includes("整理书包"), "Must render task item");
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
});

test("daily card fits long titles and sizes the task list for empty and overflow states", async () => {
  const { drawGrowthPoster } = await import("../src/utils/posterCanvas.js");
  const empty = createMockCanvas();
  drawGrowthPoster(empty, { completionRate: 0 });
  assert.ok(empty._textDrawn.includes("没有安排任务"));
  assert.ok(!empty._textDrawn.includes("件事"));
  const pending = createMockCanvas();
  drawGrowthPoster(pending, { completionRate: 0, totalCount: 1, tasks: [{ title: "晚间阅读", status: "pending" }] });
  assert.ok(pending._textDrawn.includes("还没有完成的任务"));

  const canvas = createMockCanvas();
  const tasks = Array.from({ length: 4 }, (_, index) => ({
    title: index === 0 ? "很长的阅读任务".repeat(14) : `任务 ${index + 1}`,
    status: "completed",
    reward_stars: 1,
    stars_awarded: index === 0 ? 2.25 : 1,
  }));
  drawGrowthPoster(canvas, { completedCount: 4, totalCount: 4, tasks });
  assert.ok(canvas.height > empty.height);
  assert.ok(canvas._textDrawn.some(value => value.startsWith("很长的阅读任务") && value.endsWith("…")));
  assert.ok(canvas._textDrawn.includes("+2.25 星"));
  assert.ok(canvas._textDrawn.includes("另有 1 项已完成"));
  assert.ok(!canvas._textDrawn.includes("任务 4"));
});

test("Child PWA posterCanvas handles Web Share API and download fallback safely", async () => {
  const { shareOrDownloadPoster } = await import("../src/utils/posterCanvas.js");
  const canvas = createMockCanvas();

  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  try {
    let shared = false;
    const mockNav = {
      share: async () => { shared = true; },
      canShare: () => false,
    };
    Object.defineProperty(globalThis, "navigator", { value: mockNav, configurable: true, writable: true });

    const res = await shareOrDownloadPoster(canvas, { childName: "天天" });
    assert.equal(shared, true);
    assert.equal(res.method, "web-share-url");

    // Fallback when share not present
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    let clicked = false;
    globalThis.document = {
      createElement: () => ({
        click: () => { clicked = true; },
        set href(val) {},
        set download(val) {},
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    };

    const resDownload = await shareOrDownloadPoster(canvas, { childName: "天天" });
    assert.equal(resDownload.method, "download");
    assert.equal(clicked, true);
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true, writable: true });
    }
    globalThis.document = originalDocument;
  }
});

test("Today renders the shared share button and poster preview", () => {
  const todayPath = path.resolve(__dirname, "../src/pages/Today.jsx");
  const content = fs.readFileSync(todayPath, "utf-8");

  assert.ok(content.includes("<ShareButton"), "Today must render the shared share button");
  assert.ok(content.includes("setShowShareModal(true)"), "Must open share modal on click");

  // 2. SharePosterModal mount
  assert.ok(content.includes("<SharePosterModal"), "Today.jsx must render SharePosterModal");
  assert.ok(content.includes("open={showShareModal}"), "Must pass open state");
  assert.ok(content.includes("childName={child?.name"), "Must pass child name");
  assert.ok(content.includes("streakDays={data?.rewards?.current_streak_days"), "Must pass streak days");
});

test("Child PWA SharePosterModal.jsx provides iOS Sheet drawer preview and actions", () => {
  const modalPath = path.resolve(__dirname, "../src/components/SharePosterModal.jsx");
  const content = fs.readFileSync(modalPath, "utf-8");

  assert.ok(content.includes("ios-sheet-overlay"), "Must have ios-sheet-overlay");
  assert.ok(content.includes("ios-sheet-content"), "Must have ios-sheet-content");
  assert.ok(content.includes("drawer-handle-bar"), "Must have drawer-handle-bar");
  assert.ok(content.includes("ios-sheet-header-title"), "Must have ios-sheet-header-title");
  assert.ok(content.includes("自律成长成就卡"), "Must have header title");
  assert.ok(content.includes("ios-poster-preview-img"), "Must have preview img");
  assert.ok(content.includes("长按图片"), "Must have long press hint");
  assert.ok(content.includes("保存"), "Must have download button");
});
