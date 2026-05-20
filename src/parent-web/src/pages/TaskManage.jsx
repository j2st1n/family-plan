import { useState, useEffect, useCallback } from "react";
import api from "../api.js";

function parseLocal(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDate(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${dd}`; }
function addDays(s, n) { const r = parseLocal(s); r.setDate(r.getDate() + n); return fmtDate(r); }
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function pad(n) { return String(n).padStart(2, "0"); }
function timeToMinutes(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; }
function autoFillTime(minutes, start, end) { const dur = parseInt(minutes) || 0; if (!dur) return { start, end }; if (start && !end) return { start, end: minutesToTime(timeToMinutes(start) + dur) }; if (end && !start) return { start: minutesToTime(timeToMinutes(end) - dur), end }; return { start, end }; }

export default function TaskManage({ token, child, onBack }) {
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
  const [newTask, setNewTask] = useState({ title: "", minutes: "", stars: 1, start: "", end: "" });
  const [routineForm, setRoutineForm] = useState({ title: "", minutes: "", stars: 1, weekdays: [1, 2, 3, 4, 5] });
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", minutes: "", stars: 1, start: "", end: "" });
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [routineEditForm, setRoutineEditForm] = useState({ title: "", minutes: "", stars: 1, weekdays: [] });
  const [showCompleted, setShowCompleted] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!plan) return; setLoading(true);
    try { const data = await api.fetchDailyTasks(token, plan.id, date); setTasks(data.tasks || []); setRewards(data.rewards || { stars_total: 0, current_streak_days: 0 }); }
    catch { setTasks([]); setRewards({ stars_total: 0, current_streak_days: 0 }); }
    finally { setLoading(false); }
  }, [token, plan, date]);

  const loadRoutines = useCallback(async () => {
    if (!plan?.id) return;
    try { const p = await api.getPlan(token, plan.id); setRoutineTasks((p.tasks || []).filter(t => t.status === "active")); } catch {}
  }, [token, plan?.id]);

  useEffect(() => { api.fetchPlans(token, child.id).then(list => { if (list.length > 0) { const p = list[0]; setPlan(p); setRoutineTasks((p.tasks || []).filter(t => t.status === "active")); } }); }, [token, child.id]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function createDefaultPlan() { const t = fmtDate(new Date()); const p = await api.createPlan(token, { child_id: child.id, title: `${child.name}的计划`, start_date: t }); setPlan(p); setRoutineTasks([]); }

  async function handleAddTask() {
    if (!newTask.title.trim()) return; if (!newTask.minutes || parseInt(newTask.minutes) < 1) return;
    const filled = autoFillTime(newTask.minutes, newTask.start, newTask.end);
    await api.createManualTasks(token, plan.id, date, [{ title: newTask.title.trim(), expected_minutes: parseInt(newTask.minutes), reward_stars: newTask.stars, scheduled_start: filled.start || null, scheduled_end: filled.end || null }]);
    setNewTask({ title: "", minutes: "", stars: 1, start: "", end: "" }); setShowAddTask(false); loadTasks();
  }

  async function handleSaveEdit() {
    if (!editingTask || !editForm.title.trim() || !plan) return; if (!editForm.minutes || parseInt(editForm.minutes) < 1) return;
    const filled = autoFillTime(editForm.minutes, editForm.start, editForm.end);
    await api.updateDailyTask(token, plan.id, editingTask, { title: editForm.title.trim(), expected_minutes: parseInt(editForm.minutes), reward_stars: editForm.stars, scheduled_start: filled.start || null, scheduled_end: filled.end || null, approved: editForm.approved === false ? true : editForm.approved });
    setEditingTask(null); loadTasks();
  }

  async function handleDeleteTask(taskId) { if (!plan || !window.confirm("删除这个任务？")) return; await api.deleteDailyTask(token, plan.id, taskId); loadTasks(); }

  function startEditTask(t) { if (t.status === "completed") return; setEditingTask(t.id); setEditForm({ title: t.title, minutes: t.expected_minutes?.toString() || "", stars: t.reward_stars, start: t.scheduled_start || "", end: t.scheduled_end || "", approved: t.approved }); }

  async function handleApprove(taskId) { await api.updateDailyTask(token, plan.id, taskId, { title: tasks.find(t => t.id === taskId).title, expected_minutes: tasks.find(t => t.id === taskId).expected_minutes, reward_stars: tasks.find(t => t.id === taskId).reward_stars, approved: true }); loadTasks(); }

  async function handleAddRoutine() {
    if (!routineForm.title.trim() || !plan) return; if (!routineForm.minutes || parseInt(routineForm.minutes) < 1) return;
    setSavingRoutine(true);
    await api.addRoutineTask(token, plan.id, { title: routineForm.title.trim(), expected_minutes: parseInt(routineForm.minutes), weekdays: routineForm.weekdays, reward_stars: routineForm.stars });
    setRoutineForm({ title: "", minutes: "", stars: 1, weekdays: [1, 2, 3, 4, 5] }); setShowAddRoutine(false); setSavingRoutine(false); loadRoutines(); loadTasks();
  }

  function startEditRoutine(r) { setEditingRoutine(r.id); setRoutineEditForm({ title: r.title, minutes: r.expected_minutes?.toString() || "", stars: r.reward_stars, weekdays: [...(r.weekdays || [])] }); }
  async function handleSaveRoutine() { if (!editingRoutine || !routineEditForm.title.trim() || !plan) return; await api.updateRoutineTask(token, plan.id, editingRoutine, { title: routineEditForm.title.trim(), expected_minutes: routineEditForm.minutes ? parseInt(routineEditForm.minutes) : null, weekdays: routineEditForm.weekdays, reward_stars: routineEditForm.stars }); setEditingRoutine(null); loadRoutines(); loadTasks(); }
  async function handleDeleteRoutine(tid) { if (!plan || !window.confirm("删除这条重复任务？")) return; await api.deleteRoutineTask(token, plan.id, tid); loadRoutines(); loadTasks(); }

  async function generateCode() { const r = await api.getAccessCode(token, child.id); setAccessCode(r.code); }

  function scheduleLabel(t) { if (t.scheduled_start) { const who = t.schedule_by === "child" ? `${child.name}安排` : ""; return `${who} ${t.scheduled_start}—${t.scheduled_end}`.trim(); } return "自由安排"; }

  const selectedDate = parseLocal(date); const today = new Date(); const todayStr = fmtDate(today);
  const showAdd = date >= todayStr; const isToday = date === todayStr;
  const dateLabel = `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 周${WEEKDAYS[selectedDate.getDay()]}`;
  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const completedCount = completedTasks.length;
  const totalStars = tasks.reduce((s, t) => s + (t.reward_stars || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}><button onClick={onBack} style={s.link}>← 首页</button></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}><h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>{child.name}</h2><div style={{ fontSize: "0.9rem", color: "#666" }}>⭐{rewards.stars_total} 🔥{rewards.current_streak_days}</div></div>
      {!plan && <div style={{ textAlign: "center", paddingTop: "2rem" }}><p style={{ color: "#8c8985", marginBottom: "1rem" }}>请先创建计划</p><button onClick={createDefaultPlan} style={s.btn}>创建计划</button></div>}
      {plan && (<>
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1.2rem", alignItems: "center" }}><button onClick={() => setDate(addDays(date, -1))} style={s.arr}>←</button><label style={s.dtLabel}><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "0.4rem", fontSize: "0.85rem", border: "none", background: "transparent", textAlign: "center", cursor: "pointer", color: "inherit", fontFamily: "inherit", fontWeight: 600 }} /></label><button onClick={() => setDate(addDays(date, 1))} style={s.arr}>→</button></div>
        {!isToday && <div style={{ textAlign: "center", marginTop: "-0.6rem", marginBottom: "0.4rem" }}><button onClick={() => setDate(todayStr)} style={{ color: "#7c6f97", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer" }}>回到今天</button></div>}

        <div style={s.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}><h3 style={{ fontSize: "1rem", fontWeight: 700 }}>当日任务</h3><span style={{ fontSize: "0.8rem", color: "#8c8985" }}>{tasks.length}项 · {completedCount}完成 · {totalStars}⭐</span></div>
          {loading && <p style={{ color: "#8c8985", textAlign: "center" }}>加载中…</p>}
          {!loading && tasks.length === 0 && <p style={{ color: "#8c8985", textAlign: "center", padding: "0.8rem 0" }}>当天暂无任务</p>}
          {pendingTasks.map(t => (
            <div key={t.id} style={{ ...s.tc, opacity: t.status === "completed" ? 0.6 : 1 }}>
              {editingTask === t.id ? (
                <div>
                  <input placeholder="任务名 *" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={s.fi} autoFocus />
                  <div style={{ display: "flex", gap: "0.4rem" }}><input type="number" placeholder="分钟 *" value={editForm.minutes} onChange={e => setEditForm({ ...editForm, minutes: e.target.value })} style={{ ...s.fi, flex: 1 }} /><select value={editForm.stars} onChange={e => setEditForm({ ...editForm, stars: parseInt(e.target.value) })} style={{ ...s.fi, flex: 1 }}><option value={0}>0⭐</option><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
                  <div style={{ display: "flex", gap: "0.4rem" }}><input type="time" value={editForm.start} onChange={e => { const st = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, st, f.end), start: st })); }} style={{ ...s.fi, flex: 1 }} /><input type="time" value={editForm.end} onChange={e => { const en = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, f.start, en), end: en })); }} style={{ ...s.fi, flex: 1 }} /></div>
                  <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleSaveEdit} style={s.fsb}>保存</button><button onClick={() => setEditingTask(null)} style={s.fcb}>取消</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {t.created_by === "child" && !t.approved && <span style={{ fontSize: "0.7rem", color: "#c97070", marginRight: "0.3rem" }}>待认可</span>}
                      {t.title}
                    </p>
                    <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.75rem", color: "#8c8985", marginTop: "0.1rem" }}>
                      {t.expected_minutes && <span>{t.expected_minutes}分钟</span>}
                      <span>{scheduleLabel(t)}</span>
                      {t.created_by === "child" && <span style={{ color: "#7c6f97" }}>{child.name}创建</span>}
                      <span style={{ color: t.status === "completed" ? "#6b8f71" : "#8c8985" }}>{t.status === "completed" ? "已完成" : "待完成"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.3rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", color: "#d4a853", whiteSpace: "nowrap" }}>⭐{t.reward_stars}</span>
                    {t.created_by === "child" && !t.approved && <><button onClick={() => startEditTask(t)} style={s.ib}>✎</button><button onClick={() => handleApprove(t.id)} style={{ ...s.ib, color: "#6b8f71", fontWeight: 700, fontSize: "0.8rem", width: "1.6rem" }}>✓</button></>}
                    {t.status !== "completed" && (t.created_by === "parent" || t.approved) && <><button onClick={() => startEditTask(t)} style={s.ib}>✎</button><button onClick={() => handleDeleteTask(t.id)} style={s.ib}>✕</button></>}
                    {t.created_by === "child" && !t.approved && <button onClick={() => handleDeleteTask(t.id)} style={s.ib}>✕</button>}
                  </div>
                </div>
              )}
            </div>
          ))}

          {completedTasks.length > 0 && (
            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #e8e4df', paddingTop: '0.4rem' }}>
              <button onClick={() => setShowCompleted(c => !c)} style={{ width: '100%', textAlign: 'left', padding: '0.3rem 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#8c8985' }}>
                {showCompleted ? '▼' : '▶'} 已完成 {completedTasks.length} 项
              </button>
              {showCompleted && completedTasks.map(t => (
            <div key={t.id} style={{ ...s.tc, opacity: t.status === "completed" ? 0.6 : 1 }}>
              {editingTask === t.id ? (
                <div>
                  <input placeholder="任务名 *" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={s.fi} autoFocus />
                  <div style={{ display: "flex", gap: "0.4rem" }}><input type="number" placeholder="分钟 *" value={editForm.minutes} onChange={e => setEditForm({ ...editForm, minutes: e.target.value })} style={{ ...s.fi, flex: 1 }} /><select value={editForm.stars} onChange={e => setEditForm({ ...editForm, stars: parseInt(e.target.value) })} style={{ ...s.fi, flex: 1 }}><option value={0}>0⭐</option><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
                  <div style={{ display: "flex", gap: "0.4rem" }}><input type="time" value={editForm.start} onChange={e => { const st = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, st, f.end), start: st })); }} style={{ ...s.fi, flex: 1 }} /><input type="time" value={editForm.end} onChange={e => { const en = e.target.value; setEditForm(f => ({ ...f, ...autoFillTime(f.minutes, f.start, en), end: en })); }} style={{ ...s.fi, flex: 1 }} /></div>
                  <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleSaveEdit} style={s.fsb}>保存</button><button onClick={() => setEditingTask(null)} style={s.fcb}>取消</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {t.created_by === "child" && !t.approved && <span style={{ fontSize: "0.7rem", color: "#c97070", marginRight: "0.3rem" }}>待认可</span>}
                      {t.title}
                    </p>
                    <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.75rem", color: "#8c8985", marginTop: "0.1rem" }}>
                      {t.expected_minutes && <span>{t.expected_minutes}分钟</span>}
                      <span>{scheduleLabel(t)}</span>
                      {t.created_by === "child" && <span style={{ color: "#7c6f97" }}>{child.name}创建</span>}
                      <span style={{ color: t.status === "completed" ? "#6b8f71" : "#8c8985" }}>{t.status === "completed" ? "已完成" : "待完成"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.3rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", color: "#d4a853", whiteSpace: "nowrap" }}>⭐{t.reward_stars}</span>
                    {t.created_by === "child" && !t.approved && <><button onClick={() => startEditTask(t)} style={s.ib}>✎</button><button onClick={() => handleApprove(t.id)} style={{ ...s.ib, color: "#6b8f71", fontWeight: 700, fontSize: "0.8rem", width: "1.6rem" }}>✓</button></>}
                    {t.status !== "completed" && (t.created_by === "parent" || t.approved) && <><button onClick={() => startEditTask(t)} style={s.ib}>✎</button><button onClick={() => handleDeleteTask(t.id)} style={s.ib}>✕</button></>}
                    {t.created_by === "child" && !t.approved && <button onClick={() => handleDeleteTask(t.id)} style={s.ib}>✕</button>}
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
              <div style={{ display: "flex", gap: "0.4rem" }}><input type="number" placeholder="分钟 *" value={newTask.minutes} onChange={e => setNewTask({ ...newTask, minutes: e.target.value })} style={{ ...s.fi, flex: 1 }} /><select value={newTask.stars} onChange={e => setNewTask({ ...newTask, stars: parseInt(e.target.value) })} style={{ ...s.fi, flex: 1 }}><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
              <div style={{ display: "flex", gap: "0.4rem" }}><input type="time" value={newTask.start} onChange={e => { const s = e.target.value; setNewTask(f => ({ ...f, ...autoFillTime(f.minutes, s, f.end), start: s })); }} style={{ ...s.fi, flex: 1 }} /><input type="time" value={newTask.end} onChange={e => { const en = e.target.value; setNewTask(f => ({ ...f, ...autoFillTime(f.minutes, f.start, en), end: en })); }} style={{ ...s.fi, flex: 1 }} /></div>
              <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleAddTask} style={s.fsb}>添加</button><button onClick={() => setShowAddTask(false)} style={s.fcb}>取消</button></div>
            </div>
          )}</div>}
        </div>

        <div style={{ ...s.panel, marginTop: "0.8rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.6rem" }}>重复任务</h3>
          {routineTasks.map(r => (
            <div key={r.id} style={s.rc}>
              {editingRoutine === r.id ? (
                <div>
                  <input placeholder="任务名 *" value={routineEditForm.title} onChange={e => setRoutineEditForm({ ...routineEditForm, title: e.target.value })} style={s.fi} autoFocus />
                  <div style={{ display: "flex", gap: "0.4rem" }}><input type="number" placeholder="分钟 *" value={routineEditForm.minutes} onChange={e => setRoutineEditForm({ ...routineEditForm, minutes: e.target.value })} style={{ ...s.fi, flex: 1 }} /><select value={routineEditForm.stars} onChange={e => setRoutineEditForm({ ...routineEditForm, stars: parseInt(e.target.value) })} style={{ ...s.fi, flex: 1 }}><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
                  <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.4rem" }}>{WEEKDAYS.map((lbl, idx) => { const d = idx === 0 ? 7 : idx; const a = routineEditForm.weekdays.includes(d); return <button type="button" key={lbl} onClick={() => { const wd = a ? routineEditForm.weekdays.filter(w => w !== d) : [...routineEditForm.weekdays, d].sort(); setRoutineEditForm({ ...routineEditForm, weekdays: wd }); }} style={{ width: "2rem", height: "2rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 600, background: a ? "#7c6f97" : "#efece8", color: a ? "#fff" : "#8c8985", border: "none", cursor: "pointer" }}>{lbl}</button>; })}</div>
                  <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleSaveRoutine} style={s.fsb}>保存</button><button onClick={() => setEditingRoutine(null)} style={s.fcb}>取消</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ flex: 1 }}><p style={{ fontWeight: 600 }}>{r.title}</p><p style={{ fontSize: "0.8rem", color: "#8c8985" }}>每周 {r.weekdays?.map(d => WEEKDAYS[d]).join("、")}{r.expected_minutes ? ` · ${r.expected_minutes}分钟` : ""}</p></div><div style={{ display: "flex", gap: "0.2rem", marginLeft: "0.3rem" }}><span style={{ fontSize: "0.8rem", color: "#d4a853", whiteSpace: "nowrap" }}>⭐{r.reward_stars}</span><button onClick={() => startEditRoutine(r)} style={s.ib}>✎</button><button onClick={() => handleDeleteRoutine(r.id)} style={s.ib}>✕</button></div></div>
              )}
            </div>
          ))}
          {!showAddRoutine ? <button onClick={() => setShowAddRoutine(true)} style={s.addBtn}>+ 添加重复任务</button> : (
            <div style={s.fb}>
              <input placeholder="任务名 *" value={routineForm.title} onChange={e => setRoutineForm({ ...routineForm, title: e.target.value })} style={s.fi} autoFocus />
              <div style={{ display: "flex", gap: "0.4rem" }}><input type="number" placeholder="分钟 *" value={routineForm.minutes} onChange={e => setRoutineForm({ ...routineForm, minutes: e.target.value })} style={{ ...s.fi, flex: 1 }} /><select value={routineForm.stars} onChange={e => setRoutineForm({ ...routineForm, stars: parseInt(e.target.value) })} style={{ ...s.fi, flex: 1 }}><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
              <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.4rem" }}>{WEEKDAYS.map((lbl, idx) => { const d = idx === 0 ? 7 : idx; const a = routineForm.weekdays.includes(d); return <button type="button" key={lbl} onClick={() => { const wd = a ? routineForm.weekdays.filter(w => w !== d) : [...routineForm.weekdays, d].sort(); setRoutineForm({ ...routineForm, weekdays: wd }); }} style={{ width: "2rem", height: "2rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 600, background: a ? "#7c6f97" : "#efece8", color: a ? "#fff" : "#8c8985", border: "none", cursor: "pointer" }}>{lbl}</button>; })}</div>
              <div style={{ display: "flex", gap: "0.4rem" }}><button onClick={handleAddRoutine} disabled={savingRoutine} style={s.fsb}>{savingRoutine ? "保存…" : "保存"}</button><button onClick={() => setShowAddRoutine(false)} style={s.fcb}>取消</button></div>
            </div>
          )}
        </div>

        <div style={{ ...s.panel, marginTop: "0.8rem" }}><h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.6rem" }}>访问码</h3>{accessCode ? <p style={{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "0.3em", color: "#7c6f97", textAlign: "center" }}>{accessCode}</p> : <button onClick={generateCode} style={s.btn}>生成访问码</button>}{accessCode && <button onClick={generateCode} style={{ ...s.addBtn, marginTop: "0.4rem" }}>重新生成</button>}<p style={{ fontSize: "0.75rem", color: "#8c8985", marginTop: "0.4rem", textAlign: "center" }}>在 iPad 上打开孩子端，输入此码绑定</p></div>

        <ShopPanel token={token} plan={plan} child={child} />
      </>)}
    </div>
  );
}

function ShopPanel({ token, plan, child }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", desc: "", stars: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", desc: "", stars: "" });
  const [approveStars, setApproveStars] = useState({});

  const load = useCallback(async () => {
    try { const list = await api.fetchShop(token); setItems(list); } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.title.trim() || !form.stars || parseInt(form.stars) < 1) return;
    await api.createShopItem(token, { title: form.title.trim(), description: form.desc.trim() || null, star_cost: parseInt(form.stars) });
    setForm({ title: "", desc: "", stars: "" }); setShowAdd(false); load();
  }

  function startEdit(item) { setEditingId(item.id); setEditForm({ title: item.title, desc: item.description || "", stars: item.star_cost.toString() }); }
  async function saveEdit() {
    if (!editForm.title.trim() || !editForm.stars || parseInt(editForm.stars) < 1) return;
    await api.updateShopItem(token, editingId, { title: editForm.title.trim(), description: editForm.desc.trim() || null, star_cost: parseInt(editForm.stars) });
    setEditingId(null); load();
  }

  async function handleDelete(id) { if (!window.confirm("下架此商品？")) return; await api.deleteShopItem(token, id); load(); }

  async function handleApprove(id) {
    const stars = approveStars[id] || 10;
    await api.approveWish(token, id, parseInt(stars));
    setApproveStars(p => { const n = { ...p }; delete n[id]; return n; }); load();
  }

  const wishes = items.filter(i => i.status === "pending");
  const active = items.filter(i => i.status === "active");

  return (
    <div style={{ ...s.panel, marginTop: "0.8rem" }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.6rem" }}>星星商城</h3>

      {wishes.length > 0 && <div style={{ marginBottom: "0.8rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#c97070", marginBottom: "0.3rem" }}>许愿审核</p>
        {wishes.map(w => (
          <div key={w.id} style={s.shopRow}>
            <div style={{ flex: 1 }}><p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{w.title}</p><p style={{ fontSize: "0.75rem", color: "#8c8985" }}>{w.child_id ? `${child.name}许愿` : ""}</p></div>
            <input type="number" placeholder="星星" value={approveStars[w.id] || ""} onChange={e => setApproveStars({ ...approveStars, [w.id]: e.target.value })} style={{ width: "3.5rem", padding: "0.2rem", fontSize: "0.85rem", border: "1px solid #e8e4df", borderRadius: "6px", textAlign: "center" }} />
            <button onClick={() => handleApprove(w.id)} style={s.shopAct}>✓</button>
            <button onClick={() => handleDelete(w.id)} style={s.shopDel}>✕</button>
          </div>
        ))}
      </div>}

      {active.map(item => (
        <div key={item.id} style={s.shopRow}>
          {editingId === item.id ? (
            <div style={{ flex: 1 }}>
              <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="名称" style={s.shopEdit} autoFocus />
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <input value={editForm.desc} onChange={e => setEditForm({ ...editForm, desc: e.target.value })} placeholder="说明" style={{ ...s.shopEdit, flex: 1 }} />
                <input type="number" value={editForm.stars} onChange={e => setEditForm({ ...editForm, stars: e.target.value })} placeholder="⭐" style={{ ...s.shopEdit, width: "3.5rem" }} />
              </div>
              <button onClick={saveEdit} style={s.shopAct}>保存</button><button onClick={() => setEditingId(null)} style={s.shopDel}>取消</button>
            </div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.title}</p>
                {item.description && <p style={{ fontSize: "0.75rem", color: "#8c8985" }}>{item.description}</p>}
              </div>
              <span style={{ fontSize: "0.8rem", color: "#d4a853", whiteSpace: "nowrap" }}>⭐{item.star_cost}</span>
              <button onClick={() => startEdit(item)} style={s.shopAct}>✎</button>
              <button onClick={() => handleDelete(item.id)} style={s.shopDel}>✕</button>
            </>
          )}
        </div>
      ))}

      <div style={{ marginTop: "0.5rem" }}>
        {!showAdd ? <button onClick={() => setShowAdd(true)} style={s.addBtn}>+ 上架商品</button> : (
          <div style={{ background: "#f8f8fb", borderRadius: "10px", padding: "0.5rem" }}>
            <input placeholder="名称" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={s.shopEdit} autoFocus />
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <input placeholder="说明" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} style={{ ...s.shopEdit, flex: 1 }} />
              <input type="number" placeholder="⭐" value={form.stars} onChange={e => setForm({ ...form, stars: e.target.value })} style={{ ...s.shopEdit, width: "3.5rem" }} />
            </div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={handleAdd} style={s.shopAct}>添加</button>
              <button onClick={() => setShowAdd(false)} style={s.shopDel}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  link: { color: "#7c6f97", fontSize: "0.95rem", background: "none", border: "none", cursor: "pointer" }, arr: { width: "2rem", height: "2rem", borderRadius: "50%", background: "#fff", border: "1px solid #e8e4df", fontSize: "1rem", fontWeight: 600, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  dtLabel: { flex: 1, background: "#fff", borderRadius: "10px", border: "1px solid #e8e4df", cursor: "pointer" },
  panel: { background: "#fff", borderRadius: "14px", padding: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }, tc: { background: "#f8f8fb", borderRadius: "10px", padding: "0.6rem 0.8rem", marginBottom: "0.4rem" }, rc: { background: "#f8f8fb", borderRadius: "10px", padding: "0.6rem 0.8rem", marginBottom: "0.4rem" },
  btn: { width: "100%", padding: "0.6rem", fontSize: "0.95rem", fontWeight: 600, color: "#fff", background: "#7c6f97", borderRadius: "10px" }, addBtn: { width: "100%", padding: "0.5rem", fontSize: "0.9rem", color: "#7c6f97", border: "1px dashed #7c6f97", borderRadius: "10px", background: "transparent" },
  fb: { background: "#f8f8fb", borderRadius: "10px", padding: "0.6rem" }, fi: { padding: "0.4rem 0.5rem", fontSize: "0.85rem", border: "1px solid #e8e4df", borderRadius: "8px", outline: "none", marginBottom: "0.4rem", display: "block", width: "100%", background: "#fff" },
  fsb: { flex: 1, padding: "0.45rem", fontSize: "0.85rem", fontWeight: 600, color: "#fff", background: "#7c6f97", borderRadius: "8px" }, fcb: { flex: 1, padding: "0.45rem", fontSize: "0.85rem", fontWeight: 600, color: "#8c8985", background: "#efece8", borderRadius: "8px" },
  ib: { width: "1.4rem", height: "1.4rem", borderRadius: "50%", fontSize: "0.7rem", fontWeight: 600, color: "#8c8985", background: "transparent", border: "none", cursor: "pointer" },
  shopRow: { display: "flex", alignItems: "center", gap: "0.4rem", background: "#f8f8fb", borderRadius: "10px", padding: "0.5rem 0.7rem", marginBottom: "0.3rem" },
  shopEdit: { padding: "0.3rem 0.4rem", fontSize: "0.85rem", border: "1px solid #e8e4df", borderRadius: "6px", outline: "none", background: "#fff", marginBottom: "0.3rem", display: "block", width: "100%" },
  shopAct: { padding: "0.25rem 0.4rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, color: "#fff", background: "#7c6f97" },
  shopDel: { padding: "0.25rem 0.4rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, color: "#c97070", background: "#fef0f0" },
};
