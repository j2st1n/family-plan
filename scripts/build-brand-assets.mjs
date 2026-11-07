import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../src/child-pwa/node_modules/playwright/index.mjs";
import { APP_DESCRIPTION, brandMarkSvg } from "../src/shared-web/brand.js";

const root = new URL("../src/shared-web/public/assets/brand/", import.meta.url);
await mkdir(root, { recursive: true });
const svg = brandMarkSvg();
await writeFile(new URL("parent-star-v1.svg", root), svg);
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_BROWSER === "chromium" ? {} : { channel: "chrome" }), headless: true });
try {
  const page = await browser.newPage();
  const exports = [
    { size: 32, file: "favicon-32-v2.png", transparent: true },
    ...[180, 192, 512].map(size => ({ size, file: `icon-${size}-v1.png`, transparent: false })),
  ];
  for (const { size, file, transparent } of exports) {
    const data = await page.evaluate(async ({ svg, size, transparent }) => {
      const image = new Image();
      image.src = "data:image/svg+xml;base64," + btoa(svg);
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!transparent) {
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
      }
      // Browser tabs use a transparent, larger mark; home-screen icons keep their safe margin.
      const h = size * (transparent ? .88 : .68), w = h * .9;
      ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { svg, size, transparent });
    await writeFile(new URL(file, root), Buffer.from(data, "base64"));
  }
} finally { await browser.close(); }
const manifest = {
  id: "/", name: APP_DESCRIPTION, short_name: APP_DESCRIPTION,
  lang: "zh-CN", start_url: "/", scope: "/", display: "standalone",
  background_color: "#f5f5f7", theme_color: "#f5f5f7",
  icons: [192, 512].map(size => ({ src: `/assets/brand/icon-${size}-v1.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any maskable" })),
};
await writeFile(new URL("app-v1.webmanifest", root), JSON.stringify(manifest, null, 2) + "\n");
console.log("Brand assets generated:", fileURLToPath(root));
