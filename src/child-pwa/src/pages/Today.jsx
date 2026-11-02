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
import FocusTimer from "../components/FocusTimer.jsx";

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
      colors: ["#436A54", "#9A6700", "#C2410C", "#0E7490", "#76A28A", "#D4A373"],
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completingIds, setCompletingIds] = useState(new Set());
  const [poppingId, setPoppingId] = useState(null);
  const [justCompleted, setJustCompleted] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", minutes: "", stars: 1, start: "", end: "" });
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ start: "", end: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", minutes: "", stars: 1, start: "", end: "" });
  const [showCompleted, setShowCompleted] = useState(false);
  const [focusingTask, setFocusingTask] = useState(null);

  // 1s 防抖记录：记录每个任务上一次点击完成的时间戳
  const lastCompleteTimeRef = useRef(new Map());
  // 正在请求完成的任务集合引用，杜绝快速多点触控状态相互覆盖
  const inFlightIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (forceLoading = false) => {
    if (forceLoading || !hasLoadedRef.current) {
      setLoading(true);
    }
    setError("");
    try {
      const result = await fetchToday();
      setData(result);
      hasLoadedRef.current = true;
    } catch (err) {
      if (err.message === "token_expired") onExpired();
      else setError("加载失败，请重试");
    } finally {
      setLoading(false);
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
      const result = await completeTask(task.id, "easy");
      if (result.status === "submitted") {
        setJustCompleted({ id: task.id, title: task.title, stars: 0, isSubmitted: true });
      } else {
        setJustCompleted({ id: task.id, title: task.title, stars: result.stars_awarded, isSubmitted: false });
      }
      setTimeout(() => setJustCompleted(null), 2500);
      await load();
    } catch {
      setError("操作失败");
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
    if (!newForm.title.trim() || !newForm.minutes || parseInt(newForm.minutes) < 1) return;
    await createChildTask({
      title: newForm.title.trim(),
      expected_minutes: parseInt(newForm.minutes),
      reward_stars: newForm.stars,
      scheduled_start: newForm.start || null,
      scheduled_end: newForm.end || null,
    });
    setNewForm({ title: "", minutes: "", stars: 1, start: "", end: "" });
    setShowAdd(false);
    load();
  }

  async function handleSchedule(taskId) {
    if (!scheduleForm.start || !scheduleForm.end) return;
    await scheduleChildTask(taskId, scheduleForm.start, scheduleForm.end);
    setSchedulingId(null);
    setScheduleForm({ start: "", end: "" });
    load();
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
      stars: task.reward_stars,
      start: task.scheduled_start || "",
      end: task.scheduled_end || "",
    });
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.title.trim() || !editForm.minutes || parseInt(editForm.minutes) < 1)
      return;
    await updateChildTask(editingId, {
      title: editForm.title.trim(),
      expected_minutes: parseInt(editForm.minutes),
      reward_stars: editForm.stars,
      scheduled_start: editForm.start || null,
      scheduled_end: editForm.end || null,
    });
    setEditingId(null);
    load();
  }

  async function handleDelete(taskId) {
    if (!window.confirm("删除这个任务？")) return;
    await deleteChildTask(taskId);
    load();
  }

  function scheduleLabel(t) {
    if (t.scheduled_start) return `${t.scheduled_start}—${t.scheduled_end}`;
    return "自由安排";
  }

  const today = new Date();
  const dayLabel = DAY_NAMES[today.getDay()];
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 星期${dayLabel}`;

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

  return (
    <div>
      <div style={{ marginBottom: "1.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.015em" }}>
            你好，{child?.name ?? "小朋友"}
          </h1>
          {data?.rewards?.is_on_vacation && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                borderRadius: "var(--radius-pill)",
                background: "var(--star-bg)",
                color: "var(--star)",
                border: "1px solid var(--star-border)",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              🌴 休假中
            </span>
          )}
        </div>
        <p style={{ color: "var(--muted)", marginTop: "0.3rem", fontSize: "0.95rem" }}>{dateStr}</p>
      </div>

      {data?.rewards?.is_on_vacation && (
        <div
          style={{
            background: "var(--star-bg)",
            border: "1px solid var(--star-border)",
            borderRadius: "16px",
            padding: "0.75rem 1rem",
            marginBottom: "1.2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            color: "var(--star)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🌴</span>
          <div>
            <div style={{ fontWeight: 750, fontSize: "0.95rem" }}>休假中 · 任务自动豁免</div>
            <div style={{ fontSize: "0.78rem", color: "var(--star)", opacity: 0.85 }}>尽情享受假期，连击不会中断哦！</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.4rem" }}>
        <div
          style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
            padding: "0.9rem 0.4rem",
            textAlign: "center",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--star)", fontVariantNumeric: "tabular-nums" }}>
            ⭐ {formatStars(data?.rewards?.stars_total ?? 0)}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>星星</p>
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
            padding: "0.9rem 0.4rem",
            textAlign: "center",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--flame)", fontVariantNumeric: "tabular-nums" }}>
            🔥 {data?.rewards?.current_streak_days ?? 0}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>连续天数</p>
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
            padding: "0.9rem 0.4rem",
            textAlign: "center",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--protect)", fontVariantNumeric: "tabular-nums" }}>
            ❄️ {data?.rewards?.streak_freeze_count ?? 0}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>保护卡</p>
        </div>
      </div>

      {data?.tasks?.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "2.6rem 1rem",
            background: "var(--card)",
            borderRadius: "var(--radius)",
            border: "1px dashed var(--border)",
            margin: "1.5rem 0",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: "2.4rem", display: "block", marginBottom: "0.5rem" }}>🌿</span>
          <p style={{ fontWeight: 650, fontSize: "1.05rem", color: "var(--text)", marginBottom: "0.3rem" }}>
            今天的所有任务都整理好啦
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            享受充实的一天，尽情去探索与玩耍吧！
          </p>
        </div>
      )}

      {timed.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <p style={{ fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "0.5rem" }}>
            已安排时间
          </p>
          {timed.map((task) => (
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
              onStartFocus={(t) => setFocusingTask(t)}
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
      )}

      {free.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <p style={{ fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "0.5rem" }}>
            自由安排
          </p>
          {free.map((task) => (
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
              onStartFocus={(t) => setFocusingTask(t)}
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
      )}

      {completed.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "0.8rem",
            marginBottom: "1.2rem",
          }}
        >
          <button
            onClick={() => setShowCompleted((c) => !c)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "0.4rem 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 650,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{showCompleted ? "▼" : "▶"} 已完成 {completed.length} 项 · 每一项都是成长的印记 🌱</span>
            <span style={{ fontSize: "0.78rem", color: "var(--accent)" }}>{showCompleted ? "收起" : "展开查看"}</span>
          </button>
          {showCompleted && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              {completed.map((task) => (
                <div key={task.id} style={{ flex: "1 1 280px", minWidth: 0 }}>
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
                    onStartFocus={(t) => setFocusingTask(t)}
                    onSchedule={startSchedule}
                    onSaveSchedule={handleSchedule}
                    onCancelSchedule={() => setSchedulingId(null)}
                    onEdit={startEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={handleDelete}
                    scheduleLabel={scheduleLabel}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "0.95rem",
              fontWeight: 650,
              color: "var(--accent)",
              border: "1.5px dashed var(--accent)",
              borderRadius: "16px",
              background: "var(--accent-light)",
              boxShadow: "var(--shadow-sm)",
              cursor: "pointer",
            }}
          >
            + 添加任务
          </button>
        ) : (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              padding: "1.1rem",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <input
              placeholder="任务名 *"
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
              style={st.fi}
              autoFocus
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="number"
                placeholder="分钟 *"
                value={newForm.minutes}
                onChange={(e) => setNewForm({ ...newForm, minutes: e.target.value })}
                style={{ ...st.fi, flex: 1 }}
              />
              <RewardSelect
                value={newForm.stars}
                onChange={(value) => setNewForm({ ...newForm, stars: value })}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="time"
                value={newForm.start}
                onChange={(e) => setNewForm({ ...newForm, start: e.target.value })}
                style={{ ...st.fi, flex: 1 }}
              />
              <input
                type="time"
                value={newForm.end}
                onChange={(e) => setNewForm({ ...newForm, end: e.target.value })}
                style={{ ...st.fi, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleCreateTask} style={st.fsb}>
                添加
              </button>
              <button onClick={() => setShowAdd(false)} style={st.fcb}>
                取消
              </button>
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
            boxShadow: "0 6px 20px rgba(67, 106, 84, 0.28)",
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
          onClose={() => setFocusingTask(null)}
          onComplete={(t) => {
            handleComplete(t);
            setFocusingTask(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * 任务卡片组件 (TaskCard)
 * 重构升级：
 * 1. 增加 72x72px 超大彩色复选圆钮（Min Target >= 64px 符合儿童人体工学），支持弹性动画与 1s 防抖
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
  const isUnapproved = isChildTask && !task.approved;
  const isCompleted = task.status === "completed";
  const isSubmitted = task.status === "submitted";
  const isCompleting = completing !== undefined ? completing : completingId === task.id;
  const isPopping = poppingId === task.id;
  const src = task.schedule_by === "child" ? `${child?.name || "孩子"}安排` : "";

  return (
    <div style={{ ...st.tc, opacity: isCompleted ? 0.65 : 1 }}>
      {editingId === task.id ? (
        <div>
          <input
            placeholder="任务名 *"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            style={st.fi}
            autoFocus
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="number"
              placeholder="分钟 *"
              value={editForm.minutes}
              onChange={(e) => setEditForm({ ...editForm, minutes: e.target.value })}
              style={{ ...st.fi, flex: 1 }}
            />
            <RewardSelect
              value={editForm.stars}
              onChange={(value) => setEditForm({ ...editForm, stars: value })}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="time"
              value={editForm.start}
              onChange={(e) => setEditForm({ ...editForm, start: e.target.value })}
              style={{ ...st.fi, flex: 1 }}
            />
            <input
              type="time"
              value={editForm.end}
              onChange={(e) => setEditForm({ ...editForm, end: e.target.value })}
              style={{ ...st.fi, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
            <button onClick={() => onSaveEdit(task.id)} style={st.fsb}>
              保存
            </button>
            <button onClick={onCancelEdit} style={st.fcb}>
              取消
            </button>
          </div>
        </div>
      ) : schedulingId === task.id ? (
        <div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="time"
              value={scheduleForm.start}
              onChange={(e) => setScheduleForm({ ...scheduleForm, start: e.target.value })}
              style={{ ...st.fi, flex: 1 }}
            />
            <input
              type="time"
              value={scheduleForm.end}
              onChange={(e) => setScheduleForm({ ...scheduleForm, end: e.target.value })}
              style={{ ...st.fi, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
            <button onClick={() => onSaveSchedule(task.id)} style={st.fsb}>
              保存
            </button>
            <button onClick={onCancelSchedule} style={st.fcb}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* 72x72px 精致印章/素雅纸贴般触控复选圆钮 (Min Target >= 64px 符合儿童人体工学) */}
          {isSubmitted ? (
            <button
              type="button"
              disabled={true}
              className="task-check-btn submitted"
              aria-label="等待家长点赞"
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>⏳</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--star)", marginTop: 2 }}>
                待点赞
              </span>
            </button>
          ) : !isUnapproved ? (
            <button
              type="button"
              onClick={(e) => onComplete(task, e)}
              disabled={isCompleted || isCompleting}
              className={`task-check-btn ${isCompleted ? "completed" : ""} ${isPopping ? "spring-pop" : ""}`}
              aria-label={isCompleted ? "任务已完成" : `标记完成: ${task.title}`}
              style={{ flexShrink: 0 }}
            >
              {isCompleted ? (
                <span style={{ fontSize: "2rem", fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>
                  ✓
                </span>
              ) : isCompleting ? (
                <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent)" }}>…</span>
              ) : (
                <span
                  style={{
                    fontSize: "1.9rem",
                    fontWeight: 800,
                    color: "var(--accent)",
                    opacity: 0.45,
                    lineHeight: 1,
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                minWidth: 72,
                minHeight: 72,
                borderRadius: "50%",
                border: "2.5px dashed var(--danger)",
                background: "var(--danger-bg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 700 }}>待确认</span>
            </div>
          )}

          {/* 任务详情区域 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <p
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 650,
                  color: isCompleted ? "var(--muted)" : isSubmitted ? "var(--star)" : "var(--text)",
                  textDecoration: isCompleted ? "line-through" : "none",
                  wordBreak: "break-word",
                  letterSpacing: "-0.01em",
                }}
              >
                {task.title}
              </p>
              {isSubmitted && (
                <span className="task-submitted-badge">
                  ⏳ 等待家长点赞
                </span>
              )}
              {task.require_approval && !isSubmitted && !isCompleted && (
                <span
                  style={{
                    padding: "0.15rem 0.55rem",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--star-bg)",
                    color: "var(--star)",
                    border: "1px solid var(--star-border)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  需家长确认
                </span>
              )}
              {isScheduled && !isCompleted && (
                <span
                  style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-pill)",
                    fontSize: "0.75rem",
                    fontWeight: 650,
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.scheduled_start}
                </span>
              )}
            </div>

            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              {task.expected_minutes ? `${task.expected_minutes}分钟 · ` : ""}⭐{task.reward_stars}
              {isScheduled ? ` · ${scheduleLabel(task)}${src ? ` (${src})` : ""}` : " · 自由安排"}
            </p>

            {/* 操作入口行 */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "0.45rem",
              }}
            >
              {/* 时长型任务 (expected_minutes > 0) 提供 ⏱️ 开启专注 入口 */}
              {task.expected_minutes > 0 && !isCompleted && !isSubmitted && (
                <button
                  type="button"
                  onClick={() => onStartFocus(task)}
                  className="task-focus-btn"
                  aria-label={`开启 ${task.title} 专注计时`}
                >
                  ⏱️ 开启专注 ({task.expected_minutes}m)
                </button>
              )}

              {isUnapproved && (
                <button onClick={() => onEdit(task)} style={st.pillBtn}>
                  修改
                </button>
              )}
              {isUnapproved && (
                <button
                  onClick={() => onDelete(task.id)}
                  style={{ ...st.pillBtn, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)" }}
                >
                  删除
                </button>
              )}
              {!isUnapproved && !isScheduled && task.created_by === "parent" && !isCompleted && !isSubmitted && (
                <button onClick={() => onSchedule(task)} style={st.pillBtn}>
                  安排时间
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      style={{ ...st.fi, flex: 1 }}
    >
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n === 0 ? "0⭐" : "⭐".repeat(n)}
        </option>
      ))}
    </select>
  );
}

const st = {
  tc: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "20px",
    padding: "1rem 1.15rem",
    marginBottom: "0.85rem",
    boxShadow: "var(--shadow-card)",
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
    padding: "0.55rem",
    fontSize: "0.9rem",
    fontWeight: 650,
    color: "#FFFFFF",
    background: "var(--accent)",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)",
  },
  fcb: {
    flex: 1,
    padding: "0.55rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "var(--muted)",
    background: "#F0ECE4",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    cursor: "pointer",
  },
  pillBtn: {
    padding: "0.35rem 0.7rem",
    borderRadius: "var(--radius-pill)",
    background: "var(--accent-light)",
    color: "var(--accent)",
    border: "1px solid var(--accent-pill)",
    fontSize: "0.8rem",
    fontWeight: 650,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
};
