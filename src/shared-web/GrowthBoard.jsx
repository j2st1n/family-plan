import { useEffect, useMemo, useState } from "react";
import ShareButton from "./ShareButton.jsx";
import { calendarCells, DAY_STATES, durationLabel, earnedStars, growthSnapshot } from "./growth.js";
import "./growth.css";

export function GrowthIcon({ size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 20v-6m7 6V9m7 11V4" /></svg>;
}
export function GrowthShareButton({ disabled, onClick }) {
  return <ShareButton label="分享成长报告" disabled={disabled} onClick={onClick} />;
}
export default function GrowthBoard({ data, renderDayAction }) {
  const report = useMemo(() => growthSnapshot(data), [data]);
  const [selectedDate, setSelectedDate] = useState(report.end_date);
  useEffect(() => setSelectedDate(report.end_date), [report.start_date, report.end_date]);
  const selected = report.heatmap.find(d => d.date === selectedDate) || report.heatmap.at(-1);
  return <div className="growth-board">
    <section className="growth-card" aria-label="成长概览">
      <p className="growth-eyebrow">每一步，都算数</p>
      <div className="growth-metrics">
        <div><strong>{report.completed_tasks}<small> 项</small></strong><span>完成任务</span></div>
        <div><strong>{report.qualified_days}<small> 天</small></strong><span>达标天数</span></div>
        <div><strong>{earnedStars(report.stars_earned)}<small> 🌟</small></strong><span>本期获得</span></div>
      </div>
      <p className="growth-footnote">{report.start_date} — {report.end_date}</p>
    </section>
    <section className="growth-card" aria-label="坚持记录">
      <div className="growth-streak"><div><span>当前连胜</span><strong>{report.current_streak_days}<small> 天</small></strong></div><div><span>最长连胜</span><strong>{report.longest_streak_days}<small> 天</small></strong></div></div>
      <p className="growth-footnote">连胜为累计记录，不随所选天数变化。</p>
    </section>
    <section className="growth-card" aria-label="习惯日历">
      <h2>习惯日历</h2><p className="growth-caption">点一天，看看自己的脚印。</p>
      <div className="growth-calendar">
        <div className="growth-weekdays" aria-hidden="true">{"一二三四五六日".split("").map(d => <span key={d}>{d}</span>)}</div>
        <div className="growth-calendar-grid">{calendarCells(report.heatmap).map((day, i) => day ? <button key={day.date} type="button" className={`growth-day growth-day-${day.status}`} aria-pressed={selected?.date === day.date} onClick={() => setSelectedDate(day.date)} aria-label={`${day.date} ${DAY_STATES[day.status]?.label}，完成 ${day.completed_tasks}/${day.total_tasks} 项`}><span>{Number(day.date.slice(-2))}</span>{["missed", "vacation", "frozen"].includes(day.status) && <small aria-hidden="true">{DAY_STATES[day.status].mark}</small>}</button> : <span key={`blank-${i}`} />)}</div>
      </div>
      {selected && <div className="growth-day-detail" aria-live="polite"><strong>{selected.date.slice(5).replace("-", "月")}日 · {DAY_STATES[selected.status]?.label}</strong><span>{selected.total_tasks ? `完成 ${selected.completed_tasks}/${selected.total_tasks} 项` : "当天没有安排任务"}</span></div>}
      {selected && renderDayAction?.(selected.date)}
      <div className="growth-legend">{Object.entries(DAY_STATES).map(([state, cfg]) => <span key={state}><i style={{ background: cfg.color }} />{cfg.label}</span>)}</div>
      <p className="growth-footnote">休息、休假和已保护的日期不计为未达标。</p>
    </section>
    <section className="growth-card" aria-label="四类习惯"><h2>一点点，全面成长</h2><div className="growth-categories">{report.categories.map(cat => <div key={cat.category}><div className="growth-category-label"><strong>{cat.category}</strong><span>{cat.total_tasks ? `${cat.completed_tasks}/${cat.total_tasks} 项` : "还没有安排"}</span></div><div className="growth-track" role="progressbar" aria-label={cat.category} aria-valuemin={0} aria-valuemax={100} aria-valuenow={cat.completion_rate}><i style={{ width: `${cat.completion_rate}%` }} /></div></div>)}</div></section>
    {report.recorded_tasks > 0 && <section className="growth-card" aria-label="实际用时"><h2>认真投入的时间</h2><div className="growth-time">{durationLabel(report.actual_seconds)}</div><p className="growth-footnote">来自 {report.recorded_tasks} 项已完成任务的计时记录。</p></section>}
    {report.total_tasks === 0 && <p className="growth-empty">从今天的一件小事开始，慢慢留下成长的脚印。</p>}
  </div>;
}
