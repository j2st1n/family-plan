import { isValidTaskDate } from "./date.js";
import { formatStars } from "./format.js";
import { drawShareCardBrand, drawShareCardCount, fitShareCardLabel, SHARE_CARD_COLORS as C, SHARE_CARD_FONT } from "./shareCardStyle.js";

const WIDTH = 540;
const MARGIN = 48;
const RIGHT = WIDTH - MARGIN;
const BODY_TOP = 278;
const TITLE_X = MARGIN + 28;
const STATUS_WIDTH = 75;
const TITLE_WIDTH = RIGHT - TITLE_X - STATUS_WIDTH - 12;
const TITLE_LINE_HEIGHT = 27;
const DETAILS_LINE_HEIGHT = 21;
const FOOTER_HEIGHT = 90;
const MAX_HEIGHT = 1800;
const AWAITING_COLOR = "#805516";

function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function createTaskShareSnapshot(date, childName, tasks) {
  return {
    date, childName, generatedAt: new Date().toISOString(),
    tasks: tasks.map(task => ({
      title: task.title, status: task.status, approved: task.approved,
      expected_minutes: task.expected_minutes, reward_stars: task.reward_stars,
      scheduled_start: task.scheduled_start, scheduled_end: task.scheduled_end,
    })),
  };
}

export function buildTaskShareModel(snapshot, showName = true) {
  if (!isValidTaskDate(snapshot.date)) throw new Error("请选择有效的任务日期");
  const tasks = (snapshot.tasks || []).filter(task => task.status !== "deleted").map(task => {
    const approved = task.approved !== false;
    const completed = approved && task.status === "completed";
    const minutes = amount(task.expected_minutes);
    const stars = amount(task.reward_stars);
    const start = task.scheduled_start?.slice(0, 5);
    const end = task.scheduled_end?.slice(0, 5);
    return {
      title: String(task.title || "").replace(/\s+/g, " ").trim() || "未命名任务", approved, completed,
      status: !approved ? "待认可" : completed ? "已完成" : task.status === "submitted" ? "待点赞" : "待完成",
      details: [minutes ? `预计 ${minutes} 分钟` : null, start ? `${start}${end ? `–${end}` : " 开始"}` : "自由安排", stars ? `${completed ? "完成奖励" : "奖励"} ${formatStars(stars)} 星` : null].filter(Boolean).join("  ·  "),
      stars,
    };
  });
  const eligible = tasks.filter(task => task.approved);
  const completed = eligible.filter(task => task.completed);
  const stamp = new Date(snapshot.generatedAt);
  const name = String(snapshot.childName || "").replace(/\s+/g, " ").trim();
  return {
    date: snapshot.date,
    name: showName ? name : "",
    tasks,
    total: tasks.length,
    eligible: eligible.length,
    completed: completed.length,
    awaitingApproval: tasks.length - eligible.length,
    rate: eligible.length ? Math.floor(completed.length * 100 / eligible.length) : null,
    earnedStars: completed.reduce((sum, task) => sum + task.stars, 0),
    generatedLabel: Number.isNaN(stamp.getTime()) ? "" : stamp.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

function font(ctx, size, weight = 400) { ctx.font = `${weight} ${size}px ${SHARE_CARD_FONT}`; }

function linesFor(ctx, text, width) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = char; }
      else line += char;
    }
    lines.push(line);
  }
  return lines;
}

function divider(ctx, x, y) {
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();
}

function text(ctx, value, x, y, { size = 15, color = C.ink, weight = 500, align = "left", maxWidth } = {}) {
  font(ctx, size, weight);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  const label = String(value);
  ctx.fillText(maxWidth === undefined ? label : fitShareCardLabel(ctx, label, maxWidth), x, y);
}

function statusIcon(ctx, x, y, completed, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (completed) {
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x - 2, y + 4);
    ctx.lineTo(x + 6, y - 5);
  } else {
    ctx.arc(x, y, 5, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

function layout(ctx, model) {
  const rows = model.tasks.map(task => {
    font(ctx, 19, 600);
    const title = linesFor(ctx, task.title, TITLE_WIDTH);
    font(ctx, 14, 500);
    const details = linesFor(ctx, task.details, RIGHT - TITLE_X);
    const height = 43 + title.length * TITLE_LINE_HEIGHT + (details.length - 1) * DETAILS_LINE_HEIGHT;
    return { task, title, details, height };
  });
  const pages = [];
  let page = [];
  let used = BODY_TOP;
  for (const row of rows) {
    if (page.length && used + row.height + FOOTER_HEIGHT > MAX_HEIGHT) {
      pages.push({ rows: page, height: used + FOOTER_HEIGHT });
      page = [];
      used = BODY_TOP;
    }
    page.push(row);
    used += row.height;
  }
  pages.push({ rows: page, height: page.length ? used + FOOTER_HEIGHT : 272 });
  return pages;
}

function drawPage(ctx, model, page, pageNumber, pageCount) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, WIDTH, page.height);
  text(ctx, "任务清单", MARGIN, 75, { size: 33, weight: 650 });
  if (model.name) text(ctx, model.name, RIGHT, 55, { size: 18, weight: 600, align: "right", maxWidth: 220 });
  const [year, month, day] = model.date.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long", timeZone: "UTC" }).format(date);
  text(ctx, `${model.date} · ${weekday}`, RIGHT, model.name ? 78 : 75, { color: C.muted, align: "right" });

  let y = BODY_TOP;
  if (page.rows.length) {
    text(ctx, "已完成 / 已认可", MARGIN, 130, { size: 18, color: C.muted });
    drawShareCardCount(ctx, model.completed, `/ ${model.eligible} 项`, MARGIN, 195, 248);
    text(ctx, `完成率 ${model.rate === null ? "—" : `${model.rate}%`}`, RIGHT, 161, { size: 17, align: "right" });
    text(ctx, `收获 ${formatStars(model.earnedStars)} 星`, RIGHT, 190, { size: 16, color: C.muted, align: "right", maxWidth: 184 });
    divider(ctx, MARGIN, 227);
    text(ctx, "任务明细", MARGIN, 265, { size: 20, weight: 650 });
    const note = `共 ${model.total} 项${model.awaitingApproval ? ` · ${model.awaitingApproval} 项待认可` : ""}`;
    text(ctx, note, RIGHT, 265, { color: C.muted, align: "right", maxWidth: 220 });
  } else {
    text(ctx, "没有安排任务", MARGIN, 156, { size: 25, weight: 650 });
  }

  page.rows.forEach((row, index) => {
    const color = row.task.completed ? C.successInk : row.task.approved ? C.muted : AWAITING_COLOR;
    statusIcon(ctx, MARGIN + 7, y + 24, row.task.completed, color);
    text(ctx, row.task.status, RIGHT, y + 29, { size: 14, color, align: "right" });
    row.title.forEach((line, i) => text(ctx, line, TITLE_X, y + 29 + i * TITLE_LINE_HEIGHT, { size: 19, weight: 600 }));
    const detailsTop = y + 26 + row.title.length * TITLE_LINE_HEIGHT;
    row.details.forEach((line, i) => text(ctx, line, TITLE_X, detailsTop + i * DETAILS_LINE_HEIGHT, { size: 14, color: C.muted }));
    y += row.height;
    if (index < page.rows.length - 1) divider(ctx, TITLE_X, y);
  });

  const footerY = page.height - FOOTER_HEIGHT + 13;
  divider(ctx, MARGIN, footerY);
  drawShareCardBrand(ctx, MARGIN, footerY + 30);
  if (model.generatedLabel) {
    text(ctx, `生成于 ${model.generatedLabel}`, RIGHT, footerY + 34, { size: 13, color: C.muted, align: "right" });
  }
  if (pageCount > 1) {
    text(ctx, `${pageNumber} / ${pageCount}`, RIGHT, footerY + 56, { size: 13, color: C.muted, align: "right" });
  }
}

export async function createTaskShareImages(snapshot, showName = true) {
  const model = buildTaskShareModel(snapshot, showName);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * 2;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法生成图片，请换个浏览器重试");
  const pages = layout(ctx, model);
  const images = [];
  try {
    for (const [index, page] of pages.entries()) {
      canvas.height = page.height * 2;
      ctx.scale(2, 2);
      drawPage(ctx, model, page, index + 1, pages.length);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("图片生成失败，请重试")), "image/png"));
      images.push({ blob, width: canvas.width, height: canvas.height });
    }
    return images;
  } finally { canvas.width = 0; canvas.height = 0; }
}
