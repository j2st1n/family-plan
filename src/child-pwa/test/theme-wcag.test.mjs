import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function srgbToLinear(c) {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function getContrastRatio(color1, color2) {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseTokens(cssContent) {
  const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return {};
  const tokens = {};
  const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = varRegex.exec(rootMatch[1])) !== null) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

test("Theme System: WCAG 2.2 AA Contrast & Token Integrity in Child PWA", () => {
  const cssPath = path.resolve(__dirname, "../src/index.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");
  const tokens = parseTokens(cssContent);

  // 1. Verify Paper Tokens
  assert.equal(tokens["bg"], "#FAF8F5", "Warm oat paper background must be #FAF8F5");
  assert.equal(tokens["card"], "#FFFFFF", "Card background must be #FFFFFF");
  assert.equal(tokens["border"], "#E8E2D5", "Paper border must be #E8E2D5");
  assert.equal(tokens["text"], "#2D3731", "Deep moss ink text must be #2D3731");
  assert.equal(tokens["accent"], "#436A54", "Forest moss green accent must be #436A54");

  // 2. WCAG 2.2 AA Check: Text & Muted on paper backgrounds must be >= 4.5:1
  const bgColors = [tokens["bg"], tokens["card"]];
  for (const bg of bgColors) {
    const textContrast = getContrastRatio(tokens["text"], bg);
    assert.ok(
      textContrast >= 4.5,
      `Text contrast (${tokens["text"]} on ${bg}) is ${textContrast.toFixed(2)}:1, must be >= 4.5:1`
    );

    const mutedContrast = getContrastRatio(tokens["muted"], bg);
    assert.ok(
      mutedContrast >= 4.5,
      `Muted text contrast (${tokens["muted"]} on ${bg}) is ${mutedContrast.toFixed(2)}:1, must be >= 4.5:1`
    );

    const accentContrast = getContrastRatio(tokens["accent"], bg);
    assert.ok(
      accentContrast >= 4.5,
      `Accent contrast (${tokens["accent"]} on ${bg}) is ${accentContrast.toFixed(2)}:1, must be >= 4.5:1`
    );
  }

  // 3. Child ergonomic 72px check button exists
  assert.ok(cssContent.includes(".task-check-btn"), ".task-check-btn class must be defined");
  assert.ok(cssContent.includes("width: 72px;"), "Button must have 72px width");
  assert.ok(cssContent.includes("height: 72px;"), "Button must have 72px height");
  assert.ok(cssContent.includes("stampSpringPop"), "Spring pop tactile animation must be present");

  // 4. No legacy colors or dead black in child pwa pages
  const pagesDir = path.resolve(__dirname, "../src/pages");
  const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith(".jsx"));
  for (const f of pageFiles) {
    const content = fs.readFileSync(path.join(pagesDir, f), "utf-8");
    assert.ok(!content.includes("#3d9e6b"), `${f} must not contain legacy green #3d9e6b`);
    assert.ok(!content.includes("#4b9c64"), `${f} must not contain legacy green #4b9c64`);
    assert.ok(!content.includes("#73706b"), `${f} must not contain legacy gray #73706b`);
    assert.ok(!content.includes("#2d2b28"), `${f} must not contain legacy black #2d2b28`);
    assert.ok(!content.includes("#c97070"), `${f} must not contain legacy red #c97070`);
    assert.ok(!content.includes("#c4912a"), `${f} must not contain legacy yellow #c4912a`);
    assert.ok(!content.includes("#000000"), `${f} must not contain dead black #000000`);
  }
});
