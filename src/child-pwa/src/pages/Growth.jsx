import { useCallback, useEffect, useRef, useState } from "react";
import { applyChildFreeze, fetchChildFreeze, fetchGrowth } from "../api.js";
import { childFeedback } from "../components/ChildFeedback.jsx";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import GrowthBoard, { GrowthShareButton } from "../../../shared-web/GrowthBoard.jsx";
import GrowthReportDialog from "../../../shared-web/GrowthReportDialog.jsx";
import { GROWTH_PERIODS, growthSnapshot } from "../../../shared-web/growth.js";

function StreakFreezeCard({ freeze, unavailable, onRetry }) {
  return (
    <section className="growth-card child-freeze-card" aria-labelledby="growth-freeze-heading">
      <h2 id="growth-freeze-heading">连击保护卡</h2>
      {unavailable ? (
        <>
          <p role="status">暂时无法加载保护卡。</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>重试加载保护卡</button>
        </>
      ) : freeze ? (
        <>
          <span className="stat-chip protect">
            <span aria-hidden="true">❄️</span> 持有 {freeze.available_count} 张
          </span>
          <p>在习惯日历点选过去的未达标日期，确认后使用保护卡。</p>
        </>
      ) : <p role="status">正在加载保护卡…</p>}
    </section>
  );
}

export default function Growth({ active, onExpired }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [freeze, setFreeze] = useState(null);
  const [freezeUnavailable, setFreezeUnavailable] = useState(false);
  const [applyingFreeze, setApplyingFreeze] = useState(false);
  const requestRef = useRef(0);
  const freezeRequestRef = useRef(0);
  const applyingFreezeRef = useRef(false);
  const closeReport = useCallback(() => setReport(null), []);
  const load = useCallback(async () => {
    if (!active) return;
    const request = ++requestRef.current;
    setLoading(true); setError("");
    try {
      const result = await fetchGrowth(days, onExpired);
      if (request === requestRef.current) setData(result);
    } catch (err) {
      if (request === requestRef.current && err.message !== "token_expired") setError("成长记录暂时没有加载成功，请重试。");
    } finally { if (request === requestRef.current) setLoading(false); }
  }, [active, days, onExpired]);

  const loadFreeze = useCallback(async () => {
    if (!active) return;
    const request = ++freezeRequestRef.current;
    setFreezeUnavailable(false);
    try {
      const result = await fetchChildFreeze(onExpired);
      if (request === freezeRequestRef.current) setFreeze(result);
    } catch (error) {
      if (request === freezeRequestRef.current && error.message !== "token_expired") {
        setFreeze(null);
        setFreezeUnavailable(true);
      }
    }
  }, [active, onExpired]);

  const refresh = () => {
    load();
    loadFreeze();
  };

  useEffect(() => {
    load();
    return () => { requestRef.current++; };
  }, [load]);
  useEffect(() => {
    loadFreeze();
    return () => { freezeRequestRef.current++; };
  }, [loadFreeze]);
  useEffect(() => { if (!active) setReport(null); }, [active]);
  useSseRefresh({ enabled: active, topics: ["tasks", "settings", "shop"], onRefresh: refresh, onExpired });
  useVisibilityRefresh({ enabled: active, onRefresh: refresh });
  const current = data?.days === days ? data : null;

  async function protectDate(taskDate) {
    if (applyingFreezeRef.current) return;
    applyingFreezeRef.current = true;
    setApplyingFreeze(true);
    try {
      const dateLabel = taskDate.slice(5).replace("-", "月") + "日";
      const confirmed = await childFeedback.confirm({
        title: "使用连击保护卡",
        message: `使用 1 张保护卡保护 ${dateLabel} 的连击？`,
        confirmText: "确认使用",
        cancelText: "取消",
        icon: "❄️",
      });
      if (!confirmed) return;
      const updated = await applyChildFreeze(taskDate, onExpired);
      freezeRequestRef.current++;
      setFreeze(updated);
      setFreezeUnavailable(false);
      await load();
      childFeedback.toast(`${dateLabel}已保护`, "success");
    } catch (err) {
      if (err.message !== "token_expired") {
        childFeedback.toast(err.message || "暂时无法使用保护卡，请重试", "error");
        await Promise.all([load(), loadFreeze()]);
      }
    } finally {
      applyingFreezeRef.current = false;
      setApplyingFreeze(false);
    }
  }

  function renderDayAction(taskDate) {
    if (!freeze || !current?.heatmap.find(day => day.date === taskDate)?.can_apply_freeze) return null;
    if (freeze.available_count <= 0) return <p className="growth-footnote">没有可用的保护卡。</p>;
    return (
      <div className="growth-freeze-action">
        <span>可用保护卡 {freeze.available_count} 张</span>
        <button type="button" className="btn-primary" disabled={applyingFreeze} onClick={() => protectDate(taskDate)}>
          {applyingFreeze ? "处理中…" : "使用保护卡"}
        </button>
      </div>
    );
  }

  return <main className="growth-page">
    <header className="growth-page-header"><div><h1>我的成长</h1><p className="growth-caption" style={{ marginBottom: 0 }}>每一个小小的坚持，都值得看见。</p></div><GrowthShareButton disabled={!current || loading || !!error} onClick={() => setReport(growthSnapshot(current))} /></header>
    <StreakFreezeCard freeze={freeze} unavailable={freezeUnavailable} onRetry={loadFreeze} />
    <div className="growth-toolbar"><div className="growth-periods" role="group" aria-label="成长统计时段">{GROWTH_PERIODS.map(value => <button type="button" key={value} aria-pressed={days === value} disabled={applyingFreeze} onClick={() => { setDays(value); setReport(null); }}>{value} 天</button>)}</div>{loading && <span className="growth-footnote" role="status" style={{ margin: 0 }}>更新中…</span>}</div>
    {error && <div className="growth-error" role="alert">{error}<button type="button" onClick={load}>重试</button></div>}
    {current ? <GrowthBoard data={current} renderDayAction={renderDayAction} /> : !error && <p className="growth-status">正在加载成长记录…</p>}
    {report && <GrowthReportDialog report={report} onClose={closeReport} />}
  </main>;
}
