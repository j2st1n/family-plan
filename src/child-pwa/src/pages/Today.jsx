import FieldLabel from "../../../shared-web/FieldLabel.jsx";
import {readTimer, readCompletions, startTimer, pauseTimer, saveTimer, timerMilliseconds, freezeCompletion, acknowledgeCompletion} from "../utils/taskTimer.js";
import TaskTimingFields from "../../../shared-web/TaskTimingFields.jsx";
import {plannedEnd, formatActualSeconds, formatElapsedSeconds} from "../../../shared-web/taskTiming.js";
import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import {
  fetchToday,
  completeTask,
  createChildTask,
  scheduleChildTask,
  updateChildTask,
  deleteChildTask,
} from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { playTaskComplete, playTaskSubmitted, initAudioUnlock } from "../utils/soundFx.js";
import TaskStopwatch from "../components/TaskStopwatch.jsx";
import { ClockIcon, CalendarDaysIcon, CheckIcon } from "@heroicons/react/24/outline";
import FocusTimer from "../components/FocusTimer.jsx";
import SharePosterModal from "../components/SharePosterModal.jsx";
import { ShareIcon, SunIcon, MoonIcon, TimerIcon } from "../components/Icons.jsx";
import { childFeedback } from "../components/ChildFeedback.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

import { isValidTaskDate } from "../../../shared-web/date.js";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function pad(n) {
  return String(n).padStart(2, "0");
}
function minutesToTime(m) {
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

/**
 * 触发高性能五彩礼花粒子与飞星动画
 * 适配 iPad Retina 高分屏：控制粒子数量在 75-80 颗左右，保障 60/120fps 丝滑渲染
 */
function fireCelebration(originX = 0.5, originY = 0.6) {
  try {
    // 1. 五彩礼花粒子（自然手账温润色系：森林绿、琥珀金、陶土橙、青瓷蓝）
    confetti({
      particleCount: 55,
      spread: 70,
      origin: { x: originX, y: originY },
      colors: ["#0071E3", "#34C759", "#FF9500", "#FF3B30", "#00C7BE", "#5856D6"],
      disableForReducedMotion: true,
      ticks: 200,
      gravity: 1.1,
      scalar: 1.0,
    });

    // 2. 飞星粒子动画（温润琥珀金阶）
    confetti({
      particleCount: 22,
      spread: 90,
      shapes: ["star"],
      colors: ["#9A6700", "#D4A373", "#F3D794", "#E8C547"],
      origin: { x: originX, y: originY },
      disableForReducedMotion: true,
      ticks: 180,
      gravity: 0.9,
      scalar: 1.3,
    });
  } catch (err) {
    console.warn("[fireCelebration] Confetti error:", err);
  }
}

export default function Today({ child, onExpired, active }) {
  const { preference: themePreference, effectiveTheme, cycleTheme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completingIds, setCompletingIds] = useState(new Set());
  const [poppingId, setPoppingId] = useState(null);
  const [justCompleted, setJustCompleted] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", minutes: "20", start: "", end: "" });
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ start: "", end: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", minutes: "20", start: "", end: "" });
  const [showCompleted, setShowCompleted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [focusingTask, setFocusingTask] = useState(null);
  const focusActive=useRef(false);
  const closeFocus=()=>{focusActive.current=false;setFocusingTask(null);};
  const owner=data?.child?.id || child?.id || "unbound";
  const [localTimer,setLocalTimer]=useState(()=>readTimer(owner));
  const [clock,setClock]=useState(Date.now());
  const [queuedTasks,setQueuedTasks]=useState(()=>readCompletions(owner));
  const completionRequests=useRef(new Set());
  const syncLocal=()=>{setLocalTimer(readTimer(owner));setQueuedTasks(readCompletions(owner));setClock(Date.now());};
  useEffect(()=>{
    syncLocal();
    const changed=e=>{if(e.key===`family_plan_timer_v1:${owner}` || e.key===`family_plan_completion_v1:${owner}`)syncLocal();};
    window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);
  },[owner]);
  useEffect(()=>{
    if(localTimer?.phase!=="running")return;
    const id=setInterval(()=>setClock(Date.now()),500);
    const visible=()=>setClock(Date.now());
    document.addEventListener("visibilitychange",visible);
    return()=>{clearInterval(id);document.removeEventListener("visibilitychange",visible);};
  },[localTimer?.phase]);
  const beginTimer=task=>{
    if(focusActive.current){childFeedback.toast("请先结束专注");return;}
    try{startTimer(owner,task);syncLocal();}catch(e){childFeedback.toast(e.message);}
  };
  const toggleTimer=task=>{try{if(localTimer?.phase==="running")pauseTimer(owner);else startTimer(owner,task);syncLocal();}catch(e){childFeedback.toast(e.message);}};
  const cancelTimer=async()=>{
    if(await childFeedback.confirm({title:"取消计时",message:"清除本机计时？任务仍可正常完成。",confirmText:"取消计时",cancelText:"保留",icon:null})){saveTimer(owner,null);syncLocal();}
  };
  const beginFocus=task=>{if(readTimer(owner)){childFeedback.toast("请先完成或取消当前计时");return;}focusActive.current=true;setFocusingTask(task);};

  // 1s 防抖记录：记录每个任务上一次点击完成的时间戳
  const lastCompleteTimeRef = useRef(new Map());
  // 正在请求完成的任务集合引用，杜绝快速多点触控状态相互覆盖
  const inFlightIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);
  const loadSequence = useRef(0);
  const pendingMutations = useRef(0);
  const [savingTask, setSavingTask] = useState(false);

  const load = useCallback(async (forceLoading = false) => {
    const sequence = ++loadSequence.current;
    if (forceLoading || !hasLoadedRef.current) {
      setLoading(true);
    }
    setError("");
    try {
      const result = await fetchToday();
      if (sequence === loadSequence.current) { setData(result); hasLoadedRef.current = true; }
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      if (err.message === "token_expired") onExpired();
      else setError("加载失败，请重试");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [onExpired]);

  useEffect(() => {
    if (active) load();
    initAudioUnlock();
  }, [load, active]);

  useSseRefresh({ enabled: active, topics: ["tasks", "settings"], onRefresh: load, onExpired });
  useVisibilityRefresh({ enabled: active, onRefresh: load });

  /**
   * 任务完成处理：支持 72px 复选钮与番茄钟完成调用
   * 具备 1s 防抖、Web Audio 纯前端和弦音、Canvas Confetti 飞星礼花
   */
  async function runTaskAction(operation) {
    pendingMutations.current += 1;
    ++loadSequence.current;
    setSavingTask(true);
    try { const result = await operation(); await load(); return result; }
    finally { pendingMutations.current -= 1; setSavingTask(pendingMutations.current > 0); }
  }

  async function submitCompletion(packet) {
    if(completionRequests.current.has(packet.operation_id))return null;
    completionRequests.current.add(packet.operation_id);
    try {
      const result=await completeTask(packet.taskId,"easy",packet);
      acknowledgeCompletion(owner,packet.taskId);syncLocal();return result;
    } catch(err) {
      if([409,422].includes(err.status)){acknowledgeCompletion(owner,packet.taskId);syncLocal();}
      if(err.status===401)onExpired();
      throw err;
    } finally {completionRequests.current.delete(packet.operation_id);}
  }
  useEffect(()=>{
    const retry=async()=>{
      if(!navigator.onLine)return;
      for(const packet of Object.values(readCompletions(owner))){
        if(completionRequests.current.has(packet.operation_id))continue;
        try{await submitCompletion(packet);await load();}catch(err){if([409,422].includes(err.status))await load();}
      }
    };
    retry();const id=setInterval(retry,15000);
    window.addEventListener("online",retry);
    return()=>{clearInterval(id);window.removeEventListener("online",retry);};
  },[owner]);

  async function handleComplete(task, event) {
    if (!task || task.status === "completed" || task.status === "submitted") return;

    const now = Date.now();
    const lastTime = lastCompleteTimeRef.current.get(task.id) || 0;

    // 1秒防抖与并发防护 (单任务独立追踪，防止快速双击或多指并发撞车)
    if (inFlightIdsRef.current.has(task.id) || now - lastTime < 1000) {
      return;
    }
    inFlightIdsRef.current.add(task.id);
    lastCompleteTimeRef.current.set(task.id, now);
    setCompletingIds((prev) => new Set(prev).add(task.id));

    // 触发弹性弹跳动画
    setPoppingId(task.id);
    setTimeout(() => setPoppingId(null), 500);

    // 触发音效：需要家长确认的任务播放温暖提醒音，直发任务播放上升和弦音
    if (task.require_approval) {
      playTaskSubmitted();
    } else {
      playTaskComplete();
    }

    // 计算礼花起点位置
    let originX = 0.5;
    let originY = 0.6;
    if (event && event.clientX && event.clientY) {
      originX = Math.max(0.1, Math.min(0.9, event.clientX / (window.innerWidth || 1)));
      originY = Math.max(0.1, Math.min(0.9, event.clientY / (window.innerHeight || 1)));
    } else if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      originX = Math.max(0.1, Math.min(0.9, (rect.left + rect.width / 2) / (window.innerWidth || 1)));
      originY = Math.max(0.1, Math.min(0.9, (rect.top + rect.height / 2) / (window.innerHeight || 1)));
    }
    fireCelebration(originX, originY);

    try {
      const packet=freezeCompletion(owner,task);syncLocal();
      const result = await runTaskAction(() => submitCompletion(packet));
      if(!result)return;
      if (result.status === "submitted") {
        setJustCompleted({ id: task.id, title: task.title, stars: 0, isSubmitted: true });
      } else {
        setJustCompleted({ id: task.id, title: task.title, stars: result.stars_awarded, isSubmitted: false });
      }
      setTimeout(() => setJustCompleted(null), 2500);
    } catch (err) {
      syncLocal();childFeedback.toast(readCompletions(owner)[task.id]?"完成结果待同步，联网后会自动重试":err.message || "操作失败");
      if([409,422].includes(err.status))load();
    } finally {
      inFlightIdsRef.current.delete(task.id);
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function handleCreateTask() {
    try { await runTaskAction(async () => {
    if (!newForm.title.trim() || !newForm.minutes || parseInt(newForm.minutes) < 1) return;
    await createChildTask({
      title: newForm.title.trim(),
      expected_minutes: parseInt(newForm.minutes),
      scheduled_start: newForm.start || null,
      scheduled_end: plannedEnd(newForm.start,newForm.minutes).time || null,
    });
    setNewForm({ title: "", minutes: "20", start: "", end: "" });
    setShowAdd(false);

    }); } catch { setError("操作失败，请重试"); }
  }

  async function handleSchedule(taskId) {
    try { await runTaskAction(async () => {
    await scheduleChildTask(taskId, scheduleForm.start, scheduleForm.end);
    setSchedulingId(null);
    setScheduleForm({ start: "", end: "" });

    }); } catch { setError("操作失败，请重试"); }
  }

  function startSchedule(task) {
    setSchedulingId(task.id);
    setScheduleForm({ start: task.scheduled_start || "", end: task.scheduled_end || "" });
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      minutes: task.expected_minutes?.toString() || "",
      start: task.scheduled_start || "",
      end: task.scheduled_end || "",
    });
  }

  async function handleSaveEdit() {
    try { await runTaskAction(async () => {
    if (!editingId || !editForm.title.trim() || !editForm.minutes || parseInt(editForm.minutes) < 1)
      return;
    await updateChildTask(editingId, {
      title: editForm.title.trim(),
      expected_minutes: parseInt(editForm.minutes),
      scheduled_start: editForm.start || null,
      scheduled_end: plannedEnd(editForm.start,editForm.minutes).time || null,
    });
    setEditingId(null);

    }); } catch { setError("操作失败，请重试"); }
  }

  async function handleDelete(taskId) {
    try { await runTaskAction(async () => {
    const ok = await childFeedback.confirm({
      title: "删除任务",
      message: "确定删除这个任务吗？",
      confirmText: "删除",
      cancelText: "保留",
      icon: "🗑️",
    });
    if (!ok) return;
    await deleteChildTask(taskId);

    }); } catch { setError("操作失败，请重试"); }
  }

  function scheduleLabel(t) {
    if (t.scheduled_start) return `${t.scheduled_start}—${t.scheduled_end}`;
    return "自由安排";
  }

  const today = new Date();
  if (isValidTaskDate(data?.date)) { const [year, month, day] = data.date.split("-").map(Number); today.setFullYear(year, month - 1, day); }
  const dayLabel = DAY_NAMES[today.getDay()];
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 星期${dayLabel}`;

  useEffect(()=>{
    const timer=readTimer(owner);const task=data?.tasks?.find(t=>t.id===timer?.taskId);
    if(task && ["completed","submitted","deleted"].includes(task.status) && !readCompletions(owner)[task.id]){saveTimer(owner,null);syncLocal();}
  },[data,owner]);

  const timed = (data?.tasks || []).filter((t) => t.scheduled_start && t.status !== "completed");
  const free = (data?.tasks || []).filter((t) => !t.scheduled_start && t.status !== "completed");
  const completed = (data?.tasks || []).filter((t) => t.status === "completed");

  if (loading)
    return (
      <div style={{ textAlign: "center", paddingTop: "40vh", color: "var(--muted)" }}>加载中…</div>
    );
  if (error)
    return (
      <div style={{ textAlign: "center", paddingTop: "40vh" }}>
        <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>
        <button onClick={load} style={{ color: "var(--accent)", fontSize: "1rem", fontWeight: 600 }}>
          重试
        </button>
      </div>
    );

  const earnedStarsToday = completed.reduce((sum, t) => sum + (t.stars_awarded ?? t.reward_stars ?? 0), 0);

  return (
    <div>
      {localTimer && !(data?.tasks||[]).some(t=>t.id===localTimer.taskId) && <div className="task-stopwatch-orphan">
        <p className="task-stopwatch-orphan-title">{localTimer.title}</p>
        <p className="task-stopwatch-orphan-note">该任务不在今日列表中</p>
        <TaskStopwatch timer={localTimer} elapsedSeconds={Math.floor(timerMilliseconds(localTimer,clock)/1000)} onToggle={()=>toggleTimer({id:localTimer.taskId,title:localTimer.title})} onCancel={cancelTimer}/>
      </div>}
      {/* 顶部标题区 (Apple iOS Large Title) */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="ios-large-title">
              你好，{child?.name ?? "小朋友"}
            </h1>
            <p className="ios-page-subtitle">
              {dateStr}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {data?.rewards?.is_on_vacation && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: "var(--star-bg)",
                  color: "var(--star)",
                  border: "1px solid var(--star-border)",
                  fontWeight: 650,
                  fontSize: "0.8rem",
                }}
              >
                🌴 休假中
              </span>
            )}
            <button
              type="button"
              disabled={savingTask}
              className="ios-share-trigger-btn"
              onClick={() => setShowShareModal(true)}
              title="分享今日自律成就卡"
              aria-label="分享今日自律成就卡"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--accent)",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                transition: "opacity 0.15s ease",
              }}
            >
              <ShareIcon size={18} color="var(--accent)" />
            </button>
            <button
              type="button"
              className="ios-theme-trigger-btn"
              onClick={cycleTheme}
              title={`外观：${themePreference === "auto" ? "跟随系统 (" + (effectiveTheme === "dark" ? "深色" : "浅色") + ")" : themePreference === "dark" ? "深色模式" : "浅色模式"}，轻点切换`}
              aria-label="切换明暗主题"
            >
              {effectiveTheme === "dark" ? <SunIcon size={18} color="var(--star)" /> : <MoonIcon size={18} color="var(--accent)" />}
            </button>
          </div>
        </div>
      </div>

      {/* 今日进度概览 */}
      <div
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "16px 20px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.015em" }}>
            今日已完成 {completed.length} / {(data?.tasks || []).length} 项
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "10px", flexWrap: "wrap" }}>
            <span className="stat-chip">⭐ {formatStars(data?.rewards?.stars_total ?? 0)} 星</span>
            <span className="stat-chip flame">🔥 {data?.rewards?.current_streak_days ?? 0} 天连胜</span>
            {data?.rewards?.streak_freeze_count > 0 && (
              <span className="stat-chip protect">❄️ {data?.rewards?.streak_freeze_count} 卡</span>
            )}
          </div>
        </div>
      </div>

      {data?.tasks?.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 16px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            boxShadow: "var(--shadow-sm)",
            color: "var(--muted)",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)", marginBottom: "4px" }}>
            今天的所有任务都整理好啦
          </p>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
            享受充实的一天，尽情去探索与玩耍吧！
          </p>
        </div>
      )}

      {/* 待完成任务 (Apple Reminders Inset Grouped Table) */}
      {[...timed, ...free].length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", marginBottom: "8px", paddingLeft: "4px" }}>
            今日任务 ({[...timed, ...free].length})
          </div>
          <div className="ios-grouped-card task-list-card">
            {[...timed, ...free].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                child={child}
                completing={completingIds.has(task.id)}
                poppingId={poppingId}
                schedulingId={schedulingId}
                scheduleForm={scheduleForm}
                setScheduleForm={setScheduleForm}
                editingId={editingId}
                editForm={editForm}
                setEditForm={setEditForm}
                onComplete={handleComplete}
                onStartFocus={beginFocus}
                onStartTimer={beginTimer}
                onToggleTimer={toggleTimer}
                onCancelTimer={cancelTimer}
                timer={localTimer?.taskId===task.id?localTimer:null}
                elapsedSeconds={localTimer?.taskId===task.id?Math.floor(timerMilliseconds(localTimer,clock)/1000):null}
                completionQueued={!!queuedTasks[task.id]}
                onSchedule={startSchedule}
                onSaveSchedule={handleSchedule}
                onCancelSchedule={() => setSchedulingId(null)}
                onEdit={startEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onDelete={handleDelete}
                scheduleLabel={scheduleLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已完成任务 */}
      {completed.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--muted)", marginBottom: "8px", paddingLeft: "4px" }}>
            已完成 ({completed.length})
          </div>
          <div className="ios-grouped-card task-list-card">
            {completed.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                child={child}
                completing={completingIds.has(task.id)}
                poppingId={poppingId}
                schedulingId={schedulingId}
                scheduleForm={scheduleForm}
                setScheduleForm={setScheduleForm}
                editingId={editingId}
                editForm={editForm}
                setEditForm={setEditForm}
                onComplete={handleComplete}
                onStartFocus={beginFocus}
                onStartTimer={beginTimer}
                onToggleTimer={toggleTimer}
                onCancelTimer={cancelTimer}
                timer={localTimer?.taskId===task.id?localTimer:null}
                elapsedSeconds={localTimer?.taskId===task.id?Math.floor(timerMilliseconds(localTimer,clock)/1000):null}
                completionQueued={!!queuedTasks[task.id]}
                onSchedule={startSchedule}
                onSaveSchedule={handleSchedule}
                onCancelSchedule={() => setSchedulingId(null)}
                onEdit={startEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onDelete={handleDelete}
                scheduleLabel={scheduleLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* 新建任务入口 (统一 iOS Sheet 底部滑出模式) */}
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--accent)",
            borderRadius: "14px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>+ 添加日常任务</span>
        </button>

        {showAdd && (
          <div
            className="ios-sheet-overlay"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "saturate(180%) blur(16px)",
              WebkitBackdropFilter: "saturate(180%) blur(16px)",
              zIndex: 1000,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
            }}
            onClick={() => setShowAdd(false)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "540px",
                backgroundColor: "#F2F2F7",
                borderRadius: "16px 16px 0 0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drawer-handle-bar" />
              <div className="ios-sheet-header">
                <button
                  type="button"
                  className="ios-sheet-nav-btn"
                  onClick={() => setShowAdd(false)}
                >
                  取消
                </button>
                <span className="ios-sheet-header-title">添加任务</span>
                <button
                  type="button"
                  className="ios-sheet-nav-action-btn"
                  onClick={handleCreateTask}
                  disabled={!newForm.title.trim()}
                >
                  添加
                </button>
              </div>

              {/* iOS Inset Grouped Table Views */}
              <div className="ios-sheet-body">
                {/* Group 1: 任务核心信息 */}
                <div className="ios-grouped-card" style={{ marginBottom: "18px" }}>
                  {/* Row 1: 标题 (Borderless direct input) */}
                  <div style={{ padding: "12px 16px" }}>
                    <label htmlFor="child-task-title" style={{display:"block",marginBottom:8}}><FieldLabel required>任务名称</FieldLabel></label>
                    <input
                      id="child-task-title" required
                      placeholder="任务名称，如：练琴、口算一页..."
                      value={newForm.title}
                      onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: "1.02rem",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                      autoFocus
                    />
                  </div>

                  <div className="ios-separator" />

                  <TaskTimingFields minutes={newForm.minutes} start={newForm.start} onChange={patch=>setNewForm(f=>({...f,...patch}))}/>
                  <p style={{padding:"8px 16px",color:"var(--muted)"}}>奖励由家长确认后设置</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 完成/提交吐司提示 */}
      {justCompleted && (
        <div
          style={{
            position: "fixed",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            background: justCompleted.isSubmitted ? "var(--star)" : "var(--accent)",
            color: "#FFFFFF",
            padding: "0.8rem 1.6rem",
            borderRadius: "var(--radius-pill)",
            fontSize: "1rem",
            fontWeight: 650,
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            zIndex: 1200,
          }}
        >
          {justCompleted.isSubmitted
            ? `⏳ ${justCompleted.title} 已提交，等待家长点赞！`
            : `🌱 ${justCompleted.title} 完成！+${justCompleted.stars}⭐`}
        </div>
      )}

      {/* 沉浸式专注番茄钟模态框 */}
      {focusingTask && (
        <FocusTimer
          task={focusingTask}
          onClose={closeFocus}
          onComplete={(t) => {
            handleComplete(t);
            closeFocus();
          }}
        />
      )}

      {/* 自律成长成就卡分享抽屉 (iOS Sheet) */}
      <SharePosterModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        childName={child?.name || "小朋友"}
        dateStr={dateStr}
        completionRate={data?.tasks?.length ? Math.round((completed.length / data.tasks.length) * 100) : 0}
        completedCount={completed.length}
        totalCount={(data?.tasks || []).length}
        streakDays={data?.rewards?.current_streak_days ?? 0}
        stars={data?.rewards?.stars_total ?? 0}
        starsToday={earnedStarsToday}
        tasks={data?.tasks || []}
      />
    </div>
  );
}

/**
 * 任务卡片组件 (TaskCard)
 * 重构升级：
 * 1. 带文字的完成按钮，44px最小触控高度，保留弹性动画与1s防抖
 * 2. 针对时长型任务（expected_minutes > 0）提供 ⏱️ 开启专注 入口，无缝唤起 FocusTimer
 */
function TaskCard({
  task,
  child,
  completing,
  completingId,
  poppingId,
  schedulingId,
  scheduleForm,
  setScheduleForm,
  editingId,
  editForm,
  setEditForm,
  onComplete,
  onStartTimer, onToggleTimer, onCancelTimer, timer, elapsedSeconds, completionQueued,
  onStartFocus,
  onSchedule,
  onSaveSchedule,
  onCancelSchedule,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  scheduleLabel,
}) {
  const isScheduled = !!task.scheduled_start;
  const isChildTask = task.created_by === "child";
  const isUnapproved = (isChildTask && !task.approved) || (task.status === "pending" && (task.reward_stars == null || task.reward_stars < 1));
  const isCompleted = task.status === "completed";
  const isSubmitted = task.status === "submitted";
  const isCompleting = completing !== undefined ? completing : completingId === task.id;
  const isPopping = poppingId === task.id;
  const isTiming = !!timer && !isCompleted && !isSubmitted && !completionQueued;
  const src = task.schedule_by === "child" ? `${child?.name || "孩子"}安排` : "";

  return (
    <div className={`reminders-task-row${isTiming ? " task-row--timing" : ""}`}>
      {editingId === task.id ? (
        <div style={{ width: "100%" }}>
          <label htmlFor={`child-edit-title-${task.id}`} style={{display:"block",marginBottom:8}}><FieldLabel required>任务名称</FieldLabel></label>
          <input
            id={`child-edit-title-${task.id}`} required
            placeholder="任务名"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            className="form-input-journal"
            style={{ marginBottom: "8px" }}
            autoFocus
          />
          <TaskTimingFields minutes={editForm.minutes} start={editForm.start} onChange={patch=>setEditForm(f=>({...f,...patch}))}/>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => onSaveEdit(task.id)} style={st.fsb}>
              保存
            </button>
            <button onClick={onCancelEdit} style={st.fcb}>
              取消
            </button>
          </div>
        </div>
      ) : schedulingId === task.id ? (
        <div style={{ width: "100%" }}>
          <TaskTimingFields showDuration={false} minutes={task.expected_minutes || 20} start={scheduleForm.start} onChange={patch=>setScheduleForm(f=>({...f,...patch}))}/>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => onSaveSchedule(task.id)} style={st.fsb}>
              保存
            </button>
            <button onClick={onCancelSchedule} style={st.fcb}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "12px" }}>
          {/* 左侧：任务详情区域 (从左到右阅读顺畅) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingRight: isTiming ? 40 : 0 }}>
              <p
                style={{
                  fontSize: "1rem",
                  lineHeight: "1.25",
                  fontWeight: 600,
                  color: isCompleted ? "var(--muted)" : "var(--text)",
                  textDecoration: isCompleted ? "line-through" : "none",
                  wordBreak: "break-word",
                  letterSpacing: "-0.015em",
                }}
              >
                {task.title}
              </p>
              {isSubmitted && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    backgroundColor: "var(--star-bg)",
                    border: "1px solid var(--star-border)",
                    color: "var(--star)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  等待家长点赞
                </span>
              )}
              {task.require_approval && !isSubmitted && !isCompleted && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "rgba(118, 118, 128, 0.12)",
                    color: "var(--text)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  需家长确认
                </span>
              )}
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>
              {task.expected_minutes ? `${task.expected_minutes} 分钟 · ` : ""}{isUnapproved ? "待家长定星" : `⭐+${task.reward_stars}`}
              {isScheduled ? ` · ${task.scheduled_start}${task.scheduled_end ? `-${task.scheduled_end}` : ""}` : " · 自由安排"}
            </p>

            {task.actual_seconds != null && (isCompleted || isSubmitted) && <p className="task-actual-duration">
              <span aria-hidden="true"><TimerIcon size={14}/></span><span>用时</span>
              <time dateTime={`PT${task.actual_seconds}S`} aria-label={formatActualSeconds(task.actual_seconds)}>{formatElapsedSeconds(task.actual_seconds)}</time>
            </p>}
            {isTiming && <TaskStopwatch timer={timer} elapsedSeconds={elapsedSeconds} onToggle={()=>onToggleTimer(task)}
              onCancel={onCancelTimer} onComplete={event=>onComplete(task,event)} busy={isCompleting}/>}

            {/* 常用操作直接展示，使用相同的图标与文字样式。 */}
            {!isCompleted && !isSubmitted && !isTiming && <div
              className="task-card-actions" role="group" aria-label={`任务操作：${task.title}`}
            >
              {!isCompleted && !isSubmitted && !isUnapproved && !completionQueued && !timer && <button type="button" onClick={()=>onStartTimer(task)} className="task-text-action"><span aria-hidden="true"><TimerIcon size={18}/></span>计时</button>}
              {completionQueued&&<p className="task-completion-queued" role="status">完成结果待同步</p>}
              {!isUnapproved && !completionQueued && task.expected_minutes > 0 && <button type="button" onClick={() => onStartFocus(task)} className="task-text-action" title={`专注 ${task.expected_minutes} 分钟`}><span aria-hidden="true"><ClockIcon strokeWidth={1.8}/></span>专注</button>}
              {!isUnapproved && !completionQueued && !isScheduled && task.created_by === "parent" && <button type="button" onClick={() => onSchedule(task)} className="task-text-action"><span aria-hidden="true"><CalendarDaysIcon strokeWidth={1.8}/></span>安排时间</button>}

              {isUnapproved && (
                <button onClick={() => onEdit(task)} style={st.pillBtn}>
                  修改
                </button>
              )}
              {isUnapproved && (
                <button
                  onClick={() => onDelete(task.id)}
                  style={{ ...st.pillBtn, background: "var(--danger-bg)", color: "var(--danger)" }}
                >
                  删除
                </button>
              )}

            </div>}
          </div>

          {/* 计时中使用面板内唯一的完成按钮 */}
          {!isTiming && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isSubmitted ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--star-bg)",
                  border: "1.5px solid var(--star-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="等待家长点赞发星"
              >
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>⏳</span>
              </div>
            ) : !isUnapproved ? (
              <button
                type="button"
                onClick={(e) => onComplete(task, e)}
                disabled={isCompleted || isCompleting || completionQueued}
                className={`task-check-btn task-complete-action ${isCompleted ? "completed" : ""} ${isPopping ? "spring-pop" : ""}`}
                aria-busy={isCompleting}
                aria-label={isCompleted ? "任务已完成" : `标记完成: ${task.title}`}
                title={isCompleted ? "已完成" : completionQueued ? "完成结果待同步" : "标记任务完成"}
              >
                {!isCompleting && <CheckIcon aria-hidden="true" strokeWidth={2.2} />}
                <span>{isCompleted ? "已完成" : isCompleting ? "提交中…" : completionQueued ? "待同步" : "完成"}</span>
              </button>
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "1px solid var(--danger-border)",
                  background: "var(--danger-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "0.68rem", color: "var(--danger)", fontWeight: 700 }}>待确认</span>
              </div>
            )}
          </div>}
        </div>
      )}
    </div>
  );
}

const st = {
  tc: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "14px 16px",
    marginBottom: "10px",
    boxShadow: "var(--shadow-sm)",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  },
  fi: {
    padding: "0.55rem 0.7rem",
    fontSize: "0.9rem",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    outline: "none",
    background: "var(--card)",
    color: "var(--text)",
    display: "block",
    marginBottom: "0.5rem",
    width: "100%",
    fontVariantNumeric: "tabular-nums",
  },
  fsb: {
    flex: 1,
    padding: "8px",
    fontSize: "0.9rem",
    fontWeight: 650,
    color: "#FFFFFF",
    background: "var(--accent)",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0, 113, 227, 0.25)",
  },
  fcb: {
    flex: 1,
    padding: "8px",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "var(--muted)",
    background: "rgba(118, 118, 128, 0.12)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
  },
  pillBtn: {
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    background: "rgba(118, 118, 128, 0.12)",
    color: "var(--text)",
    border: "none",
    fontSize: "0.78rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
};
