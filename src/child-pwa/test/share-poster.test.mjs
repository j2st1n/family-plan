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
    clearRect: (x, y, w, h) => operations.push({ op: "clearRect", x, y, w, h }),
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

test("Child PWA posterCanvas adheres to Apple System Colors & 2x Retina rendering", async () => {
  const { APPLE_SYSTEM_COLORS, drawGrowthPoster } = await import("../src/utils/posterCanvas.js");
  assert.equal(APPLE_SYSTEM_COLORS.forestGreen, "#248A3D");
  assert.equal(APPLE_SYSTEM_COLORS.appleBlue, "#0071E3");
  assert.equal(APPLE_SYSTEM_COLORS.warmGold, "#FF9500");
  assert.equal(APPLE_SYSTEM_COLORS.pureLightGray, "#F5F5F7");

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
  assert.ok(texts.includes("天天"), "Must render child name");
  assert.ok(texts.includes("100%"), "Must render 100% completion rate");
  assert.ok(texts.includes("5 天"), "Must render streak");
  assert.ok(texts.includes("20"), "Must render stars");
  assert.ok(texts.includes("整理书包"), "Must render task item");
});

test("Child PWA drawGrowthPoster eliminates title overlap, enforces 10px breathing gap, dynamic height & alignment", async () => {
  const { drawGrowthPoster } = await import("../src/utils/posterCanvas.js");

  // 1. 单任务场景自适应高度紧凑收拢验证
  const canvas1 = createMockCanvas();
  drawGrowthPoster(canvas1, {
    childName: "天天",
    completedCount: 1,
    totalCount: 1,
    tasks: [{ id: "t1", title: "整理书包", reward_stars: 1, status: "completed" }],
  });

  // 1 任务逻辑高度 424，物理 848（包含品牌落款）
  assert.equal(canvas1.width, 720);
  assert.equal(canvas1.height, 848, "1 task poster height should be adaptively compacted to 848px");

  // 3 任务场景自适应高度扩展验证
  const canvas3 = createMockCanvas();
  drawGrowthPoster(canvas3, {
    childName: "天天",
    completedCount: 3,
    totalCount: 3,
    tasks: [
      { id: "t1", title: "整理书包", reward_stars: 1, status: "completed" },
      { id: "t2", title: "练习跳绳", reward_stars: 2, status: "completed" },
      { id: "t3", title: "自主阅读", reward_stars: 1, status: "completed" },
    ],
  });
  assert.equal(canvas3.height, 976, "3 tasks poster height should expand to 976px");

  // 2. 检查标题与白框的垂直间距（杜绝切字）
  const titleOp = canvas3._operations.find((op) => op.op === "fillText" && op.text === "今日自律清单");
  assert.ok(titleOp, "Must render '今日自律清单' title");
  const titleBottom = titleOp.y + 8;

  // 找到任务容器白框 roundRect 操作
  const taskBoxOp = canvas3._operations.find(
    (op) => op.op === "roundRect" && op.w === 308 && op.x === 26 && op.y >= 280
  );
  assert.ok(taskBoxOp, "Must render taskBox roundRect");
  assert.ok(
    taskBoxOp.y - titleBottom >= 10,
    `taskBox top (${taskBoxOp.y}) must have >= 10px breathing gap from title bottom (${titleBottom})`
  );

  // 3. 检查概览卡片第 3 行激励语缩进与前两行正文对齐（而非图标边缘）
  const line1Op = canvas3._operations.find((op) => op.op === "fillText" && String(op.text).includes("今日打卡"));
  const line2Op = canvas3._operations.find((op) => op.op === "fillText" && String(op.text).includes("今日奖励"));
  const line3Op = canvas3._operations.find(
    (op) => op.op === "fillText" && (String(op.text).includes("圆满达标") || String(op.text).includes("持之以恒"))
  );
  assert.ok(line1Op && line2Op && line3Op, "All 3 lines in daily card must be rendered");
  assert.equal(line1Op.x, 138, "Line 1 body text should start at x=138");
  assert.equal(line2Op.x, 138, "Line 2 body text should start at x=138");
  assert.equal(line3Op.x, 138, "Line 3 quote text should be indented to x=138, aligning with body text");

  // 4. 任务白框内部 padding 左右对称（各 16px）与垂直居中
  const starOp = canvas3._operations.find((op) => op.op === "fillText" && String(op.text).includes("+1"));
  assert.ok(starOp, "Must render task star reward");
  assert.equal(starOp.x, 26 + 308 - 16, "Stars text right margin must be 16px from box edge (318)");

  const checkArcOp = canvas3._operations.find((op) => op.op === "arc" && op.cx === 26 + 16 + 7);
  assert.ok(checkArcOp, "Checkmark circle left edge must be 16px from box edge (cx=49, r=7)");
  assert.equal(checkArcOp.cy, starOp.y, "Checkmark and star text must be vertically centered on same line");
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

test("Child PWA Today.jsx integrates SF Symbol ShareIcon button and mounts SharePosterModal", () => {
  const todayPath = path.resolve(__dirname, "../src/pages/Today.jsx");
  const content = fs.readFileSync(todayPath, "utf-8");

  // 1. ShareIcon button in top title area
  assert.ok(content.includes("ShareIcon"), "Today.jsx must import ShareIcon");
  assert.ok(content.includes("ios-share-trigger-btn"), "Today.jsx must have ios-share-trigger-btn class");
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
