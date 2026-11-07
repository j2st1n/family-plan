import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGrowth } from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import GrowthBoard, { GrowthShareButton } from "../../../shared-web/GrowthBoard.jsx";
import GrowthReportDialog from "../../../shared-web/GrowthReportDialog.jsx";
import { GROWTH_PERIODS, growthSnapshot } from "../../../shared-web/growth.js";

export default function Growth({ active, onExpired }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const requestRef = useRef(0);
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
  useEffect(() => {
    load();
    return () => { requestRef.current++; };
  }, [load]);
  useEffect(() => { if (!active) setReport(null); }, [active]);
  useSseRefresh({ enabled: active, topics: ["tasks", "settings", "shop"], onRefresh: load, onExpired });
  useVisibilityRefresh({ enabled: active, onRefresh: load });
  const current = data?.days === days ? data : null;
  return <main className="growth-page">
    <header className="growth-page-header"><div><h1>我的成长</h1><p className="growth-caption" style={{ marginBottom: 0 }}>每一个小小的坚持，都值得看见。</p></div><GrowthShareButton disabled={!current || loading || !!error} onClick={() => setReport(growthSnapshot(current))} /></header>
    <div className="growth-toolbar"><div className="growth-periods" role="group" aria-label="成长统计时段">{GROWTH_PERIODS.map(value => <button type="button" key={value} aria-pressed={days === value} onClick={() => { setDays(value); setReport(null); }}>{value} 天</button>)}</div>{loading && <span className="growth-footnote" role="status" style={{ margin: 0 }}>更新中…</span>}</div>
    {error && <div className="growth-error" role="alert">{error}<button type="button" onClick={load}>重试</button></div>}
    {current ? <GrowthBoard data={current} /> : !error && <p className="growth-status">正在加载成长记录…</p>}
    {report && <GrowthReportDialog report={report} onClose={closeReport} />}
  </main>;
}
