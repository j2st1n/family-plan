import { useEffect, useId, useRef, useState } from "react";
import { createTaskShareImages } from "./taskShareImage.js";
import "./TaskShareDialog.css";

export default function TaskShareDialog({ snapshot, onClose, nameLabel = "标题显示孩子姓名" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [showName, setShowName] = useState(true);
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; previousFocus?.focus?.(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const urls = [];
    setBusy(true); setError(""); setImages([]); setPage(0);
    createTaskShareImages(snapshot, showName).then(result => {
      if (cancelled) return;
      setImages(result.map((image, index) => {
        const url = URL.createObjectURL(image.blob); urls.push(url);
        const name = `family-plan-${snapshot.date}${result.length > 1 ? `-${index + 1}` : ""}.png`;
        return { ...image, url, name, file: new File([image.blob], name, { type: "image/png" }) };
      }));
    }).catch(() => { if (!cancelled) setError("图片生成失败，请重试"); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [snapshot, showName, retry]);

  const current = images[page];
  let canShare = false;
  try { canShare = !!images.length && typeof navigator.share === "function" && !!navigator.canShare?.({ files: images.map(image => image.file) }); } catch { /* File sharing is optional. */ }

  function save() {
    if (!current) return;
    const link = document.createElement("a");
    link.href = current.url; link.download = current.name;
    dialogRef.current.appendChild(link); link.click(); link.remove();
  }

  async function share() {
    if (!canShare || sharing) return;
    setSharing(true); setError("");
    try { await navigator.share({ files: images.map(image => image.file), title: `${snapshot.date} 每日任务` }); }
    catch (err) { if (err.name !== "AbortError") setError("暂时无法调用系统分享，可以保存图片后发送"); }
    finally { setSharing(false); }
  }

  return (
    <dialog ref={dialogRef} className="task-share-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!sharing) onClose(); }}
      onClick={event => {
        if (event.target !== dialogRef.current || sharing) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="task-share-content">
        <header className="task-share-header">
          <div><h2 id={titleId}>分享任务图片</h2><p>{snapshot.date} · 生成时的任务状态</p></div>
          <button type="button" className="task-share-close" aria-label="关闭分享预览" disabled={sharing} onClick={onClose}>×</button>
        </header>
        <label className="task-share-option"><input type="checkbox" checked={showName} disabled={sharing} onChange={event => setShowName(event.target.checked)} /> {nameLabel}</label>
        <div className="task-share-scroll">
          {busy && <p className="task-share-message" role="status">正在生成图片…</p>}
          {current && <img className="task-share-preview" src={current.url} width={current.width} height={current.height} alt={`${snapshot.date}任务与完成情况，第${page + 1}张`} />}
        </div>
        {images.length > 1 && <div className="task-share-pages">
          <button type="button" aria-label="上一张分享图片" disabled={page === 0 || sharing} onClick={() => setPage(value => value - 1)}>←</button>
          <span>{page + 1} / {images.length} · 任务较多，已完整分图</span>
          <button type="button" aria-label="下一张分享图片" disabled={page === images.length - 1 || sharing} onClick={() => setPage(value => value + 1)}>→</button>
        </div>}
        {error && <p className="task-share-error" role="alert">{error}</p>}
        {!busy && !images.length && <button type="button" className="task-share-secondary" onClick={() => setRetry(value => value + 1)}>重新生成</button>}
        <div className="task-share-actions">
          <button type="button" className={canShare ? "task-share-secondary" : "task-share-primary"} disabled={!current || busy || sharing} onClick={save}>{images.length > 1 ? "保存当前图片" : "保存图片"}</button>
          {canShare && <button type="button" className="task-share-primary" disabled={busy || sharing} onClick={share}>{sharing ? "正在分享…" : images.length > 1 ? "分享全部图片" : "系统分享"}</button>}
        </div>
        <p className="task-share-hint">可以保存后发送给家人，也可以长按预览图保存。</p>
      </div>
    </dialog>
  );
}
