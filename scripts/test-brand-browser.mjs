import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/child-pwa/node_modules/vite/dist/node/index.js";
import { chromium } from "../src/child-pwa/node_modules/playwright/index.mjs";

const output = process.env.BROWSER_ARTIFACT_DIR || join(tmpdir(), "family-plan-brand-qa");
const servers = await Promise.all(["parent-web", "child-pwa"].map((app, i) => createServer({
  root: fileURLToPath(new URL(`../src/${app}/`, import.meta.url)),
  server: { host: "127.0.0.1", port: 19173 + i, strictPort: true },
})));
let browser;
try {
  await mkdir(output, { recursive: true });
  for (const server of servers) await server.listen();
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_BROWSER === "chromium" ? {} : { channel: "chrome" }), headless: true });
  const errors = [];
  for (const [i, app] of ["parent-web", "child-pwa"].entries()) {
    const page = await browser.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.route("https://**/*", route => route.abort());
    await page.goto(`http://127.0.0.1:${19173 + i}`);
    assert.match(await page.title(), /^Family Habit Planner/);
    await page.getByRole("heading", { name: "Small steps. Shared growth.", exact: true }).waitFor();
    await page.getByRole("img", { name: "Family Habit Planner", exact: true }).evaluate(img => img.decode());
    assert.equal(await page.getByText("Family Plan", { exact: true }).count(), 0);
    for (const selector of ['link[rel="icon"]', 'link[rel="apple-touch-icon"]']) {
      const url = await page.locator(selector).getAttribute("href");
      const response = await page.request.get(new URL(url, page.url()).href);
      assert.equal(response.status(), 200); assert.match(response.headers()["content-type"], /image\/png/);
      assert.deepEqual([...(await response.body()).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
    const manifest = await (await page.request.get(new URL(await page.locator('link[rel="manifest"]').getAttribute("href"), page.url()).href)).json();
    assert.equal(manifest.name, "Family Habit Planner");
    for (const icon of manifest.icons) {
      const response = await page.request.get(new URL(icon.src, page.url()).href);
      assert.equal(response.status(), 200); assert.match(response.headers()["content-type"], /image\/png/);
    }
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const width of [320, 390, 834]) {
        await page.setViewportSize({ width, height: 740 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const title = page.locator("#auth-title");
        assert.ok(await title.evaluate(e => e.getBoundingClientRect().width >= e.scrollWidth));
        await page.screenshot({ path: `${output}/${app}-${theme}-${width}.png`, animations: "disabled" });
      }
    }
    // The downloaded poster must retain its vector mark and slogan without image/network dependencies.
    const poster = await page.evaluate(async () => {
      const { drawGrowthPoster } = await import("/src/utils/posterCanvas.js");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d"), texts = [];
      const original = ctx.fillText.bind(ctx);
      ctx.fillText = (text, ...args) => { texts.push(String(text)); original(text, ...args); };
      drawGrowthPoster(canvas, { childName: "合成示例", dateStr: "2026-11-07", tasks: [] });
      const bottom = ctx.getImageData(0, canvas.height - 140, canvas.width, 140).data;
      let blue = 0, gold = 0;
      for (let i = 0; i < bottom.length; i += 4) {
        if (bottom[i + 2] > 180 && bottom[i] < 40 && bottom[i + 1] > 70) blue++;
        if (bottom[i] > 230 && bottom[i + 1] > 140 && bottom[i + 1] < 210 && bottom[i + 2] < 120) gold++;
      }
      return { slogan: texts.includes("Small steps. Shared growth."), blue, gold, png: canvas.toDataURL().startsWith("data:image/png") };
    });
    assert.ok(poster.slogan && poster.blue > 10 && poster.gold > 2 && poster.png, JSON.stringify(poster));
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("Brand browser passed: both entries, 320/390/834 light/dark, real favicon/touch/manifest PNGs, vector poster mark/slogan and export, no page errors.");
} finally { await browser?.close(); for (const server of servers) await server.close(); }
