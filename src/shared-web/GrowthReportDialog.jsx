import { useEffect, useRef, useState } from "react";
import { drawGrowthReport, downloadGrowthReport, reportBlob } from "./growthPoster.js";
import "./growth.css";

// Remount for every new snapshot: nickname visibility and image are never reused.
export default function GrowthReportDialog({ report, onClose }) {
  const [showName, setShowName] = useState(true);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const dialogRef = useRef(null);
  const filename = `成长报告-${report.start_date}-${report.end_date}.png`;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();
    function keydown(event) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const nodes = [...dialogRef.current.querySelectorAll("button:not(:disabled),input:not(:disabled)")];
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  useEffect(() => {
    let cancelled = false; let url;
    setImage(null); setFeedback("");
    async function render() {
      try {
        await document.fonts?.ready;
        const canvas = document.createElement("canvas"); drawGrowthReport(canvas, report, showName);
        const blob = await reportBlob(canvas);
        if (cancelled) return;
        url = URL.createObjectURL(blob); setImage({ url, blob, showName });
      } catch { if (!cancelled) setFeedback("图片生成失败，请关闭后重试。"); }
    }
    render();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [report, showName]);
  const ready = image && image.showName === showName;
  async function share() {
    if (!ready || busy) return;
    setBusy(true); setFeedback("");
    try {
      const file = new File([image.blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "成长报告", text: "Small steps. Shared growth." });
      } else {
        downloadGrowthReport(image.blob, filename); setFeedback("图片已下载，可在相册或文件中分享。");
      }
    } catch (error) { if (error.name !== "AbortError") setFeedback("暂时无法调起系统分享，请点击保存图片。"); }
    finally { setBusy(false); }
  }
  return <div className="growth-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="growth-dialog" role="dialog" aria-modal="true" aria-labelledby="growth-report-title">
      <header className="growth-dialog-header"><h2 id="growth-report-title">成长报告 · 近 {report.days} 天</h2><button type="button" onClick={onClose}>完成</button></header>
      <div className="growth-dialog-body">
        {ready ? <img className="growth-dialog-preview" src={image.url} alt="成长报告预览" /> : <p className="growth-status" role="status">正在生成图片…</p>}
        <label className="growth-privacy">显示昵称<input type="checkbox" checked={showName} disabled={busy} onChange={e => setShowName(e.target.checked)} /></label>
        <p className="growth-dialog-note">报告不包含具体任务名称和星星余额。关闭“显示昵称”后，图片与文件名均不含昵称。</p>
        <p className="growth-dialog-note">手机上也可以长按图片保存或分享。</p>
        {feedback && <p className="growth-dialog-note" role="status">{feedback}</p>}
        <div className="growth-dialog-actions"><button type="button" disabled={!ready || busy} onClick={share}>{busy ? "正在分享…" : "分享"}</button><button type="button" disabled={!ready || busy} onClick={() => { downloadGrowthReport(image.blob, filename); setFeedback("图片已保存下载。"); }}>保存图片</button></div>
      </div>
    </div>
  </div>;
}
