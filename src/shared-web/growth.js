// A report snapshot deliberately excludes task titles, IDs, balances and ledgers.
export const GROWTH_PERIODS = [7, 30, 90];
export const DAY_STATES = {
  perfect: { label: "全部完成", mark: "", color: "#248a3d" },
  qualified: { label: "已达标", mark: "", color: "#34c759" },
  missed: { label: "继续加油", mark: "", color: "#c7c7cc" },
  rest: { label: "休息", mark: "·", color: "#ebebef" },
  vacation: { label: "休假", mark: "假", color: "#ffd9a0" },
  frozen: { label: "已保护", mark: "❄", color: "#a1e8e4" },
};
export function growthSnapshot(data, name = "") {
  const heatmap = (data.heatmap || []).map(({ date, total_tasks, completed_tasks, status }) => ({ date, total_tasks, completed_tasks, status }));
  const summary = data.summary || {
    total_tasks: heatmap.reduce((n, d) => n + d.total_tasks, 0),
    completed_tasks: heatmap.reduce((n, d) => n + d.completed_tasks, 0),
    qualified_days: heatmap.filter(d => ["perfect", "qualified"].includes(d.status)).length,
    recorded_tasks: 0, actual_seconds: 0,
  };
  const streak = data.streak || data.insights?.streak || {};
  return {
    name: String(name || data.child_name || "小朋友"),
    days: data.days, start_date: data.start_date, end_date: data.end_date,
    completed_tasks: summary.completed_tasks, total_tasks: summary.total_tasks,
    qualified_days: summary.qualified_days,
    recorded_tasks: summary.recorded_tasks, actual_seconds: summary.actual_seconds,
    current_streak_days: streak.current_streak_days || 0,
    longest_streak_days: streak.longest_streak_days || 0,
    stars_earned: data.stars_earned ?? data.insights?.stars?.stars_earned ?? 0,
    heatmap,
    categories: (data.categories || []).map(({ category, total_tasks, completed_tasks, completion_rate }) => ({ category, total_tasks, completed_tasks, completion_rate })),
  };
}
export function calendarCells(heatmap) {
  if (!heatmap.length) return [];
  const leading = (new Date(`${heatmap[0].date}T00:00:00`).getDay() + 6) % 7;
  return [...Array(leading).fill(null), ...heatmap];
}
export function durationLabel(seconds) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}
export function earnedStars(value) {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}
