import { APP_DESCRIPTION, drawBrandMark } from "./brand.js";

export const SHARE_CARD_COLORS = {
  paper: "#f5f5f7",
  white: "#ffffff",
  ink: "#1d1d1f",
  muted: "#606068",
  line: "#e5e5ea",
  accent: "#0071e3",
  track: "#e8e8ed",
  success: "#248a3d",
  successInk: "#1b7433",
};

export const SHARE_CARD_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
export function fitShareCardLabel(ctx, value, maxWidth) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  const characters = Array.from(value);
  while (characters.length && ctx.measureText(characters.join("") + "…").width > maxWidth) characters.pop();
  return characters.join("") + "…";
}

export function drawShareCardCount(ctx, count, unit, x, baseline, maxWidth) {
  const number = String(count);
  const gap = 8;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `550 24px ${SHARE_CARD_FONT}`;
  const unitMetrics = ctx.measureText(unit);
  ctx.font = `700 54px ${SHARE_CARD_FONT}`;
  const numberMetrics = ctx.measureText(number);
  const numberWidth = Math.min(numberMetrics.width, maxWidth - unitMetrics.width - gap);
  const unitBaseline = baseline + (numberMetrics.actualBoundingBoxDescent ?? 0) - (unitMetrics.actualBoundingBoxDescent ?? 0);

  ctx.fillStyle = SHARE_CARD_COLORS.accent;
  ctx.fillText(number, x, baseline, numberWidth);
  ctx.font = `550 24px ${SHARE_CARD_FONT}`;
  ctx.fillStyle = SHARE_CARD_COLORS.ink;
  ctx.fillText(unit, x + numberWidth + gap, unitBaseline);
  ctx.restore();
}

export function drawShareCardBrand(ctx, x, centerY) {
  // The artwork ends at y=909.3 in the mark's 150–950 viewBox.
  const inkBottom = (909.3 - 150) / 800;
  const markHeight = 18;
  const markTop = centerY - markHeight / 2;
  drawBrandMark(ctx, x, markTop, markHeight);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 10px ${SHARE_CARD_FONT}`;
  ctx.fillStyle = SHARE_CARD_COLORS.muted;
  const descent = ctx.measureText(APP_DESCRIPTION).actualBoundingBoxDescent ?? 0;
  ctx.fillText(APP_DESCRIPTION, x + 23, markTop + markHeight * inkBottom - descent);
  ctx.restore();
}
