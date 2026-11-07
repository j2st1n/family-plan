import { APP_DESCRIPTION } from "./brand.js";
import { isValidTaskDate } from "./date.js";
import { formatStars } from "./format.js";

const WIDTH = 1080;
const MARGIN = 64;
const MAX_HEIGHT = 3600;
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const C = { bg: "#f3f6ef", ink: "#213c32", muted: "#718078", green: "#367e5b", mint: "#deebdc", line: "#e0e7dc", gold: "#a77a25", white: "#ffffff" };

function amount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
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
      status: !approved ? "待认可" : completed ? "已完成" : "待完成",
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
    title: showName && name ? `${name}的任务记录` : "每日任务记录",
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

function font(ctx, size, weight = 400) { ctx.font = `${weight} ${size}px ${FONT}`; }

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

function rounded(ctx, x, y, w, h, r, color) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function text(ctx, value, x, y, size, color = C.ink, weight = 400) {
  font(ctx, size, weight); ctx.fillStyle = color; ctx.fillText(String(value), x, y);
}

function statusIcon(ctx, x, y, task) {
  ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2);
  ctx.fillStyle = task.completed ? C.green : task.approved ? "#eef1eb" : "#f6edd7"; ctx.fill();
  ctx.strokeStyle = task.completed ? C.white : task.approved ? "#94a297" : C.gold; ctx.lineWidth = 3;
  ctx.beginPath();
  if (task.completed) { ctx.moveTo(x - 9, y); ctx.lineTo(x - 2, y + 7); ctx.lineTo(x + 10, y - 8); }
  else { ctx.arc(x, y, 10, 0, Math.PI * 2); }
  ctx.stroke();
}

function layout(ctx, model) {
  font(ctx, 52, 600);
  const titleLines = linesFor(ctx, model.title, WIDTH - MARGIN * 2 - 80);
  const metricTop = 176 + titleLines.length * 68;
  const bodyTop = metricTop + 238;
  const rows = model.tasks.map(task => {
    font(ctx, 32, 600);
    const title = linesFor(ctx, task.title, 684);
    font(ctx, 24);
    const details = linesFor(ctx, task.details, 684);
    return { task, title, details, height: Math.max(132, 36 + title.length * 46 + details.length * 34 + 22) };
  });
  const pages = [];
  let page = [], used = bodyTop;
  for (const row of rows) {
    if (page.length && used + row.height + 18 + 136 > MAX_HEIGHT) {
      pages.push({ rows: page, height: used + 118 }); page = []; used = bodyTop;
    }
    page.push(row); used += row.height + 18;
  }
  pages.push({ rows: page, height: Math.max(used + 136, bodyTop + 330) });
  return { titleLines, metricTop, bodyTop, pages };
}

function drawPage(ctx, model, positions, page, index) {
  const { titleLines, metricTop, bodyTop, pages } = positions;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, WIDTH, page.height);
  ctx.fillStyle = C.mint; ctx.beginPath(); ctx.arc(WIDTH - 60, 28, 180, 0, Math.PI * 2); ctx.fill();
  text(ctx, `${APP_DESCRIPTION}  /  每日任务`, MARGIN, 80, 24, C.green, 600);
  const [year, month, day] = model.date.split("-").map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long", timeZone: "UTC" }).format(date);
  text(ctx, `${year} 年 ${month} 月 ${day} 日  ·  ${weekday}`, MARGIN, 135, 29, C.muted);
  titleLines.forEach((line, i) => text(ctx, line, MARGIN, 214 + i * 68, 52, C.ink, 600));
  const cardWidth = (WIDTH - MARGIN * 2 - 32) / 3;
  const metrics = [
    { value: model.eligible ? `${model.completed}/${model.eligible}` : "0 项", label: "已认可任务完成", color: C.green },
    { value: model.rate === null ? "—" : `${model.rate}%`, label: "认可任务完成率", color: C.ink },
    { value: formatStars(model.earnedStars), label: "已完成奖励 · 星", color: C.gold },
  ];
  metrics.forEach((metric, i) => {
    const x = MARGIN + (cardWidth + 16) * i;
    rounded(ctx, x, metricTop, cardWidth, 142, 22, C.white);
    text(ctx, metric.value, x + 24, metricTop + 69, 46, metric.color, 600);
    text(ctx, metric.label, x + 24, metricTop + 112, 22, C.muted);
  });
  rounded(ctx, MARGIN, metricTop + 166, WIDTH - MARGIN * 2, 12, 6, C.line);
  if (model.rate > 0) rounded(ctx, MARGIN, metricTop + 166, Math.max(12, (WIDTH - MARGIN * 2) * model.rate / 100), 12, 6, C.green);
  const note = `共 ${model.total} 项任务${model.awaitingApproval ? `  ·  另有 ${model.awaitingApproval} 项待认可` : ""}`;
  text(ctx, note, MARGIN, metricTop + 216, 24, C.muted);
  let y = bodyTop;
  if (!page.rows.length) {
    rounded(ctx, MARGIN, y, WIDTH - MARGIN * 2, 200, 26, C.white);
    text(ctx, "这一天没有安排任务", MARGIN + 42, y + 88, 36, C.ink, 600);
    text(ctx, "暂无已认可任务", MARGIN + 42, y + 142, 26, C.muted);
  }
  for (const row of page.rows) {
    rounded(ctx, MARGIN, y, WIDTH - MARGIN * 2, row.height, 24, C.white);
    statusIcon(ctx, MARGIN + 46, y + 48, row.task);
    const color = row.task.completed ? C.green : row.task.approved ? C.muted : C.gold;
    text(ctx, row.task.status, WIDTH - MARGIN - 118, y + 49, 24, color, 600);
    row.title.forEach((line, i) => text(ctx, line, MARGIN + 88, y + 49 + i * 46, 32, C.ink, 600));
    row.details.forEach((line, i) => text(ctx, line, MARGIN + 88, y + 49 + row.title.length * 46 + i * 34, 24, C.muted));
    y += row.height + 18;
  }
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(MARGIN, page.height - 94); ctx.lineTo(WIDTH - MARGIN, page.height - 94); ctx.stroke();
  text(ctx, model.generatedLabel ? `状态生成于 ${model.generatedLabel}` : "每日任务记录", MARGIN, page.height - 48, 22, C.muted);
  ctx.textAlign = "right";
  text(ctx, pages.length > 1 ? `${index + 1} / ${pages.length}` : APP_DESCRIPTION, WIDTH - MARGIN, page.height - 48, 22, C.muted);
  ctx.textAlign = "left";
}

export async function createTaskShareImages(snapshot, showName = true) {
  const model = buildTaskShareModel(snapshot, showName);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH; canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法生成图片，请换个浏览器重试");
  const positions = layout(ctx, model);
  const images = [];
  try {
    for (let i = 0; i < positions.pages.length; i++) {
      const page = positions.pages[i];
      canvas.width = WIDTH; canvas.height = page.height;
      drawPage(ctx, model, positions, page, i);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("图片生成失败，请重试")), "image/png"));
      images.push({ blob, width: WIDTH, height: page.height });
    }
    return images;
  } finally { canvas.width = 0; canvas.height = 0; }
}
