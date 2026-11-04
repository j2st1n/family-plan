/**
 * Apple iOS HIG 极简质感自律成长成就海报 Canvas 原生绘制引擎
 * - 高分辨率 Retina 2x 原生 HTML5 Canvas 绘制，杜绝低质脚本绘图与高 DPI 模糊
 * - 纯矢量原生几何与系统字体渲染，零外部网络资源加载，100% 杜绝 CORS Taint 脏画布与内存泄漏
 * - 规范 Apple System Colors：
 *   - 森林绿 #248A3D
 *   - 苹果蓝 #0071E3
 *   - 暖金   #FF9500
 *   - 纯净浅灰 #F5F5F7
 */

export const APPLE_SYSTEM_COLORS = {
  forestGreen: "#248A3D",
  forestGreenBg: "#EBF5EB",
  appleBlue: "#0071E3",
  appleBlueBg: "#F0F6FF",
  appleBlueBorder: "#D8E8FF",
  warmGold: "#FF9500",
  warmGoldBg: "#FFF9EB",
  pureLightGray: "#F5F5F7",
  cardBg: "#FFFFFF",
  cardBorder: "#E5E5EA",
  separator: "#F2F2F7",
  textPrimary: "#1C1C1E",
  textSecondary: "#8E8E93",
  textTertiary: "#AEAEB2",
};

/**
 * 跨平台圆角矩形路径绘制（兼容不支持 ctx.roundRect 的旧环境与测试执行器）
 */
export function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = typeof radius === "number" ? radius : (radius?.[0] || 0);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

/**
 * 纯原生 Canvas 绘制苹果风格勾选徽章
 */
export function drawCheckmark(ctx, cx, cy, radius, bgColor = APPLE_SYSTEM_COLORS.forestGreen) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // 纯白勾选折线
  ctx.beginPath();
  const s = radius * 0.45;
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.8);
  ctx.lineTo(cx + s, cy - s * 0.6);
  ctx.lineWidth = Math.max(1.8, radius * 0.26);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * 绘制 Apple Fitness 风格圆环进度条
 */
export function drawActivityRing(ctx, cx, cy, radius, strokeWidth, progress = 0) {
  ctx.save();
  // 1. 底层灰环
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = APPLE_SYSTEM_COLORS.cardBorder;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  // 2. 前景进度环 (Apple Forest Green)
  if (progress > 0) {
    const clamped = Math.min(1, Math.max(0, progress));
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + clamped * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = APPLE_SYSTEM_COLORS.forestGreen;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 文本截断工具
 */
function truncateText(text, maxChars = 14) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

/**
 * 获取温馨亲子成长寄语
 */
export function getWarmEncouragementQuote(completionRate = 0, streakDays = 0) {
  if (completionRate >= 100) {
    return "太棒了！今天所有计划全部达成，自律的你闪闪发光 ✨";
  }
  if (streakDays >= 3) {
    return "坚持让好习惯生根发芽，每一步都算数，继续加油！🔥";
  }
  if (completionRate >= 50) {
    return "已经走过大半路程啦，保持节奏，终点就在眼前！💪";
  }
  return "每一份小小的坚持，都是未来大大的光芒 🌱";
}

/**
 * 原生 Canvas 纯矢量绘制自律成长成就海报
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options
 */
export function drawGrowthPoster(canvas, {
  childName = "小朋友",
  dateStr = "",
  completionRate = 100,
  completedCount = 0,
  totalCount = 0,
  streakDays = 0,
  stars = 0,
  starsToday = 0,
  tasks = [],
  quote = "",
} = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. 2x Retina 高清像素适配 (固定逻辑画布 360 x 580，物理渲染 720 x 1160)
  const logicalWidth = 360;
  const logicalHeight = 500;
  const dpr = 2;

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  // 清除画布
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  // 2. 外层 Apple 纯净浅灰底板
  ctx.beginPath();
  drawRoundedRect(ctx, 0, 0, logicalWidth, logicalHeight, 24);
  ctx.fillStyle = APPLE_SYSTEM_COLORS.pureLightGray;
  ctx.fill();

  // 3. 核心内卡片（高质感白卡 + 细边框）
  const cardX = 14;
  const cardY = 14;
  const cardW = 332;
  const cardH = 472;
  ctx.beginPath();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.fillStyle = APPLE_SYSTEM_COLORS.cardBg;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = APPLE_SYSTEM_COLORS.cardBorder;
  ctx.stroke();

  // 4. 顶部 Header 区
  // 胶囊勋章标签
  ctx.beginPath();
  drawRoundedRect(ctx, 28, 28, 118, 24, 12);
  ctx.fillStyle = APPLE_SYSTEM_COLORS.forestGreenBg;
  ctx.fill();
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.forestGreen;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("🌱 自律成长成就卡", 37, 40);

  // 日期文本
  ctx.font = "500 11.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
  ctx.textAlign = "right";
  ctx.fillText(dateStr || new Date().toISOString().slice(0, 10), 332, 40);

  // 主标题：孩子自律成长
  ctx.textAlign = "left";
  ctx.font = "700 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textPrimary;
  ctx.fillText(`${childName} 的今日自律成就`, 28, 76);

  // 副标题
  ctx.font = "400 11px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
  const subText = completionRate === 100
    ? "今日目标 100% 达成，为自律与专注喝彩！🎉"
    : "点滴积累，每一份坚持都是成长的印记。";
  ctx.fillText(subText, 28, 94);

  // 5. 【当日数据看板】（环形图 + 当日打卡进度 + 当日奖励）
  const ringBoxX = 28;
  const ringBoxY = 108;
  const ringBoxW = 304;
  const ringBoxH = 92;

  ctx.beginPath();
  drawRoundedRect(ctx, ringBoxX, ringBoxY, ringBoxW, ringBoxH, 14);
  ctx.fillStyle = "#F9F9FB";
  ctx.fill();
  ctx.strokeStyle = "#EFEFF4";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 环形进度圈 (中心 cx=74, cy=154, r=32)
  drawActivityRing(ctx, 74, 154, 32, 6.5, completionRate / 100);

  // 环形图中心文本
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 16px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textPrimary;
  ctx.fillText(`${completionRate}%`, 74, 149);

  ctx.font = "500 9px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
  ctx.fillText("今日达成", 74, 165);

  // 右侧：当日数据聚集 (纯当日)
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // 当日完成项数
  ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.forestGreen;
  ctx.fillText(`📋 今日打卡：已完成 ${completedCount} / ${totalCount} 项`, 122, 137);

  // 当日获得星星
  ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.warmGold;
  ctx.fillText(`⭐ 今日奖励：${starsToday > 0 ? `+${starsToday}` : "0"} 颗新星`, 122, 158);

  // 当日鼓励小标语
  ctx.font = "400 9.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
  const todayNote = completionRate === 100 ? "今日所有日常任务圆满达标！🎉" : "持之以恒，点滴进步看得见";
  ctx.fillText(todayNote, 122, 178);

  // 6. 【累计荣誉看板】（双栏并列：🔥 连续自律天数 + 💰 累计总星池）
  const cumY = 210;
  const cumCardW = 146;
  const cumCardH = 48;

  // 累计卡 1: 连续自律 (累计天数)
  ctx.beginPath();
  drawRoundedRect(ctx, 28, cumY, cumCardW, cumCardH, 10);
  ctx.fillStyle = APPLE_SYSTEM_COLORS.pureLightGray;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.warmGold;
  ctx.fillText(`🔥 ${streakDays} 天`, 28 + cumCardW / 2, cumY + 17);

  ctx.font = "500 9.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
  ctx.fillText("累计连胜天数", 28 + cumCardW / 2, cumY + 34);

  // 累计卡 2: 累计总星池 (累计资产)
  ctx.beginPath();
  drawRoundedRect(ctx, 186, cumY, cumCardW, cumCardH, 10);
  ctx.fillStyle = APPLE_SYSTEM_COLORS.pureLightGray;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.appleBlue;
  ctx.fillText(`💰 ${Number(stars).toFixed(0)} 颗`, 186 + cumCardW / 2, cumY + 17);

  ctx.font = "500 9.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
  ctx.fillText("累计总星池", 186 + cumCardW / 2, cumY + 34);

  // 7. 已完成任务清单 (勾选条目)
  ctx.textAlign = "left";
  ctx.font = "700 12.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.textPrimary;
  ctx.fillText("今日自律清单", 28, 294);

  ctx.textAlign = "right";
  ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = APPLE_SYSTEM_COLORS.forestGreen;
  ctx.fillText(`已达成 ${completedCount} 项`, 332, 294);

  // 任务容器白盒
  const taskBoxX = 28;
  const taskBoxY = 304;
  const taskBoxW = 304;
  const taskBoxH = 118;
  ctx.beginPath();
  drawRoundedRect(ctx, taskBoxX, taskBoxY, taskBoxW, taskBoxH, 12);
  ctx.fillStyle = "#FAFAFA";
  ctx.fill();
  ctx.strokeStyle = "#EFEFF4";
  ctx.lineWidth = 1;
  ctx.stroke();

  const completedList = (tasks || []).filter((t) => t.status === "completed");

  if (completedList.length > 0) {
    const maxVisible = 3;
    const visibleTasks = completedList.slice(0, maxVisible);

    visibleTasks.forEach((t, i) => {
      const itemY = taskBoxY + 18 + i * 28;

      // 纯矢量绿底白勾徽章
      drawCheckmark(ctx, taskBoxX + 16, itemY, 6.5, APPLE_SYSTEM_COLORS.forestGreen);

      // 任务标题
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "500 11.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
      ctx.fillStyle = APPLE_SYSTEM_COLORS.textPrimary;
      ctx.fillText(truncateText(t.title, 14), taskBoxX + 28, itemY);

      // 右侧星星奖励
      ctx.textAlign = "right";
      ctx.font = "600 10.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
      ctx.fillStyle = APPLE_SYSTEM_COLORS.warmGold;
      ctx.fillText(`⭐ +${t.reward_stars || 1}`, taskBoxX + taskBoxW - 14, itemY);
    });

    if (completedList.length > maxVisible) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 10px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
      ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
      ctx.fillText(
        `… 还有 ${completedList.length - maxVisible} 项任务已完美打卡达成 ✨`,
        taskBoxX + taskBoxW / 2,
        taskBoxY + 104
      );
    }
  } else {
    // 任务暂未完成提示
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "400 11px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
    ctx.fillStyle = APPLE_SYSTEM_COLORS.textSecondary;
    ctx.fillText("今日自律行动进行中，完成任务即可点亮清单！🌱", taskBoxX + taskBoxW / 2, taskBoxY + taskBoxH / 2);
  }

  ctx.fillText("家庭成长自律计划 · 陪伴孩子走好每一步", logicalWidth / 2, 452);

  ctx.font = "400 8.5px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  ctx.fillStyle = "#C7C7CC";
  ctx.fillText("Apple iOS HIG 设计 · 2x Retina 高清纯净生成", logicalWidth / 2, 468);

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
