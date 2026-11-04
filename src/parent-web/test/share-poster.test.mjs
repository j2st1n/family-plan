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

test("posterCanvas exposes Apple System Colors conforming to HIG spec", async () => {
  const { APPLE_SYSTEM_COLORS } = await import("../src/utils/posterCanvas.js");
  assert.equal(APPLE_SYSTEM_COLORS.forestGreen, "#248A3D", "Forest green must be #248A3D");
  assert.equal(APPLE_SYSTEM_COLORS.appleBlue, "#0071E3", "Apple blue must be #0071E3");
  assert.equal(APPLE_SYSTEM_COLORS.warmGold, "#FF9500", "Warm gold must be #FF9500");
  assert.equal(APPLE_SYSTEM_COLORS.pureLightGray, "#F5F5F7", "Light gray must be #F5F5F7");
});

test("drawGrowthPoster configures 2x Retina canvas scale and renders all achievement elements", async () => {
  const { drawGrowthPoster, APPLE_SYSTEM_COLORS } = await import("../src/utils/posterCanvas.js");
  const canvas = createMockCanvas();

  drawGrowthPoster(canvas, {
    childName: "小明",
    dateStr: "2026-11-04",
    completionRate: 100,
    completedCount: 3,
    totalCount: 3,
    streakDays: 7,
    stars: 15,
    tasks: [
      { id: "t1", title: "晨读 20 分钟", reward_stars: 1, status: "completed" },
      { id: "t2", title: "口算练习", reward_stars: 2, status: "completed" },
      { id: "t3", title: "自主阅读", reward_stars: 1, status: "completed" },
    ],
    quote: "每一份小小的坚持，都是未来大大的光芒 ✨",
  });

  // 1. Retina 2x 物理分辨率校验
  assert.equal(canvas.width, 720, "Canvas width must be 360 * 2 = 720 for Retina 2x");
  assert.strictEqual(canvas.height, 500 * 2, "Canvas height must be 500 * 2 = 1000 for Retina 2x");

  const scaleOp = canvas._operations.find((op) => op.op === "scale");
  assert.ok(scaleOp, "Must call ctx.scale");
  assert.equal(scaleOp.x, 2, "scale x must be 2");
  assert.equal(scaleOp.y, 2, "scale y must be 2");

  // 2. 核心文本要素渲染验证
  const texts = canvas._textDrawn.join(" ");
  assert.ok(texts.includes("小明"), "Must render child name");
  assert.equal(texts.includes("100%"), true, "Must render 100% completion rate");
  assert.ok(texts.includes("7 天"), "Must render 7 days streak");
  assert.ok(texts.includes("15"), "Must render stars count");
  assert.ok(texts.includes("晨读 20 分钟"), "Must render completed task 1");
  assert.ok(texts.includes("口算练习"), "Must render completed task 2");

  // 3. 检查是否有使用外部网络图片（确保 0 CORS Taint 风险）
  const hasExternalImageCall = canvas._operations.some((op) => op.op === "drawImage");
  assert.equal(hasExternalImageCall, false, "Must use 100% native vector drawing without external images to eliminate CORS taint");
});

test("shareOrDownloadPoster handles Web Share API and graceful fallback download", async () => {
  const { shareOrDownloadPoster } = await import("../src/utils/posterCanvas.js");
  const canvas = createMockCanvas();

  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  try {
    // 1. Web Share API 成功路径
    let shareCalled = false;
    let shareData = null;
    const mockNav = {
      share: async (data) => {
        shareCalled = true;
        shareData = data;
      },
      canShare: () => false, // fallback to standard url/title share
    };
    Object.defineProperty(globalThis, "navigator", { value: mockNav, configurable: true, writable: true });

    const res1 = await shareOrDownloadPoster(canvas, {
      childName: "小明",
      dateStr: "2026-11-04",
    });
    assert.equal(shareCalled, true, "navigator.share should be called");
    assert.equal(res1.method, "web-share-url");

    // 2. 用户取消分享（AbortError）静默处理
    mockNav.share = async () => {
      const err = new Error("The user aborted the share operation");
      err.name = "AbortError";
      throw err;
    };
    const resAbort = await shareOrDownloadPoster(canvas, { childName: "小明" });
    assert.equal(resAbort.method, "user-cancelled");

    // 3. 降级为直接下载
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    let clicked = false;
    let appended = false;
    let removed = false;
    globalThis.document = {
      createElement: () => ({
        click: () => { clicked = true; },
        set href(val) {},
        set download(val) {},
      }),
      body: {
        appendChild: () => { appended = true; },
        removeChild: () => { removed = true; },
      },
    };

    const resDownload = await shareOrDownloadPoster(canvas, { childName: "小明" });
    assert.equal(resDownload.method, "download");
    assert.equal(clicked, true, "Should trigger a download click");
    assert.equal(appended, true, "Should append link to body");
    assert.equal(removed, true, "Should remove link after click to prevent memory leaks");
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true, writable: true });
    }
    globalThis.document = originalDocument;
  }
});

test("TodayDashboard.jsx integrates SF Symbol ShareIcon and SharePosterModal", () => {
  const dashboardPath = path.resolve(__dirname, "../src/pages/TodayDashboard.jsx");
  const content = fs.readFileSync(dashboardPath, "utf-8");

  // 1. 顶部 SF Symbol 分享按钮
  assert.ok(content.includes("ShareIcon"), "TodayDashboard must import ShareIcon");
  assert.ok(content.includes("ios-share-trigger-btn"), "TodayDashboard must have share trigger button with ios-share-trigger-btn class");
  assert.ok(content.includes("setShowShareModal(true)"), "Share button must trigger setShowShareModal(true)");

  // 2. 模态框挂载
  assert.ok(content.includes("<SharePosterModal"), "TodayDashboard must render SharePosterModal");
  assert.ok(content.includes("open={showShareModal}"), "SharePosterModal must be bound to showShareModal");
  assert.ok(content.includes("completionRate={completionRate}"), "Must pass completionRate");
  assert.ok(content.includes("streakDays={rewards.current_streak_days"), "Must pass streakDays");
});

test("SharePosterModal.jsx conforms to iOS Sheet HIG and provides preview and action buttons", () => {
  const modalPath = path.resolve(__dirname, "../src/components/SharePosterModal.jsx");
  const content = fs.readFileSync(modalPath, "utf-8");

  // 1. iOS Sheet 结构
  assert.ok(content.includes("ios-sheet-overlay"), "Must have ios-sheet-overlay");
  assert.ok(content.includes("ios-sheet-content"), "Must have ios-sheet-content");
  assert.ok(content.includes("drawer-handle-bar"), "Must have iOS drawer-handle-bar");
  assert.ok(content.includes("ios-sheet-header-title"), "Must have ios-sheet-header-title");
  assert.ok(content.includes("自律成长成就卡"), "Must have title '自律成长成就卡'");

  // 2. 图片预览与长按保存提示
  assert.ok(content.includes("ios-poster-preview-img"), "Must have poster preview image");
  assert.ok(content.includes("长按图片"), "Must have '长按图片' hint for mobile/WeChat users");

  // 3. 并排操作按钮（分享、保存）
  assert.ok(content.includes("保存"), "Must provide '保存' button");
  assert.ok(content.includes("分享"), "Must provide Web Share trigger button");
});
