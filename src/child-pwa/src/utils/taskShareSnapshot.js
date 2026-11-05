import { isValidTaskDate } from "../../../shared-web/date.js";

export function createChildTaskShareSnapshot(data, fallbackName = "") {
  if (!isValidTaskDate(data?.date) || !Array.isArray(data?.tasks)) return null;
  return {
    date: data.date,
    childName: data.child?.name ?? fallbackName,
    generatedAt: new Date().toISOString(),
    tasks: data.tasks.map(task => ({
      title: task.title, status: task.status, approved: task.approved,
      expected_minutes: task.expected_minutes, reward_stars: task.reward_stars,
      scheduled_start: task.scheduled_start, scheduled_end: task.scheduled_end,
    })),
  };
}
