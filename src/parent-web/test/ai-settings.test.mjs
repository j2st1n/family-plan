import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("parent-web api exposes fetchAiSettings, updateAiSettings, and testAiConnection", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url === "/api/v1/ai/settings" && opts?.method === "PUT") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          provider: "deepseek",
          base_url: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
          has_api_key: true,
          api_key_masked: "sk-****3a8f",
          is_enabled: true,
          active_mode: "DeepSeek",
        }),
      };
    }
    if (url === "/api/v1/ai/test-connection" && opts?.method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          latency_ms: 188,
          message: "连接成功 (188ms)",
          status_code: 200,
        }),
      };
    }
    // GET /api/v1/ai/settings
    return {
      ok: true,
      status: 200,
      json: async () => ({
        provider: "deepseek",
        base_url: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        has_api_key: false,
        api_key_masked: "",
        is_enabled: true,
        active_mode: "纯离线规则",
      }),
    };
  };

  const { default: api } = await import("../src/api.js");
  assert.equal(typeof api.fetchAiSettings, "function");
  assert.equal(typeof api.updateAiSettings, "function");
  assert.equal(typeof api.testAiConnection, "function");

  // 1. fetchAiSettings
  const settings = await api.fetchAiSettings("tok-ai-test");
  assert.equal(calls[0].url, "/api/v1/ai/settings");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok-ai-test");
  assert.equal(settings.active_mode, "纯离线规则");

  // 2. updateAiSettings
  const updated = await api.updateAiSettings("tok-ai-test", {
    provider: "deepseek",
    api_key: "sk-my-secret-key-3a8f",
  });
  assert.equal(calls[1].url, "/api/v1/ai/settings");
  assert.equal(calls[1].opts.method, "PUT");
  assert.equal(updated.has_api_key, true);
  assert.equal(updated.api_key_masked, "sk-****3a8f");

  // 3. testAiConnection
  const probe = await api.testAiConnection("tok-ai-test", {
    provider: "deepseek",
    base_url: "https://api.deepseek.com/v1",
  });
  assert.equal(calls[2].url, "/api/v1/ai/test-connection");
  assert.equal(calls[2].opts.method, "POST");
  assert.equal(probe.success, true);
  assert.equal(probe.latency_ms, 188);
});

test("Settings.jsx integrates AI Assistant entry item and iOS Canonical Drawer Sheet", () => {
  const settingsPath = path.resolve(__dirname, "../src/pages/Settings.jsx");
  const content = fs.readFileSync(settingsPath, "utf-8");

  // 1. Entry item in Inset Grouped list
  assert.ok(
    content.includes("AI 智能助手"),
    "Settings must have 'AI 智能助手' entry item"
  );
  assert.ok(
    content.includes('setActiveDrawer("aiSettings")'),
    "Settings must have trigger for aiSettings drawer"
  );
  assert.ok(
    content.includes("aiSettings?.active_mode"),
    "Entry item must display active running mode"
  );

  // 2. Canonical iOS Bottom Sheet Navigation Bar
  assert.ok(
    content.includes('activeDrawer === "aiSettings"'),
    "Must condition on activeDrawer === 'aiSettings'"
  );
  assert.ok(
    content.includes("drawer-handle-bar"),
    "Must have iOS handle bar"
  );
  assert.ok(
    content.includes("ios-sheet-header-title"),
    "Must have iOS centered header title"
  );
  assert.ok(
    content.includes("ios-sheet-nav-btn"),
    "Must have left cancel navigation button"
  );
  assert.ok(
    content.includes("ios-sheet-nav-action-btn"),
    "Must have right save navigation action button"
  );

  // 3. Card 1: Provider Segmented Control
  assert.ok(
    content.includes("AI_PRESETS"),
    "Must define provider presets"
  );
  assert.ok(
    content.includes("DeepSeek") &&
    content.includes("OpenAI") &&
    content.includes("本地 Ollama") &&
    content.includes("自定义中转"),
    "Must support 4 providers: DeepSeek, OpenAI, 本地 Ollama, 自定义中转"
  );
  assert.ok(
    content.includes("handleSelectAiProvider"),
    "Must auto prefill Base URL and Model on provider selection"
  );

  // 4. Card 2: Inset Grouped TableView Form
  assert.ok(
    content.includes("接口地址 (Base URL)"),
    "Must contain Base URL row"
  );
  assert.ok(
    content.includes("API Key"),
    "Must contain API Key row"
  );
  assert.ok(
    content.includes("showApiKey"),
    "Must toggle password visibility with eye icon"
  );
  assert.ok(
    content.includes("EyeIcon") && content.includes("EyeOffIcon"),
    "Must use EyeIcon and EyeOffIcon"
  );
  assert.ok(
    content.includes("LockIcon"),
    "Must use LockIcon for encryption security hint"
  );
  assert.ok(
    content.includes("AES-256-GCM"),
    "Must display server-side AES-256-GCM encryption guarantee"
  );
  assert.ok(
    content.includes("模型标识 (Model)"),
    "Must contain Model identifier row"
  );

  // 5. Card 3: Inline Test Connection Capsule Button
  assert.ok(
    content.includes("handleTestAiConnection"),
    "Must have connection probe handler"
  );
  assert.ok(
    content.includes("测试连接"),
    "Must have '测试连接' button text"
  );
  assert.ok(
    content.includes("probe-spinner"),
    "Must have probe-spinner for probing animation"
  );
  assert.ok(
    content.includes("#34C759"),
    "Must display green success feedback with latency"
  );
});
