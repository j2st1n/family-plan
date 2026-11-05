import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("UI Craft: Settings.jsx has grouped drawer architecture and dehydrated visuals", () => {
  const settingsPath = path.resolve(__dirname, "../src/pages/Settings.jsx");
  const content = fs.readFileSync(settingsPath, "utf-8");

  // Visual dehydration: Main header without raw emoji
  assert.ok(
    content.includes("我的设置"),
    "Settings must have clean '我的设置' header"
  );
  assert.ok(
    !content.includes("⚙️ 我的与设置"),
    "Settings must not have cluttered '⚙️ 我的与设置'"
  );

  // Grouped drawer architecture: 4 distinct drawer categories
  assert.ok(content.includes('setActiveDrawer("profiles")'), "Settings must have profiles drawer trigger");
  assert.ok(content.includes('setActiveDrawer("accessCode")'), "Settings must have accessCode drawer trigger");
  assert.ok(content.includes('setActiveDrawer("routineTasks")'), "Settings must have routineTasks drawer trigger");
  assert.ok(content.includes('setActiveDrawer("freeze")'), "Settings must have freeze drawer trigger");

  // iOS-style compact setting rows for freeze management
  assert.ok(content.includes("ios-setting-card"), "Settings must contain ios-setting-card class");
  assert.ok(content.includes("compact-stepper"), "Settings must contain compact-stepper for star cost");
  assert.ok(content.includes("pill-segment-group"), "Settings must contain pill-segment-group for limits and grants");

  // Empty state illustration
  assert.ok(content.includes("WarmEmptyState"), "Settings must import and use WarmEmptyState component");

  // Version number weakened at bottom
  assert.ok(content.includes("settings-version-footer"), "Settings must have settings-version-footer class");
});

test("UI Craft: Shop.jsx uses capsule micro-buttons and modal dialog for add/edit", () => {
  const shopPath = path.resolve(__dirname, "../src/pages/Shop.jsx");
  const content = fs.readFileSync(shopPath, "utf-8");

  // Micro capsule buttons
  assert.ok(content.includes("capsule-btn"), "Shop.jsx must use capsule-btn class");
  assert.ok(content.includes(">编辑<") || content.includes('">编辑<'), "Shop.jsx must have '编辑' capsule button instead of ✎");
  assert.ok(content.includes(">下架<") || content.includes('">下架<'), "Shop.jsx must have '下架' capsule button instead of ✕");
  assert.ok(content.includes(">通过<") || content.includes('">通过<'), "Shop.jsx must have '通过' capsule button instead of ✓");
  assert.ok(content.includes(">退回<") || content.includes('">退回<'), "Shop.jsx must have '退回' capsule button instead of ✕");

  // Modal dialog for items without inline deformation
  assert.ok(content.includes("itemModal"), "Shop.jsx must use itemModal dialog state");
  assert.ok(content.includes("openAddModal"), "Shop.jsx must have openAddModal handler");
  assert.ok(content.includes("openEditModal"), "Shop.jsx must have openEditModal handler");
  assert.ok(
    !content.includes("editingId === item.id"),
    "Shop.jsx must NOT expand inline editing in shelf rows"
  );
});

test("UI Craft: TodayDashboard.jsx touch safety cluster and focus aperture ring", () => {
  const todayPath = path.resolve(__dirname, "../src/pages/TodayDashboard.jsx");
  const content = fs.readFileSync(todayPath, "utf-8");

  // Touch safety cluster
  assert.ok(content.includes("task-action-cluster"), "TodayDashboard must use task-action-cluster");
  assert.ok(content.includes("task-micro-action"), "TodayDashboard must use task-micro-action for touch targets");

  // Journal input aperture ring class
  assert.ok(content.includes("form-input-journal"), "TodayDashboard must use form-input-journal for inputs");
});

test("UI Craft: Entire codebase has eradicated window.confirm and window.alert", () => {
  const srcDir = path.resolve(__dirname, "../../");

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!["node_modules", ".venv", "dist", ".git", ".pytest_cache"].includes(ent.name)) {
          scanDir(full);
        }
      } else if (ent.isFile() && (ent.name.endsWith(".jsx") || ent.name.endsWith(".js") && !ent.name.endsWith(".config.js"))) {
        const text = fs.readFileSync(full, "utf-8");
        // Ensure no active window.confirm or window.alert calls
        const hasWindowConfirm = /(?<!\/\/.*)window\.confirm\s*\(/.test(text);
        const hasWindowAlert = /(?<!\/\/.*)window\.alert\s*\(/.test(text);
        assert.ok(!hasWindowConfirm, `${full} must NOT call window.confirm()`);
        assert.ok(!hasWindowAlert, `${full} must NOT call window.alert()`);
      }
    }
  }

  scanDir(srcDir);
});

test("UI Craft: Analytics.jsx uses natural forest green scale without harsh greens", () => {
  const anaPath = path.resolve(__dirname, "../src/pages/Analytics.jsx");
  const content = fs.readFileSync(anaPath, "utf-8");

  assert.ok(!content.includes("#8FB299"), "Analytics must not use legacy green #8FB299");
  assert.ok(!content.includes("#76A28A"), "Analytics must not use legacy green #76A28A");
  assert.ok(content.includes("var(--cell-perfect)"), "Analytics must use var(--cell-perfect)");
  assert.ok(content.includes("var(--cell-qualified)"), "Analytics must use var(--cell-qualified)");
});
