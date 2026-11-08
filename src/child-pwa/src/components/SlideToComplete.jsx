import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronDoubleRightIcon, ClockIcon } from "@heroicons/react/24/outline";
import { childFeedback } from "./ChildFeedback.jsx";
import { acceptsCompletionSlide, slideProgress } from "../utils/completionGesture.js";

const STATUS_TEXT = { completed: "已完成", submitted: "等待家长确认", unapproved: "待家长确认", busy: "正在提交…", queued: "完成结果待同步" };

export default function SlideToComplete({ taskName, status = "ready", onComplete, celebrating = false }) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const track = useRef(null), thumb = useRef(null), gesture = useRef(null);
  const locked = useRef(false), confirming = useRef(false), mounted = useRef(true), latestStatus = useRef(status);
  latestStatus.current = status;
  const instructionsId = useId();

  function reset() { gesture.current = null; setDragging(false); setProgress(0); setOffset(0); }
  useEffect(() => {
    mounted.current = true;
    const cancel = () => reset();
    const hidden = () => { if (document.visibilityState !== "visible") cancel(); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => { mounted.current = false; window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  useEffect(() => { reset(); }, [status, taskName]);

  async function commit(event) {
    if (locked.current || latestStatus.current !== "ready") return;
    locked.current = true; setProgress(1);
    try { await onComplete?.(event); }
    finally { locked.current = false; if (mounted.current) reset(); }
  }
  function start(event) {
    if (latestStatus.current !== "ready" || locked.current || gesture.current || event.button !== 0 || event.isPrimary === false) return;
    const travel = track.current.clientWidth - thumb.current.offsetWidth - 8;
    if (travel < 64) return;
    event.preventDefault();
    gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, travel, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
  }
  function move(event) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.abs(event.clientY - active.startY) > 40) { reset(); return; }
    if (event.clientX - active.startX >= 24) active.moved = true;
    const next = slideProgress(active.startX, event.clientX, active.travel);
    setProgress(next); setOffset(next * active.travel);
  }
  function release(event) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    const accepted = acceptsCompletionSlide(active, event.clientX, event.clientY);
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (accepted) { setOffset(active.travel); commit(event); } else { setProgress(0); setOffset(0); }
  }
  async function accessibleActivation(event) {
    // Pointer taps never complete a task. Keyboard/assistive activation gets an explicit confirmation.
    if (event.detail !== 0 || locked.current || confirming.current || latestStatus.current !== "ready") return;
    confirming.current = true;
    try {
      const yes = await childFeedback.confirm({ title: "完成这项任务？", message: taskName, confirmText: "确认完成", cancelText: "取消", icon: null });
      if (yes) await commit();
    } finally { confirming.current = false; }
  }
  if (status !== "ready") return <div className={`slide-complete slide-complete--${status}${celebrating ? " spring-pop" : ""}`} role="status" aria-label={status === "completed" ? "任务已完成" : STATUS_TEXT[status]} aria-busy={status === "busy"}>
    {status === "completed" && <CheckIcon aria-hidden="true" />}
    {status === "submitted" && <ClockIcon aria-hidden="true" />}
    <span>{STATUS_TEXT[status]}</span>
  </div>;

  return <div ref={track} className={`slide-complete${dragging ? " is-dragging" : ""}`} style={{ "--slide-progress": progress }}>
    <span className="slide-complete-label" aria-hidden="true" style={{ opacity: Math.max(0, 1 - progress * 1.5) }}>向右滑动完成</span>
    <span id={instructionsId} className="slide-complete-instructions">从滑块拖到最右端后松手。使用键盘或辅助功能时，激活按钮后确认完成。</span>
    <button ref={thumb} type="button" className="slide-complete-thumb" style={{ transform: `translateX(${offset}px)` }} aria-label={`滑动完成: ${taskName}`} aria-describedby={instructionsId}
      onPointerDown={start} onPointerMove={move} onPointerUp={release} onPointerCancel={reset}
      onLostPointerCapture={() => { if (gesture.current) reset(); }} onClick={accessibleActivation}>
      <ChevronDoubleRightIcon aria-hidden="true" />
    </button>
  </div>;
}
