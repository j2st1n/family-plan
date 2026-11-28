import { calendarCells, DAY_STATES, durationLabel, earnedStars } from "./growth.js";
import { drawShareCardBrand, drawShareCardCount, fitShareCardLabel, SHARE_CARD_COLORS as C, SHARE_CARD_FONT } from "./shareCardStyle.js";

const WIDTH = 540;
const MARGIN = 48;
const RIGHT = WIDTH - MARGIN;
const COLUMN_WIDTH = (RIGHT - MARGIN) / 7;

const CALENDAR_COLORS = {
  perfect: C.successInk,
  qualified: "#d0efda",
  missed: "#f8dedb",
  rest: "#eeeef2",
  vacation: "#fff0d8",
  frozen: "#dff2f5",
};

export function drawGrowthReport(canvas, report, showName = true) {
  const cells = calendarCells(report.heatmap);
  const rows = Math.ceil(cells.length / 7);
  const calendarTop = 314;
  const legendTop = calendarTop + rows * 31 + 17;
  const streakTop = rows ? legendTop + 67 : calendarTop + 50;
  const categoryTop = streakTop + 72;
  const lastDetail = report.categories.length ? categoryTop + report.categories.length * 33 : streakTop + 25;
  const timingTop = lastDetail + 39;
  const footerTop = (report.recorded_tasks > 0 ? timingTop + 22 : lastDetail) + 27;
  const height = footerTop + 77;

  canvas.width = WIDTH * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, WIDTH, height);

  function divider(y) {
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y);
    ctx.lineTo(RIGHT, y);
    ctx.stroke();
  }

  function text(value, x, y, { size = 15, color = C.ink, weight = 500, align = "left", maxWidth } = {}) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${SHARE_CARD_FONT}`;
    ctx.textAlign = align;
    const label = String(value);
    ctx.fillText(maxWidth === undefined ? label : fitShareCardLabel(ctx, label, maxWidth), x, y);
  }

  text("成长报告", MARGIN, 75, { size: 33, weight: 650 });
  if (showName) text(report.name, RIGHT, 55, { size: 18, weight: 600, align: "right", maxWidth: 220 });
  text(`${report.start_date} 至 ${report.end_date}`, RIGHT, showName ? 78 : 75, { color: C.muted, align: "right", maxWidth: 235 });

  text(`近 ${report.days} 天完成了`, MARGIN, 130, { size: 18, color: C.muted });
  drawShareCardCount(ctx, report.completed_tasks, "件事", MARGIN, 195, 248);
  text(`达标 ${report.qualified_days} 天`, RIGHT, 161, { size: 17, align: "right", maxWidth: 184 });
  text(`收获 ${earnedStars(report.stars_earned)} 星`, RIGHT, 190, { size: 16, color: C.muted, align: "right", maxWidth: 184 });
  divider(227);
  text("习惯日历", MARGIN, 265, { size: 20, weight: 650 });

  if (rows) {
    Array.from("一二三四五六日").forEach((day, i) => {
      const center = MARGIN + (i + 0.5) * COLUMN_WIDTH;
      text(day, center, 298, { size: 13, color: C.muted, align: "center" });
    });
  } else {
    text("暂无日历记录", MARGIN, calendarTop, { color: C.muted });
  }
  cells.forEach((day, i) => {
    if (!day) return;
    const x = MARGIN + (i % 7) * COLUMN_WIDTH;
    const y = calendarTop + Math.floor(i / 7) * 31;
    ctx.fillStyle = CALENDAR_COLORS[day.status] || CALENDAR_COLORS.rest;
    ctx.beginPath();
    ctx.roundRect(x + 3, y, COLUMN_WIDTH - 6, 25, 6);
    ctx.fill();
    const mark = day.status === "frozen" ? "护" : DAY_STATES[day.status]?.mark;
    const label = `${Number(day.date.slice(-2))}${mark && day.status !== "rest" ? " " + mark : ""}`;
    text(label, x + COLUMN_WIDTH / 2, y + 17, { size: 13, color: day.status === "perfect" ? C.white : C.ink, align: "center" });
  });
  if (rows) {
    Object.entries(DAY_STATES).forEach(([status, { label }], i) => {
      const x = MARGIN + (i % 3) * (RIGHT - MARGIN) / 3;
      const y = legendTop + Math.floor(i / 3) * 23;
      ctx.fillStyle = CALENDAR_COLORS[status];
      ctx.fillRect(x, y - 9, 9, 9);
      text(label, x + 17, y, { size: 13, color: C.muted });
    });
  }

  divider(streakTop - 24);
  text(`当前连胜 ${report.current_streak_days} 天`, MARGIN, streakTop, { size: 17, weight: 600 });
  text(`最长连胜 ${report.longest_streak_days} 天`, RIGHT, streakTop, { size: 17, weight: 600, align: "right" });
  text("休息、休假及已保护日期不计为未达标", MARGIN, streakTop + 25, { size: 13, color: C.muted });

  if (report.categories.length) text("各类任务", MARGIN, categoryTop, { size: 20, weight: 650 });
  report.categories.forEach((cat, i) => {
    const y = categoryTop + (i + 1) * 33;
    text(cat.category, MARGIN, y, { maxWidth: 109 });
    text(cat.total_tasks ? `${cat.completed_tasks}/${cat.total_tasks} 项` : "没有安排", RIGHT, y, { color: C.muted, align: "right", maxWidth: 100 });
    const barX = MARGIN + 123;
    const barWidth = RIGHT - barX - 112;
    ctx.fillStyle = C.track;
    ctx.fillRect(barX, y - 6, barWidth, 4);
    ctx.fillStyle = "#8ab5e2";
    ctx.fillRect(barX, y - 6, barWidth * cat.completion_rate / 100, 4);
  });
  if (report.recorded_tasks > 0) {
    text(`实际用时 ${durationLabel(report.actual_seconds)}`, MARGIN, timingTop, { weight: 600 });
    text(`仅统计 ${report.recorded_tasks} 项已完成任务的计时记录`, MARGIN, timingTop + 22, { size: 13, color: C.muted });
  }
  divider(footerTop);
  drawShareCardBrand(ctx, MARGIN, footerTop + 32);
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
