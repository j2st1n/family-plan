import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChildFreeze, fetchGrowth } from "../api.js";
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
          <p>漏打卡时，系统会为符合保护条件的那一天自动使用 1 张卡，保住连击。</p>
          <details>
            <summary>保护卡使用记录</summary>
            {freeze.usages?.length ? (
              <ul>
                {freeze.usages.map(({ id, used_date }) => (
                  <li key={id}><time dateTime={used_date}>{used_date}</time> · 已保护</li>
                ))}
              </ul>
            ) : <p>还没有用过保护卡。</p>}
          </details>
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
  const requestRef = useRef(0);
  const freezeRequestRef = useRef(0);
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
  return <main className="growth-page">
    <header className="growth-page-header"><div><h1>我的成长</h1><p className="growth-caption" style={{ marginBottom: 0 }}>每一个小小的坚持，都值得看见。</p></div><GrowthShareButton disabled={!current || loading || !!error} onClick={() => setReport(growthSnapshot(current))} /></header>
    <StreakFreezeCard freeze={freeze} unavailable={freezeUnavailable} onRetry={loadFreeze} />
    <div className="growth-toolbar"><div className="growth-periods" role="group" aria-label="成长统计时段">{GROWTH_PERIODS.map(value => <button type="button" key={value} aria-pressed={days === value} onClick={() => { setDays(value); setReport(null); }}>{value} 天</button>)}</div>{loading && <span className="growth-footnote" role="status" style={{ margin: 0 }}>更新中…</span>}</div>
    {error && <div className="growth-error" role="alert">{error}<button type="button" onClick={load}>重试</button></div>}
    {current ? <GrowthBoard data={current} /> : !error && <p className="growth-status">正在加载成长记录…</p>}
    {report && <GrowthReportDialog report={report} onClose={closeReport} />}
  </main>;
}
