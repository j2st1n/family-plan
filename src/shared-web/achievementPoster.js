import { formatStars } from "./format.js";
import { drawShareCardBrand, drawShareCardCount, fitShareCardLabel, SHARE_CARD_COLORS as C, SHARE_CARD_FONT } from "./shareCardStyle.js";

const WIDTH = 360;
const MARGIN = 32;
const RIGHT = WIDTH - MARGIN;
const CONTENT_WIDTH = RIGHT - MARGIN;
const MAX_TASKS = 3;

function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px ${SHARE_CARD_FONT}`;
}

function text(ctx, value, x, y, { size = 12, weight = 500, color = C.ink, align = "left", maxWidth } = {}) {
  setFont(ctx, size, weight);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  if (maxWidth === undefined) ctx.fillText(String(value), x, y);
  else ctx.fillText(String(value), x, y, maxWidth);
}

function drawDivider(ctx, y) {
  ctx.beginPath();
  ctx.moveTo(MARGIN, y);
  ctx.lineTo(RIGHT, y);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.stroke();
}

function fitLabel(ctx, value, maxWidth, size, weight) {
  setFont(ctx, size, weight);
  return fitShareCardLabel(ctx, value, maxWidth);
}

function drawCheck(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y + 4);
  ctx.lineTo(x + 12, y - 5);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = C.success;
  ctx.stroke();
}

export function drawGrowthPoster(canvas, {
  childName = "小朋友",
  dateStr = "",
  isToday = true,
  completionRate = 0,
  completedCount = 0,
  totalCount = 0,
  streakDays = 0,
  stars = 0,
  starsToday = 0,
  tasks = [],
} = {}) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const completed = (tasks || []).filter(task => task.status === "completed");
  const visibleTasks = completed.slice(0, MAX_TASKS);
  const remaining = completed.length - visibleTasks.length;
  const hasTasks = totalCount > 0 || completed.length > 0;
  const rowHeight = 36;
  const listTop = 218;
  const listBottom = listTop + Math.max(1, visibleTasks.length) * rowHeight;
  const metadataTop = hasTasks ? listBottom + (remaining ? 49 : 28) : 164;
  const brandCenter = metadataTop + (hasTasks ? 55 : 34);
  const height = brandCenter + 30;

  canvas.width = WIDTH * 2;
  canvas.height = height * 2;
  ctx.save();
  ctx.scale(2, 2);
  ctx.textBaseline = "middle";

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, WIDTH, height);

  text(ctx, isToday ? "Today" : "Daily Log", MARGIN, 46, { size: 24, weight: 650 });
  const name = fitLabel(ctx, String(childName), 141, 13, 600);
  text(ctx, name, RIGHT, 36, { size: 13, weight: 600, align: "right" });
  text(ctx, dateStr || new Date().toISOString().slice(0, 10), RIGHT, 54, {
    size: 11, align: "right", color: C.muted, maxWidth: 102,
  });

  if (hasTasks) {
    text(ctx, "完成了", MARGIN, 94, { size: 14, color: C.muted });
    drawShareCardCount(ctx, completedCount, "件事", MARGIN, 151, CONTENT_WIDTH);

    const headingY = listTop - 18;
    const dailyReward = `${starsToday > 0 ? "+" : ""}${formatStars(starsToday)} 星`;
    text(ctx, "已完成任务", MARGIN, headingY, { size: 12, color: C.muted });
    text(ctx, `收获 ${dailyReward}`, RIGHT, headingY, {
      size: 12, color: C.muted, align: "right", maxWidth: 153,
    });
    visibleTasks.forEach((task, index) => {
      const center = listTop + (index + 0.5) * rowHeight;
      const titleX = MARGIN + 24;
      drawCheck(ctx, MARGIN + 1, center);
      const reward = `+${formatStars(task.stars_awarded ?? task.reward_stars ?? 1)} 星`;
      text(ctx, reward, RIGHT, center, { size: 11, color: C.muted, align: "right", maxWidth: 66 });
      const taskTitle = fitLabel(ctx, String(task.title ?? ""), RIGHT - titleX - 77, 14, 450);
      text(ctx, taskTitle, titleX, center, { size: 14, weight: 450 });
    });
    if (remaining) {
      text(ctx, `另有 ${remaining} 项已完成`, MARGIN + 24, listBottom + 12, { size: 11, color: C.muted });
    } else if (!visibleTasks.length) {
      text(ctx, "还没有完成的任务", MARGIN, listTop + rowHeight / 2, { color: C.muted });
    }
  } else {
    text(ctx, "没有安排任务", MARGIN, 109, { size: 22, weight: 650 });
  }

  drawDivider(ctx, metadataTop - 17);
  if (hasTasks) {
    text(ctx, `任务共 ${totalCount} 件`, MARGIN, metadataTop, {
      size: 11, color: C.muted, maxWidth: 138,
    });
    text(ctx, `完成率 ${completionRate}%`, RIGHT, metadataTop, {
      size: 11, color: C.muted, align: "right", maxWidth: 138,
    });
  }
  const balanceY = metadataTop + (hasTasks ? 20 : 0);
  text(ctx, `当前连胜 ${streakDays} 天`, MARGIN, balanceY, { size: 11, color: C.muted, maxWidth: 138 });
  text(ctx, `星星余额 ${formatStars(stars)} 星`, RIGHT, balanceY, { size: 11, color: C.muted, align: "right", maxWidth: 138 });
  drawShareCardBrand(ctx, MARGIN, brandCenter);
  ctx.restore();
}

/**
 * 调起 Web Share API 或降级为本地下载
 */
export async function shareOrDownloadPoster(canvas, {
  childName = "小朋友",
  dateStr = "",
  title = "自律成长成就卡",
  text = "",
} = {}) {
  if (!canvas) return { success: false, method: "none" };

  const shareText = text || `${childName} 在 ${dateStr} 的自律成长成就卡，太棒啦！继续加油！`;

  // 1. 尝试移动端 Web Share API (包含文件分享)
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      if (typeof canvas.toBlob === "function") {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) {
          const file = new File([blob], `growth-achievement-${Date.now()}.png`, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title,
              text: shareText,
            });
            return { success: true, method: "web-share-file" };
          }
        }
      }

      // 如果不能分享文件，尝试调起标准文本分享
      await navigator.share({
        title,
        text: shareText,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
      return { success: true, method: "web-share-url" };
    } catch (err) {
      if (err.name === "AbortError") {
        // 用户主动取消分享面板，属于正常交互，无需报错
        return { success: true, method: "user-cancelled" };
      }
      console.warn("[shareOrDownloadPoster] Web Share API 失败，执行降级下载:", err);
    }
  }

  // 2. 降级方案：执行纯前端无污染直接下载
  downloadPoster(canvas, `${childName}-自律成就-${dateStr || "today"}.png`);
  return { success: true, method: "download" };
}

/**
 * 原生前端安全下载图片（无跨域污染、无内存泄漏）
 */
export function downloadPoster(canvas, filename = "growth-achievement.png") {
  if (!canvas || typeof document === "undefined") return;
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
