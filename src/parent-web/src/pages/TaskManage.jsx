import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { isValidTaskDate } from "../utils/date.js";
import TaskShareDialog from "../components/TaskShareDialog.jsx";
import { createRefreshQueue } from "../utils/refreshQueue.js";
import { useFeedback } from "../components/FeedbackContext.jsx";

function parseLocal(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDate(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${dd}`; }
function addDays(s, n) { const r = parseLocal(s); r.setDate(r.getDate() + n); return fmtDate(r); }
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
function weekdayLabel(d) { return WEEKDAYS[d === 7 ? 0 : d] || ""; }
function formatWeekdays(days = []) { return days.map(weekdayLabel).filter(Boolean).join("、"); }

function pad(n) { return String(n).padStart(2, "0"); }
function timeToMinutes(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; }
function autoFillTime(minutes, start, end) { const dur = parseInt(minutes) || 0; if (!dur) return { start, end }; if (start && !end) return { start, end: minutesToTime(timeToMinutes(start) + dur) }; if (end && !start) return { start: minutesToTime(timeToMinutes(end) - dur), end }; return { start, end }; }

export default function TaskManage({ token, child, isActive, onExpired, onBack }) {
  const { toast, confirm } = useFeedback();
  const [date, setDate] = useState(() => fmtDate(new Date()));
  const [plan, setPlan] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState({ stars_total: 0, current_streak_days: 0 });
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", minutes: "", stars: 1, start: "", end: "", require_approval: false });
  const [routineForm, setRoutineForm] = useState({ title: "", minutes: "", stars: 1, weekdays: [1, 2, 3, 4, 5], require_approval: false });
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", minutes: "", stars: 1, start: "", end: "", require_approval: false });
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [routineEditForm, setRoutineEditForm] = useState({ title: "", minutes: "", stars: 1, weekdays: [], require_approval: false });
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [loadedTaskDate, setLoadedTaskDate] = useState(null);
  const [taskLoadFailed, setTaskLoadFailed] = useState(false);
  const [shareSnapshot, setShareSnapshot] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const taskLoadSequence = useRef(0);
  const taskReads = useRef(null);
  const planReads = useRef(null);
  const displayedTaskKey = useRef(null);
  const selectedPlanId = useRef(null);
  const currentTaskKey = `${child.id}:${plan?.id || ""}:${date}`;
  const desiredTaskKey = useRef(currentTaskKey);
  desiredTaskKey.current = currentTaskKey;
  const currentChildId = useRef(child.id);
  currentChildId.current = child.id;
  if (!taskReads.current) taskReads.current = createRefreshQueue();
  if (!planReads.current) planReads.current = createRefreshQueue();

  const loadTasks = useCallback((options = {}) => {
    if (!plan || (plan.child_id && plan.child_id !== child.id) || !isValidTaskDate(date)) return Promise.resolve();
    const key = `${child.id}:${plan.id}:${date}`;
    return taskReads.current(key, async () => {
      if (key !== desiredTaskKey.current) return false;
      const sequence = ++taskLoadSequence.current;
      setLoading(displayedTaskKey.current !== key); setSyncing(true);
      try {
        const data = await api.fetchDailyTasks(token, plan.id, date);
        if (sequence !== taskLoadSequence.current || key !== desiredTaskKey.current) return false;
        setTasks(data.tasks || []); setRewards(data.rewards || { stars_total: 0, current_streak_days: 0 }); setTaskError("");
        displayedTaskKey.current = key;
        setLoadedTaskDate(date); setTaskLoadFailed(false);
        return true;
      } catch (error) {
        if (sequence === taskLoadSequence.current && key === desiredTaskKey.current) { setTaskError(`加载任务失败：${error.message}`); setTaskLoadFailed(true); }
        return false;
      } finally {
        if (sequence === taskLoadSequence.current && key === desiredTaskKey.current) { setLoading(false); setSyncing(false); }
      }
    }, options);
  }, [token, plan, date, child.id]);

  function selectDate(value) {
    if (isValidTaskDate(value)) setDate(value);
  }

  function openShare() {
    if (loading || syncing || savingTask || taskLoadFailed || loadedTaskDate !== date) return;
    setShareSnapshot({
      date, childName: child.name, generatedAt: new Date().toISOString(),
      tasks: tasks.map(task => ({
        title: task.title, status: task.status, approved: task.approved,
        expected_minutes: task.expected_minutes, reward_stars: task.reward_stars,
        scheduled_start: task.scheduled_start, scheduled_end: task.scheduled_end,
      })),
    });
  }

  const loadRoutines = useCallback((options = {}) => planReads.current(`${token}:${child.id}`, async () => {
    try {
      const plans = await api.fetchPlans(token, child.id);
      if (currentChildId.current !== child.id) return false;
      if (!plans.some(item => item.id === selectedPlanId.current)) {
        const chosen = plans.find(item => item.status === "active") || plans[0] || null;
        selectedPlanId.current = chosen?.id || null;
        setPlan(chosen);
      }
      setRoutineTasks(plans.filter(item => item.status === "active").flatMap(item => (item.tasks || []).filter(task => task.status === "active")));
      return true;
    } catch (error) { if (currentChildId.current === child.id) setTaskError(`加载重复任务失败：${error.message}`); return false; }
  }, options), [token, child.id]);

  const refreshAll = useCallback((options = {}) => Promise.all([loadTasks(options), loadRoutines(options)]), [loadTasks, loadRoutines]);

  useEffect(() => { loadRoutines(); }, [loadRoutines]);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useSseRefresh({ token, enabled: isActive, topics: ["tasks", "settings"], childId: child.id, onRefresh: refreshAll, onExpired });
  useVisibilityRefresh({ enabled: isActive, onRefresh: refreshAll });
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current) refreshAll();
    wasActive.current = isActive;
  }, [isActive, refreshAll]);

  async function createDefaultPlan() { const t = fmtDate(new Date()); const p = await api.createPlan(token, { child_id: child.id, title: `${child.name}的计划`, start_date: t }); selectedPlanId.current = p.id; setPlan(p); setRoutineTasks([]); }

  async function handleAddTask() {
    if (!newTask.title.trim()) return; if (!newTask.minutes || parseInt(newTask.minutes) < 1) return;
    const filled = autoFillTime(newTask.minutes, newTask.start, newTask.end);
    await runTaskAction(async () => {
      await api.createManualTasks(token, plan.id, date, [{
        title: newTask.title.trim(),
        expected_minutes: parseInt(newTask.minutes),
        reward_stars: newTask.stars,
        require_approval: !!newTask.require_approval,
        scheduled_start: filled.start || null,
        scheduled_end: filled.end || null,
      }]);
      setNewTask({ title: "", minutes: "", stars: 1, start: "", end: "", require_approval: false }); setShowAddTask(false); await loadTasks();
    });
  }

  async function handleSaveEdit() {
    if (!editingTask || !plan) return;
    if (!editForm.title.trim()) { setTaskError("请填写任务名称"); return; }
    if (!editForm.minutes || parseInt(editForm.minutes) < 1) { setTaskError("请填写至少 1 分钟的任务时长"); return; }
    const task = tasks.find(item => item.id === editingTask);
    if (!task?.plan_id) { setTaskError("任务信息已变化，请刷新后重试"); return; }
    const filled = autoFillTime(editForm.minutes, editForm.start, editForm.end);
    await runTaskAction(async () => {
      await api.updateDailyTask(token, task.plan_id, editingTask, {
        title: editForm.title.trim(),
        expected_minutes: parseInt(editForm.minutes),
        reward_stars: editForm.stars,
        require_approval: !!editForm.require_approval,
        scheduled_start: filled.start || null,
        scheduled_end: filled.end || null,
        approved: editForm.approved === false ? true : editForm.approved,
      });
      setEditingTask(null); await loadTasks();
    });
  }

  async function runTaskAction(action) {
    if (savingTask) return;
    setTaskError(""); setSavingTask(true);
    try { await action(); }
    catch (error) { setTaskError(`操作失败：${error.message}`); }
    finally { setSavingTask(false); }
  }

  async function handleDeleteTask(taskId) {
    if (savingTask) return;
    const task = tasks.find(item => item.id === taskId);
    if (!task?.plan_id) { setTaskError("任务信息已变化，请刷新后重试"); return; }
    const ok = await confirm({
      title: "删除任务",
      message: "确定删除这个任务？",
      confirmText: "删除",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;
    await runTaskAction(async () => { await api.deleteDailyTask(token, task.plan_id, taskId); await loadTasks(); });
  }

  function startEditTask(t) {
    if (t.status === "completed" || savingTask) return;
    setTaskError("");
    setEditingTask(t.id);
    setEditForm({
      title: t.title,
      minutes: t.expected_minutes?.toString() || "",
      stars: t.reward_stars,
      start: t.scheduled_start || "",
      end: t.scheduled_end || "",
      approved: t.approved,
      require_approval: !!t.require_approval,
    });
  }

  async function handleApprove(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task?.plan_id) { setTaskError("任务信息已变化，请刷新后重试"); return; }
    await runTaskAction(async () => {
      await api.updateDailyTask(token, task.plan_id, taskId, { title: task.title, expected_minutes: task.expected_minutes, reward_stars: task.reward_stars, approved: true });
      await loadTasks();
    });
  }

  async function handleApproveSubmitted(taskId) {
    await runTaskAction(async () => {
      await api.approveTask(token, taskId);
      await loadTasks();
    });
  }

  async function handleRejectSubmitted(taskId) {
    await runTaskAction(async () => {
      await api.rejectTask(token, taskId);
      await loadTasks();
    });
  }

  async function handleRevokeTask(taskId) {
    const ok = await confirm({
      title: "撤回任务",
      message: "确定撤回该任务吗？撤回后任务将重置为待完成，并扣回奖励的星星。",
      confirmText: "撤回",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;
    await runTaskAction(async () => {
      await api.revokeTask(token, taskId);
      await loadTasks();
    });
  }

  async function handleAddRoutine() {
    if (!routineForm.title.trim() || !plan) return; if (!routineForm.minutes || parseInt(routineForm.minutes) < 1) return;
    setSavingRoutine(true);
    try {
      await runTaskAction(async () => {
        await api.addRoutineTask(token, plan.id, {
          title: routineForm.title.trim(),
          expected_minutes: parseInt(routineForm.minutes),
          weekdays: routineForm.weekdays,
          reward_stars: routineForm.stars,
          require_approval: !!routineForm.require_approval,
        });
        setRoutineForm({ title: "", minutes: "", stars: 1, weekdays: [1, 2, 3, 4, 5], require_approval: false }); setShowAddRoutine(false); await loadRoutines(); await loadTasks();
      });
    } finally { setSavingRoutine(false); }
  }

  function startEditRoutine(r) {
    setEditingRoutine(r.id);
    setRoutineEditForm({
      title: r.title,
      minutes: r.expected_minutes?.toString() || "",
      stars: r.reward_stars,
      weekdays: [...(r.weekdays || [])],
      require_approval: !!r.require_approval,
    });
  }
  async function handleSaveRoutine() {
    if (!editingRoutine || !routineEditForm.title.trim()) return;
    const routine = routineTasks.find(item => item.id === editingRoutine);
    if (!routine?.plan_id) { setTaskError("重复任务信息已变化，请刷新后重试"); return; }
    await runTaskAction(async () => {
      await api.updateRoutineTask(token, routine.plan_id, editingRoutine, {
        title: routineEditForm.title.trim(),
        expected_minutes: routineEditForm.minutes ? parseInt(routineEditForm.minutes) : null,
        weekdays: routineEditForm.weekdays,
        reward_stars: routineEditForm.stars,
        require_approval: !!routineEditForm.require_approval,
      });
      setEditingRoutine(null); await loadRoutines(); await loadTasks();
    });
  }
  async function handleDeleteRoutine(tid) {
    if (savingTask) return;
    const routine = routineTasks.find(item => item.id === tid);
    if (!routine?.plan_id) { setTaskError("重复任务信息已变化，请刷新后重试"); return; }
    const ok = await confirm({
      title: "删除重复任务",
      message: "删除这条重复任务？",
      confirmText: "删除",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;
    await runTaskAction(async () => { await api.deleteRoutineTask(token, routine.plan_id, tid); await loadRoutines(); await loadTasks(); });
  }

  async function generateCode() { const r = await api.getAccessCode(token, child.id); setAccessCode(r.code); }

  function scheduleLabel(t) { if (t.scheduled_start) { const who = t.schedule_by === "child" ? `${child.name}安排` : ""; return `${who} ${t.scheduled_start}—${t.scheduled_end}`.trim(); } return "自由安排"; }

  const selectedDate = parseLocal(date); const today = new Date(); const todayStr = fmtDate(today);
  const showAdd = date >= todayStr; const isToday = date === todayStr;
  const dateLabel = `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 周${WEEKDAYS[selectedDate.getDay()]}`;
  const submittedTasks = tasks.filter(t => t.status === "submitted");
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const completedCount = completedTasks.length;
  const totalStars = tasks.reduce((s, t) => s + (t.reward_stars || 0), 0);

  return (
    <fieldset disabled={savingTask} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {taskError && <p role="alert" style={{ color: "var(--danger)", marginBottom: "0.6rem" }}>{taskError}</p>}
      <div style={{ marginBottom: "1rem" }}><button onClick={onBack} style={s.link}>← 返回首页</button></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}><h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)" }}>{child.name}</h2><div style={{ fontSize: "0.9rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}><span style={{ color: "var(--star)", fontWeight: 650, marginRight: 8 }}>⭐{formatStars(rewards.stars_total)}</span><span style={{ color: "var(--flame)", fontWeight: 650 }}>🔥{rewards.current_streak_days}</span></div></div>
      {!plan && <div style={{ textAlign: "center", paddingTop: "2rem" }}><p style={{ color: "var(--muted)", marginBottom: "1rem" }}>请先创建计划</p><button onClick={createDefaultPlan} style={s.btn}>创建计划</button></div>}
      {plan && (<>
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1.2rem", alignItems: "center" }}><button onClick={() => selectDate(addDays(date, -1))} style={s.arr}>←</button><label style={s.dtLabel}><input type="date" aria-label="任务日期" min="0001-01-01" max="9999-12-31" value={date} onChange={e => selectDate(e.target.value)} style={{ width: "100%", padding: "0.4rem", fontSize: "0.85rem", border: "none", background: "transparent", textAlign: "center", cursor: "pointer", color: "inherit", fontFamily: "inherit", fontWeight: 600 }} /></label><button onClick={() => selectDate(addDays(date, 1))} style={s.arr}>→</button></div>
        {!isToday && <div style={{ textAlign: "center", marginTop: "-0.6rem", marginBottom: "0.4rem" }}><button onClick={() => setDate(todayStr)} style={{ color: "var(--accent)", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer" }}>回到今天</button></div>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.8rem" }}>
          <button type="button" onClick={openShare} disabled={loading || syncing || taskLoadFailed || loadedTaskDate !== date || savingTask}
            style={{ padding: "0.45rem 0.8rem", borderRadius: "10px", color: "#367e5b", background: "#edf3e9", fontSize: "0.8rem", fontWeight: 600, opacity: loading || taskLoadFailed || loadedTaskDate !== date ? 0.45 : 1 }}>
            分享图片
          </button>
        </div>

        <div style={s.panel} aria-busy={syncing}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}><h3 style={{ fontSize: "1rem", fontWeight: 700 }}>当日任务</h3><span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{tasks.length}项 · {completedCount}完成 · {totalStars}⭐</span></div>
          {loading && <p style={{ color: "var(--muted)", textAlign: "center" }}>加载中…</p>}
          {!loading && tasks.length === 0 && <p style={{ color: "var(--muted)", textAlign: "center", padding: "0.8rem 0" }}>当天暂无任务</p>}
          {submittedTasks.length > 0 && (
            <div style={{
              background: "var(--star-bg)",
              border: "1.5px solid var(--star-border)",
              borderRadius: "14px",
              padding: "0.85rem",
              marginBottom: "0.85rem",
              boxShadow: "var(--shadow-sm)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--star)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>⏳ 待点赞 / 审核任务</span>
                  <span style={{
                    background: "var(--star)",
                    color: "#FFFFFF",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: "999px"
                  }}>{submittedTasks.length}</span>
                </h4>
                <span style={{ fontSize: "0.75rem", color: "var(--star)", fontWeight: 600 }}>孩子已完成，等待家长点赞</span>
              </div>
              {submittedTasks.map(t => (
                <div key={t.id} style={{
                  background: "var(--card)",
                  borderRadius: "10px",
                  border: "1px solid var(--star-border)",
                  padding: "0.65rem 0.85rem",
                  marginBottom: "0.4rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 650, fontSize: "0.95rem", color: "var(--text)" }}>{t.title}</p>
                    <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem", flexWrap: "wrap" }}>
                      {t.expected_minutes && <span>{t.expected_minutes}分钟</span>}
                      <span style={{ color: "var(--star)", fontWeight: 700 }}>⭐+{t.reward_stars}</span>
                      {t.submitted_at && <span>提交于 {new Date(t.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", marginLeft: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => handleApproveSubmitted(t.id)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "8px",
                        background: "var(--accent)",
                        color: "#FFFFFF",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "none",
                        boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)"
                      }}
                    >
                      👍 通过
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectSubmitted(t.id)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "8px",
                        background: "#F0ECE4",
                        border: "1px solid var(--border)",
                        color: "var(--danger)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ❌ 驳回
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingTasks.map(t => (
            <div key={t.id} style={{ ...s.tc, opacity: t.status === "completed" ? 0.6 : 1 }}>
              {editingTask === t.id ? (
                <div>
                  <input placeholder="任务名 *" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={s.fi} autoFocus />
                  <div style={{ display: "flex", gap: "0.4rem" }}><DurationInput value={editForm.minutes} onChange={value => setEditForm({ ...editForm, minutes: value })} /><RewardSelect value={editForm.stars} onChange={value => setEditForm({ ...editForm, stars: value })} /></div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.4rem" }}>
                    <input type="time" value={editForm.start} onChange={e => { const st = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, st, f.end), start: st })); }} className="ios-time-input" style={{ flex: 1, marginBottom: 0 }} />
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>至</span>
                    <input type="time" value={editForm.end} onChange={e => { const en = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, f.start, en), end: en })); }} className="ios-time-input" style={{ flex: 1, marginBottom: 0 }} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.4rem", cursor: "pointer" }}>
                    <span>需家长确认（打卡后发星）</span>
                    <div
                      className={`ios-switch ${editForm.require_approval ? "on" : ""}`}
                      onClick={() => setEditForm(f => ({ ...f, require_approval: !f.require_approval }))}
                      style={{ transform: "scale(0.75)", transformOrigin: "right center" }}
                    >
                      <div className="ios-switch-thumb" />
                    </div>
                  </label>
                  <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleSaveEdit} style={s.fsb}>保存</button><button onClick={() => setEditingTask(null)} style={s.fcb}>取消</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 650, fontSize: "0.95rem", color: "var(--text)" }}>
                      {t.created_by === "child" && !t.approved && <span style={{ fontSize: "0.7rem", color: "var(--danger)", marginRight: "0.3rem", fontWeight: 700 }}>待认可</span>}
                      {t.title}
                      {t.require_approval && (
                        <span style={{ marginLeft: "0.4rem", padding: "0.1rem 0.45rem", borderRadius: "var(--radius-pill)", background: "var(--star-bg)", color: "var(--star)", border: "1px solid var(--star-border)", fontSize: "0.7rem", fontWeight: 700 }}>
                          需确认
                        </span>
                      )}
                    </p>
                    <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {t.expected_minutes && <span>{t.expected_minutes}分钟</span>}
                      <span>{scheduleLabel(t)}</span>
                      {t.created_by === "child" && <span style={{ color: "var(--accent)", fontWeight: 600 }}>{child.name}创建</span>}
                      <span style={{ color: t.status === "completed" ? "var(--accent)" : "var(--muted)" }}>{t.status === "completed" ? "已完成" : "待完成"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.3rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--star)", fontWeight: 700, whiteSpace: "nowrap" }}>⭐{t.reward_stars}</span>
                    {t.created_by === "child" && !t.approved && <><button onClick={() => startEditTask(t)} style={s.ib}>✎</button><button onClick={() => handleApprove(t.id)} style={{ ...s.ib, color: "var(--accent)", fontWeight: 700, fontSize: "0.8rem", width: "1.6rem" }}>✓</button></>}
                    {t.status !== "completed" && (t.created_by === "parent" || t.approved) && <><button onClick={() => startEditTask(t)} style={s.ib}>✎</button><button onClick={() => handleDeleteTask(t.id)} style={s.ib}>✕</button></>}
                    {t.created_by === "child" && !t.approved && <button onClick={() => handleDeleteTask(t.id)} style={s.ib}>✕</button>}
                  </div>
                </div>
              )}
            </div>
          ))}

          {completedTasks.length > 0 && (
            <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
              <button onClick={() => setShowCompleted(c => !c)} style={{ width: '100%', textAlign: 'left', padding: '0.3rem 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 650, color: 'var(--muted)' }}>
                {showCompleted ? '▼' : '▶'} 已完成 {completedTasks.length} 项
              </button>
              {showCompleted && completedTasks.map(t => (
            <div key={t.id} style={{ ...s.tc, opacity: t.status === "completed" ? 0.6 : 1 }}>
              {editingTask === t.id ? (
                <div>
                  <input placeholder="任务名 *" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={s.fi} autoFocus />
                  <div style={{ display: "flex", gap: "0.4rem" }}><DurationInput value={editForm.minutes} onChange={value => setEditForm({ ...editForm, minutes: value })} /><RewardSelect value={editForm.stars} onChange={value => setEditForm({ ...editForm, stars: value })} /></div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.4rem" }}>
                    <input type="time" value={editForm.start} onChange={e => { const st = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, st, f.end), start: st })); }} className="ios-time-input" style={{ flex: 1, marginBottom: 0 }} />
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>至</span>
                    <input type="time" value={editForm.end} onChange={e => { const en = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, f.start, en), end: en })); }} className="ios-time-input" style={{ flex: 1, marginBottom: 0 }} />
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleSaveEdit} style={s.fsb}>保存</button><button onClick={() => setEditingTask(null)} style={s.fcb}>取消</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 650, fontSize: "0.95rem", color: "var(--text)" }}>
                      {t.created_by === "child" && !t.approved && <span style={{ fontSize: "0.7rem", color: "var(--danger)", marginRight: "0.3rem", fontWeight: 700 }}>待认可</span>}
                      {t.title}
                    </p>
                    <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {t.expected_minutes && <span>{t.expected_minutes}分钟</span>}
                      <span>{scheduleLabel(t)}</span>
                      {t.created_by === "child" && <span style={{ color: "var(--accent)", fontWeight: 600 }}>{child.name}创建</span>}
                      <span style={{ color: t.status === "completed" ? "var(--accent)" : "var(--muted)" }}>{t.status === "completed" ? "已完成" : "待完成"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.3rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--star)", fontWeight: 700, whiteSpace: "nowrap" }}>⭐{t.reward_stars}</span>
                    <button
                      type="button"
                      onClick={() => handleRevokeTask(t.id)}
                      title="撤回任务"
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "6px",
                        background: "#F0ECE4",
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                        fontSize: "0.75rem",
                        fontWeight: 650,
                        cursor: "pointer",
                        marginLeft: "0.3rem",
                      }}
                    >
                      撤回
                    </button>
                  </div>
                </div>
              )}
            </div>
              ))}
            </div>
          )}
          {showAdd && <div style={{ marginTop: "0.8rem" }}>{!showAddTask ? <button onClick={() => setShowAddTask(true)} style={s.addBtn}>+ 添加当日任务</button> : (
            <div style={s.fb}>
              <input placeholder="任务名 *" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} style={s.fi} autoFocus />
              <div style={{ display: "flex", gap: "0.4rem" }}><DurationInput value={newTask.minutes} onChange={value => setNewTask({ ...newTask, minutes: value })} /><RewardSelect value={newTask.stars} onChange={value => setNewTask({ ...newTask, stars: value })} /></div>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.4rem" }}>
                <input type="time" value={newTask.start} onChange={e => { const s = e.target.value; setNewTask(f => ({ ...f, ...autoFillTime(f.minutes, s, f.end), start: s })); }} className="ios-time-input" style={{ flex: 1, marginBottom: 0 }} />
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>至</span>
                <input type="time" value={newTask.end} onChange={e => { const en = e.target.value; setNewTask(f => ({ ...f, ...autoFillTime(f.minutes, f.start, en), end: en })); }} className="ios-time-input" style={{ flex: 1, marginBottom: 0 }} />
              </div>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.4rem", cursor: "pointer" }}>
                <span>需家长确认（打卡后发星）</span>
                <div
                  className={`ios-switch ${newTask.require_approval ? "on" : ""}`}
                  onClick={() => setNewTask(f => ({ ...f, require_approval: !f.require_approval }))}
                  style={{ transform: "scale(0.75)", transformOrigin: "right center" }}
                >
                  <div className="ios-switch-thumb" />
                </div>
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleAddTask} style={s.fsb}>添加</button><button onClick={() => setShowAddTask(false)} style={s.fcb}>取消</button></div>
            </div>
          )}</div>}
        </div>

        <div style={{ ...s.panel, marginTop: "0.8rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.6rem" }}>重复任务</h3>
          {routineTasks.map(r => (
            <div key={r.id} style={s.rc}>
              {editingRoutine === r.id ? (
                <div>
                  <input placeholder="任务名 *" value={routineEditForm.title} onChange={e => setRoutineEditForm({ ...routineEditForm, title: e.target.value })} style={s.fi} autoFocus />
                  <div style={{ display: "flex", gap: "0.4rem" }}><DurationInput value={routineEditForm.minutes} onChange={value => setRoutineEditForm({ ...routineEditForm, minutes: value })} /><RewardSelect value={routineEditForm.stars} onChange={value => setRoutineEditForm({ ...routineEditForm, stars: value })} /></div>
                  <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.4rem" }}>{WEEKDAYS.map((lbl, idx) => { const d = idx === 0 ? 7 : idx; const a = routineEditForm.weekdays.includes(d); return <button type="button" key={lbl} onClick={() => { const wd = a ? routineEditForm.weekdays.filter(w => w !== d) : [...routineEditForm.weekdays, d].sort(); setRoutineEditForm({ ...routineEditForm, weekdays: wd }); }} style={{ width: "2rem", height: "2rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 650, background: a ? "var(--accent)" : "#F0ECE4", color: a ? "#FFFFFF" : "var(--muted)", border: a ? "none" : "1px solid var(--border)", cursor: "pointer" }}>{lbl}</button>; })}</div>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.4rem", cursor: "pointer" }}>
                    <span>需家长确认（打卡后发星）</span>
                    <div
                      className={`ios-switch ${routineEditForm.require_approval ? "on" : ""}`}
                      onClick={() => setRoutineEditForm(f => ({ ...f, require_approval: !f.require_approval }))}
                      style={{ transform: "scale(0.75)", transformOrigin: "right center" }}
                    >
                      <div className="ios-switch-thumb" />
                    </div>
                  </label>
                  <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleSaveRoutine} style={s.fsb}>保存</button><button onClick={() => setEditingRoutine(null)} style={s.fcb}>取消</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ flex: 1 }}><p style={{ fontWeight: 650, color: "var(--text)" }}>{r.title}</p><p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>每周 {formatWeekdays(r.weekdays)}{r.expected_minutes ? ` · ${r.expected_minutes}分钟` : ""}{r.require_approval ? " · 需家长确认" : ""}</p></div><div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.3rem" }}><span style={{ fontSize: "0.8rem", color: "var(--star)", fontWeight: 700, whiteSpace: "nowrap" }}>⭐{r.reward_stars}</span><button onClick={() => startEditRoutine(r)} style={s.ib}>✎</button><button onClick={() => handleDeleteRoutine(r.id)} style={s.ib}>✕</button></div></div>
              )}
            </div>
          ))}
          {!showAddRoutine ? <button onClick={() => setShowAddRoutine(true)} style={s.addBtn}>+ 添加重复任务</button> : (
            <div style={s.fb}>
              <input placeholder="任务名 *" value={routineForm.title} onChange={e => setRoutineForm({ ...routineForm, title: e.target.value })} style={s.fi} autoFocus />
              <div style={{ display: "flex", gap: "0.4rem" }}><DurationInput value={routineForm.minutes} onChange={value => setRoutineForm({ ...routineForm, minutes: value })} /><RewardSelect value={routineForm.stars} onChange={value => setRoutineForm({ ...routineForm, stars: value })} /></div>
              <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.4rem" }}>{WEEKDAYS.map((lbl, idx) => { const d = idx === 0 ? 7 : idx; const a = routineForm.weekdays.includes(d); return <button type="button" key={lbl} onClick={() => { const wd = a ? routineForm.weekdays.filter(w => w !== d) : [...routineForm.weekdays, d].sort(); setRoutineForm({ ...routineForm, weekdays: wd }); }} style={{ width: "2rem", height: "2rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 650, background: a ? "var(--accent)" : "#F0ECE4", color: a ? "#FFFFFF" : "var(--muted)", border: a ? "none" : "1px solid var(--border)", cursor: "pointer" }}>{lbl}</button>; })}</div>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.4rem", cursor: "pointer" }}>
                <span>需家长确认（打卡后发星）</span>
                <div
                  className={`ios-switch ${routineForm.require_approval ? "on" : ""}`}
                  onClick={() => setRoutineForm(f => ({ ...f, require_approval: !f.require_approval }))}
                  style={{ transform: "scale(0.75)", transformOrigin: "right center" }}
                >
                  <div className="ios-switch-thumb" />
                </div>
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleAddRoutine} disabled={savingRoutine} style={s.fsb}>{savingRoutine ? "保存…" : "保存"}</button><button onClick={() => setShowAddRoutine(false)} style={s.fcb}>取消</button></div>
            </div>
          )}
        </div>

        <div style={{ ...s.panel, marginTop: "0.8rem" }}><h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.6rem" }}>访问码</h3>{accessCode ? <p style={{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "0.3em", color: "var(--accent)", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{accessCode}</p> : <button onClick={generateCode} style={s.btn}>生成访问码</button>}{accessCode && <button onClick={generateCode} style={{ ...s.addBtn, marginTop: "0.4rem" }}>重新生成</button>}<p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.4rem", textAlign: "center" }}>在 iPad 上打开孩子端，输入此码绑定</p></div>
      </>)}
      {shareSnapshot && <TaskShareDialog snapshot={shareSnapshot} onClose={() => setShareSnapshot(null)} />}
    </fieldset>
  );
}

function DurationInput({ value, onChange }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>预计时长</span>
      <span style={{ ...s.fi, display: "flex", alignItems: "center", gap: "0.3rem" }}>
        <input type="number" placeholder="分钟 *" value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", minWidth: 0, border: "none", outline: "none", background: "transparent" }} />
        <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>分钟</span>
      </span>
    </label>
  );
}

function RewardSelect({ value, onChange }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>奖励星星</span>
      <div className="ios-segmented-control" style={{ display: "flex", width: "100%" }}>
        {[0, 1, 2, 3, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`ios-segmented-item ${value === n ? "active" : ""}`}
            style={{ padding: "4px 6px", fontSize: "0.78rem" }}
          >
            {n === 0 ? "0星" : `⭐${n}`}
          </button>
        ))}
      </div>
    </label>
  );
}

const s = {
  field: { flex: 1, minWidth: 0 },
  fieldLabel: { display: "block", fontSize: "0.75rem", fontWeight: 650, color: "var(--muted)", marginBottom: "0.25rem" },
  link: { color: "var(--accent)", fontSize: "0.95rem", fontWeight: 650, background: "none", border: "none", cursor: "pointer" },
  arr: { width: "2rem", height: "2rem", borderRadius: "50%", background: "var(--card)", border: "1px solid var(--border)", fontSize: "1rem", fontWeight: 600, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  dtLabel: { flex: 1, background: "var(--card)", borderRadius: "10px", border: "1px solid var(--border)", cursor: "pointer" },
  panel: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", boxShadow: "var(--shadow-card)" },
  tc: { background: "var(--card-subtle)", border: "1px solid var(--border)", borderRadius: "12px", padding: "0.65rem 0.85rem", marginBottom: "0.45rem" },
  rc: { background: "var(--card-subtle)", border: "1px solid var(--border)", borderRadius: "12px", padding: "0.65rem 0.85rem", marginBottom: "0.45rem" },
  btn: { width: "100%", padding: "0.65rem", fontSize: "0.95rem", fontWeight: 650, color: "#FFFFFF", background: "var(--accent)", borderRadius: "12px", border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)" },
  addBtn: { width: "100%", padding: "0.55rem", fontSize: "0.9rem", fontWeight: 650, color: "var(--accent)", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--card-subtle)", cursor: "pointer" },
  fb: { background: "var(--card-subtle)", border: "1px solid var(--border)", borderRadius: "12px", padding: "0.75rem" },
  fi: { padding: "0.45rem 0.6rem", fontSize: "0.85rem", border: "1px solid var(--border)", borderRadius: "8px", outline: "none", marginBottom: "0.4rem", display: "block", width: "100%", background: "var(--card)", color: "var(--text)", fontVariantNumeric: "tabular-nums" },
  fsb: { flex: 1, padding: "0.45rem", fontSize: "0.85rem", fontWeight: 650, color: "#FFFFFF", background: "var(--accent)", borderRadius: "8px", border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)" },
  fcb: { flex: 1, padding: "0.45rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", background: "#F0ECE4", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer" },
  ib: { width: "1.6rem", height: "1.6rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
};
