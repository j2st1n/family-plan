import { BRAND_SLOGAN, drawBrandMark } from "./brand.js";
import { calendarCells, DAY_STATES, durationLabel, earnedStars } from "./growth.js";

export function drawGrowthReport(canvas, report, showName = true) {
  const cells = calendarCells(report.heatmap);
  const rows = Math.ceil(cells.length / 7);
  const height = 715 + rows * 25 + (report.recorded_tasks > 0 ? 45 : 0);
  canvas.width = 1080; canvas.height = height * 2;
  const ctx = canvas.getContext("2d"); ctx.scale(2, 2);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 540, height);
  function text(value, x, y, size = 14, color = "#1d1d1f", weight = 400, maxWidth) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    let label = String(value);
    if (maxWidth) {
      while (label.length && ctx.measureText(label).width > maxWidth) label = label.slice(0, -1);
      if (label !== String(value)) label = label.slice(0, -1) + "…";
    }
    ctx.fillText(label, x, y);
  }
  drawBrandMark(ctx, 38, 32, 40);
  text("成长报告", 88, 58, 13, "#86868b", 500);
  text(showName ? `${report.name}的成长` : "我的成长", 38, 118, 30, "#1d1d1f", 650, 464);
  text(`${report.start_date} — ${report.end_date} · 近 ${report.days} 天`, 38, 149, 13, "#86868b");
  [ [report.completed_tasks, "完成任务 · 项"], [report.qualified_days, "达标天数 · 天"], [earnedStars(report.stars_earned), "本期获得 🌟"] ].forEach(([value, label], i) => {
    ctx.font = "650 32px -apple-system, BlinkMacSystemFont, sans-serif";
    const numberSize = Math.min(32, 32 * 148 / Math.max(1, ctx.measureText(String(value)).width));
    text(value, 38 + i * 158, 210, numberSize, "#1d1d1f", 650);
    text(label, 38 + i * 158, 236, 12, "#86868b");
  });
  ctx.strokeStyle = "#e5e5ea"; ctx.beginPath(); ctx.moveTo(38, 261); ctx.lineTo(502, 261); ctx.stroke();
  text("习惯日历", 38, 293, 16, "#1d1d1f", 600);
  "一二三四五六日".split("").forEach((day, i) => text(day, 60 + i * 66, 321, 11, "#86868b"));
  cells.forEach((day, i) => {
    if (!day) return;
    const x = 39 + i % 7 * 66, y = 336 + Math.floor(i / 7) * 25;
    ctx.fillStyle = DAY_STATES[day.status]?.color || "#ebebef";
    ctx.beginPath(); ctx.roundRect(x, y, 58, 19, 4); ctx.fill();
    const cfg = DAY_STATES[day.status] || DAY_STATES.rest;
    text(`${Number(day.date.slice(-2))}${cfg.mark === "假" || cfg.mark === "❄" ? " " + cfg.mark : ""}`, x + 10, y + 13, 10, day.status === "perfect" ? "#fff" : "#414146", 500);
  });
  let y = 336 + rows * 25 + 24;
  Object.values(DAY_STATES).forEach((cfg, i) => {
    const x = 38 + i % 3 * 158, line = y + Math.floor(i / 3) * 20;
    ctx.fillStyle = cfg.color; ctx.fillRect(x, line - 7, 7, 7);
    text(cfg.label, x + 13, line, 10, "#86868b");
  });
  y += 58;
  text(`当前连胜 ${report.current_streak_days} 天`, 38, y, 16, "#1d1d1f", 600);
  text(`最长连胜 ${report.longest_streak_days} 天`, 280, y, 16, "#1d1d1f", 600);
  text("累计连胜记录 · 休息、休假及已保护日期不计为未达标", 38, y + 23, 10, "#86868b");
  y += 58;
  report.categories.forEach((cat, i) => {
    const cy = y + i * 33;
    text(cat.category, 38, cy, 12, "#414146");
    text(cat.total_tasks ? `${cat.completed_tasks}/${cat.total_tasks} 项` : "还没有安排", 407, cy, 11, "#86868b");
    ctx.fillStyle = "#f0f0f4"; ctx.fillRect(145, cy - 6, 242, 4);
    ctx.fillStyle = "#0071e3"; ctx.fillRect(145, cy - 6, 242 * cat.completion_rate / 100, 4);
  });
  y += 142;
  if (report.recorded_tasks > 0) {
    text(`实际用时 ${durationLabel(report.actual_seconds)}`, 38, y, 13, "#414146", 500);
    text(`仅统计 ${report.recorded_tasks} 项已完成任务的计时记录`, 38, y + 20, 10, "#86868b");
  }
  text(BRAND_SLOGAN, 38, height - 35, 14, "#0071e3", 500);
  return canvas;
}
export function reportBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片生成失败，请重试")), "image/png"));
}
export function downloadGrowthReport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
