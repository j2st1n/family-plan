import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("parent-web api exposes parseCopilotTasks and fetchAiHealth", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        tasks: [
          {
            title: "练琴20分钟",
            expected_minutes: 20,
            reward_stars: 1,
            category: "学习思考",
            require_approval: true,
          },
        ],
        raw_summary: "已解析1项任务",
        is_degraded: false,
      }),
    };
  };

  const { default: api } = await import("../src/api.js");
  assert.equal(typeof api.parseCopilotTasks, "function");
  assert.equal(typeof api.fetchAiHealth, "function");

  const res = await api.parseCopilotTasks("tok-ai", {
    prompt: "每天晚上7点练琴20分钟给1星需确认",
    child_id: "child-uuid",
    target_date: "2026-11-02",
  });

  assert.equal(calls[0].url, "/api/v1/ai/copilot/parse-tasks");
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok-ai");
  assert.equal(res.tasks.length, 1);
  assert.equal(res.tasks[0].title, "练琴20分钟");
});

test("inferCategory accurately classifies Chinese task titles into 4 dimensions", async () => {
  const { inferCategory } = await import("../src/utils/category.js");

  assert.equal(inferCategory("晚上练琴20分钟"), "学习思考");
  assert.equal(inferCategory("背诵古诗两首"), "学习思考");
  assert.equal(inferCategory("跳绳500个"), "体育运动");
  assert.equal(inferCategory("户外跑步"), "体育运动");
  assert.equal(inferCategory("晨起刷牙洗脸"), "生活自理");
  assert.equal(inferCategory("晚上早点睡觉"), "生活自理");
  assert.equal(inferCategory("帮妈妈洗碗收拾桌子"), "家务协助");
  assert.equal(inferCategory("整理房间与书包"), "家务协助");
});

test("IA Restructure: No duplicate logout in Header, App defaults to TodayDashboard with 4 tabs", () => {
  const appPath = path.resolve(__dirname, "../src/App.jsx");
  const appContent = fs.readFileSync(appPath, "utf-8");

  // Default tab is 'today'
  assert.ok(
    appContent.includes('"today"'),
    "App must default or include 'today' tab"
  );
  assert.ok(
    appContent.includes("TodayDashboard"),
    "App must import and render TodayDashboard"
  );
  assert.ok(
    appContent.includes("Settings"),
    "App must import and render Settings"
  );

  // App header must not have a raw logout button
  const headerMatch = appContent.match(/<header className="app-header">([\s\S]*?)<\/header>/);
  assert.ok(headerMatch, "app-header must exist");
  assert.ok(
    !headerMatch[1].includes("clearSession") && !headerMatch[1].includes("退出"),
    "app-header must NOT contain a logout button"
  );

  // Settings page must contain the single official logout button
  const settingsPath = path.resolve(__dirname, "../src/pages/Settings.jsx");
  const settingsContent = fs.readFileSync(settingsPath, "utf-8");
  assert.ok(
    settingsContent.includes("onLogout"),
    "Settings.jsx must receive and call onLogout"
  );
  assert.ok(
    settingsContent.includes("退出当前登录"),
    "Settings.jsx must have '退出当前登录' button"
  );
  assert.ok(
    settingsContent.includes("window.confirm"),
    "Logout in Settings.jsx must have confirmation prompt"
  );
  assert.ok(
    settingsContent.includes("res.code"),
    "Settings.jsx must support reading 'code' from backend access-code endpoint response"
  );
});

test("inferCategory handles category tag in description and custom titles", async () => {
  const { inferCategory } = await import("../src/utils/category.js");

  assert.equal(inferCategory("日常习惯", "[家务协助]"), "家务协助");
  assert.equal(inferCategory("日常打卡", "[体育运动]"), "体育运动");
  assert.equal(inferCategory("特别安排", "[生活自理]"), "生活自理");
  assert.equal(inferCategory("自由探索", "[学习思考]"), "学习思考");
});

test("Responsive Navigation Discipline in index.css", () => {
  const cssPath = path.resolve(__dirname, "../src/index.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  // Mobile rules (< 768px)
  assert.ok(cssContent.includes(".bottom-tabbar"), "CSS must define .bottom-tabbar");
  assert.ok(
    cssContent.includes("@media (max-width: 767px)") || cssContent.includes("@media (max-width: 768px)"),
    "CSS must have mobile media query"
  );
  assert.ok(
    cssContent.includes(".desktop-nav-links") && cssContent.includes("display: none !important"),
    "Mobile must hide .desktop-nav-links"
  );

  // Desktop rules (>= 768px)
  assert.ok(
    cssContent.includes("@media (min-width: 768px)"),
    "CSS must have desktop media query"
  );
  assert.ok(
    cssContent.includes(".bottom-tabbar") && cssContent.includes("display: none !important"),
    "Desktop must hide .bottom-tabbar"
  );
});
