/**
 * 将平铺日期数据对齐到标准的星期一~星期日日历矩阵
 * @param {Array} heatmapRaw - 后端返回的连续日期数组 [{date: '2026-10-04', ...}, ...]
 * @returns {Array} paddedHeatmap - 前后补齐占位符后的完整网格单元数组
 */
export function alignHeatmapToCalendar(heatmapRaw) {
  if (!heatmapRaw || heatmapRaw.length === 0) return [];

  const result = [];
  const firstDateStr = heatmapRaw[0].date;
  const firstDate = new Date(`${firstDateStr}T00:00:00`);

  // JS getDay(): 0 是周日, 1 是周一 ... 6 是周六
  // 转换为以周一为 0 的索引：周一=0, 周二=1 ... 周六=5, 周日=6
  const dayOfWeek = firstDate.getDay();
  const leadingBlanks = (dayOfWeek + 6) % 7;

  // 1. 填充前置空白占位格
  for (let i = 0; i < leadingBlanks; i++) {
    result.push({ isPlaceholder: true, key: `lead-${i}` });
  }

  // 2. 压入实际打卡数据
  heatmapRaw.forEach((item) => {
    result.push({ ...item, isPlaceholder: false, key: item.date });
  });

  // 3. 补齐末尾单元格以凑齐完整周 (总单元格数为 7 的整数倍)
  const trailingBlanks = (7 - (result.length % 7)) % 7;
  for (let j = 0; j < trailingBlanks; j++) {
    result.push({ isPlaceholder: true, key: `trail-${j}` });
  }

  return result;
}
