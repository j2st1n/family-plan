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
      const bytes = await response.body();
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const pixels = await page.evaluate(async base64 => {
        const img = new Image(); img.src = "data:image/png;base64," + base64; await img.decode();
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
        const p = ctx.getImageData(0, 0, c.width, c.height).data;
        let white = 0, visible = 0;
        for (let i = 0; i < p.length; i += 4) {
          if (p[i + 3]) visible++;
          if (p[i] === 255 && p[i + 1] === 255 && p[i + 2] === 255 && p[i + 3]) white++;
        }
        return { corners: [p[3], p[c.width * 4 - 1], p[(c.height - 1) * c.width * 4 + 3], p[p.length - 1]], white, visible, size: c.width };
      }, bytes.toString("base64"));
      if (selector === 'link[rel="icon"]') {
        assert.equal(url, "/assets/brand/favicon-32-v2.png");
        assert.equal(pixels.size, 32); assert.deepEqual(pixels.corners, [0, 0, 0, 0]);
        assert.equal(pixels.white, 0, "favicon has no white backing, including interior negative space");
        assert.ok(pixels.visible > 80 && pixels.visible < 700, "mark is visible with transparent space");
      } else {
        assert.equal(pixels.size, 180); assert.deepEqual(pixels.corners, [255, 255, 255, 255]);
        assert.ok(pixels.white > 0, "touch icon keeps its separate opaque backing");
      }
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
  console.log("Brand browser passed: both entries, transparent favicon corners/interior with visible mark, opaque touch icon, 320/390/834 light/dark, real PNG/manifest resources, vector poster mark/slogan and export, no page errors.");
} finally { await browser?.close(); for (const server of servers) await server.close(); }
