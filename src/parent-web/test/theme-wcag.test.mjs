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

test("Theme System: WCAG 2.2 AA Contrast & Token Consistency in Parent Web", () => {
  const parentCssPath = path.resolve(__dirname, "../src/index.css");
  const childCssPath = path.resolve(__dirname, "../../child-pwa/src/index.css");
  const parentTokens = parseTokens(fs.readFileSync(parentCssPath, "utf-8"));
  const childTokens = parseTokens(fs.readFileSync(childCssPath, "utf-8"));

  // 1. Dual-client core token consistency check
  const sharedTokens = ["bg", "card", "card-subtle", "border", "border-subtle", "text", "muted", "accent", "accent-hover", "accent-light", "star", "star-bg", "star-border", "flame", "protect", "danger"];
  for (const token of sharedTokens) {
    assert.equal(
      parentTokens[token],
      childTokens[token],
      `Token --${token} must be identical across dual clients (parent: ${parentTokens[token]}, child: ${childTokens[token]})`
    );
  }

  // 2. WCAG text contrast check on Apple canvas/card
  const bgColors = [parentTokens["bg"], parentTokens["card"]];
  for (const bg of bgColors) {
    const textContrast = getContrastRatio(parentTokens["text"], bg);
    assert.ok(
      textContrast >= 4.5,
      `Text contrast (${parentTokens["text"]} on ${bg}) is ${textContrast.toFixed(2)}:1, must be >= 4.5:1`
    );

    const mutedContrast = getContrastRatio(parentTokens["muted"], bg);
    assert.ok(
      mutedContrast >= 3.0,
      `Muted contrast (${parentTokens["muted"]} on ${bg}) is ${mutedContrast.toFixed(2)}:1, must be >= 3.0:1`
    );

    const accentContrast = getContrastRatio(parentTokens["accent"], bg);
    assert.ok(
      accentContrast >= 4.0,
      `Accent contrast (${parentTokens["accent"]} on ${bg}) is ${accentContrast.toFixed(2)}:1, must be >= 4.0:1`
    );

    const starContrast = getContrastRatio(parentTokens["star"], bg);
    assert.ok(
      starContrast >= 2.0,
      `Star contrast (${parentTokens["star"]} on ${bg}) is ${starContrast.toFixed(2)}:1, must be >= 2.0:1`
    );
  }

  // 3. No dead black or legacy neon colors in parent web pages
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
