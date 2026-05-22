import { useState, useEffect, useCallback } from "react";
import { fetchToday, completeTask, createChildTask, scheduleChildTask, updateChildTask, deleteChildTask } from "../api.js";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function pad(n) { return String(n).padStart(2, "0"); }
function minutesToTime(m) { return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; }

export default function Today({ child, onExpired, active }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completingId, setCompletingId] = useState(null);
  const [justCompleted, setJustCompleted] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", minutes: "", stars: 1, start: "", end: "" });
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ start: "", end: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", minutes: "", stars: 1, start: "", end: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await fetchToday(); setData(result); }
    catch (err) { if (err.message === "token_expired") onExpired(); else setError("加载失败，请重试"); }
    finally { setLoading(false); }
  }, [onExpired]);

  useEffect(() => { if (active) load(); }, [load, active]);

  async function handleComplete(task) {
    setCompletingId(task.id);
    try {
      const result = await completeTask(task.id, "easy");
      setJustCompleted({ id: task.id, title: task.title, stars: result.stars_awarded });
      setTimeout(() => setJustCompleted(null), 2500); load();
    } catch { setError("操作失败"); } finally { setCompletingId(null); }
  }

  async function handleCreateTask() {
    if (!newForm.title.trim() || !newForm.minutes || parseInt(newForm.minutes) < 1) return;
    await createChildTask({ title: newForm.title.trim(), expected_minutes: parseInt(newForm.minutes), reward_stars: newForm.stars, scheduled_start: newForm.start || null, scheduled_end: newForm.end || null });
    setNewForm({ title: "", minutes: "", stars: 1, start: "", end: "" }); setShowAdd(false); load();
  }

  async function handleSchedule(taskId) {
    if (!scheduleForm.start || !scheduleForm.end) return;
    await scheduleChildTask(taskId, scheduleForm.start, scheduleForm.end);
    setSchedulingId(null); setScheduleForm({ start: "", end: "" }); load();
  }

  function startSchedule(task) { setSchedulingId(task.id); setScheduleForm({ start: task.scheduled_start || "", end: task.scheduled_end || "" }); }

  function startEdit(task) { setEditingId(task.id); setEditForm({ title: task.title, minutes: task.expected_minutes?.toString() || "", stars: task.reward_stars, start: task.scheduled_start || "", end: task.scheduled_end || "" }); }
  async function handleSaveEdit() { if (!editingId || !editForm.title.trim() || !editForm.minutes || parseInt(editForm.minutes) < 1) return; await updateChildTask(editingId, { title: editForm.title.trim(), expected_minutes: parseInt(editForm.minutes), reward_stars: editForm.stars, scheduled_start: editForm.start || null, scheduled_end: editForm.end || null }); setEditingId(null); load(); }
  async function handleDelete(taskId) { if (!window.confirm("删除这个任务？")) return; await deleteChildTask(taskId); load(); }

  function scheduleLabel(t) {
    if (t.scheduled_start) return `${t.scheduled_start}—${t.scheduled_end}`;
    return "自由安排";
  }

  const today = new Date();
  const dayLabel = DAY_NAMES[today.getDay()];
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 星期${dayLabel}`;

  const timed = (data?.tasks || []).filter(t => t.scheduled_start && t.status !== "completed");
  const free = (data?.tasks || []).filter(t => !t.scheduled_start && t.status !== "completed");
  const completed = (data?.tasks || []).filter(t => t.status === "completed");
  const [showCompleted, setShowCompleted] = useState(false);

  if (loading) return <div style={{ textAlign: "center", paddingTop: "40vh", color: "#73706b" }}>加载中…</div>;
  if (error) return <div style={{ textAlign: "center", paddingTop: "40vh" }}><p style={{ color: "#c97070", marginBottom: "1rem" }}>{error}</p><button onClick={load} style={{ color: "#3d9e6b", fontSize: "1rem" }}>重试</button></div>;

  return (
    <div>
      <div style={{ marginBottom: "1.4rem" }}><h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "#3d9e6b" }}>你好，{child?.name ?? "小朋友"}</h1><p style={{ color: "#73706b", marginTop: "0.3rem", fontSize: "0.95rem" }}>{dateStr}</p></div>
      <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1.4rem" }}>
        <div style={{ flex: 1, background: "#fff", borderRadius: "18px", padding: "1rem", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}><p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#c4912a" }}>⭐ {data?.rewards?.stars_total ?? 0}</p><p style={{ fontSize: "0.75rem", color: "#73706b" }}>星星</p></div>
        <div style={{ flex: 1, background: "#fff", borderRadius: "18px", padding: "1rem", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}><p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#3d9e6b" }}>🔥 {data?.rewards?.current_streak_days ?? 0}</p><p style={{ fontSize: "0.8rem", color: "#73706b" }}>连续天数</p></div>
      </div>

      {data?.tasks?.length === 0 && <p style={{ textAlign: "center", color: "#73706b", marginTop: "2rem" }}>今天没有任务</p>}

      {timed.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#73706b", marginBottom: "0.4rem" }}>已安排时间</p>
          {timed.map(task => <TaskCard key={task.id} task={task} child={child} completingId={completingId} schedulingId={schedulingId} scheduleForm={scheduleForm} setScheduleForm={setScheduleForm} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onComplete={handleComplete} onSchedule={startSchedule} onSaveSchedule={handleSchedule} onCancelSchedule={() => setSchedulingId(null)} onEdit={startEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)} onDelete={handleDelete} scheduleLabel={scheduleLabel} />)}
        </div>
      )}

      {free.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#73706b", marginBottom: "0.4rem" }}>自由安排</p>
      {free.map(task => <TaskCard key={task.id} task={task} child={child} completingId={completingId} schedulingId={schedulingId} scheduleForm={scheduleForm} setScheduleForm={setScheduleForm} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onComplete={handleComplete} onSchedule={startSchedule} onSaveSchedule={handleSchedule} onCancelSchedule={() => setSchedulingId(null)} onEdit={startEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)} onDelete={handleDelete} scheduleLabel={scheduleLabel} />)}
          </div>
        )}

        {completed.length > 0 && (
          <div style={{ borderTop: "1px solid #e8e4df", paddingTop: "0.5rem", marginBottom: "1rem" }}>
            <button onClick={() => setShowCompleted(c => !c)} style={{ width: "100%", textAlign: "left", padding: "0.3rem 0", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "#73706b" }}>
              {showCompleted ? "▼" : "▶"} 已完成 {completed.length} 项
            </button>
            {showCompleted && <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>{completed.map(task => <div key={task.id} style={{ flex: "1 1 280px", minWidth: 0 }}><TaskCard key={task.id} task={task} child={child} completingId={completingId} schedulingId={schedulingId} scheduleForm={scheduleForm} setScheduleForm={setScheduleForm} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onComplete={handleComplete} onSchedule={startSchedule} onSaveSchedule={handleSchedule} onCancelSchedule={() => setSchedulingId(null)} onEdit={startEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)} onDelete={handleDelete} scheduleLabel={scheduleLabel} /></div>)}</div>}
          </div>
        )}

      <div style={{ marginTop: "1rem" }}>
        {!showAdd ? <button onClick={() => setShowAdd(true)} style={{ width: "100%", padding: "0.6rem", fontSize: "0.95rem", color: "#3d9e6b", border: "1px dashed #3d9e6b", borderRadius: "14px", background: "transparent" }}>+ 添加任务</button> : (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <input placeholder="任务名 *" value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })} style={st.fi} autoFocus />
            <div style={{ display: "flex", gap: "0.5rem" }}><input type="number" placeholder="分钟 *" value={newForm.minutes} onChange={e => setNewForm({ ...newForm, minutes: e.target.value })} style={{ ...st.fi, flex: 1 }} /><select value={newForm.stars} onChange={e => setNewForm({ ...newForm, stars: parseInt(e.target.value) })} style={{ ...st.fi, flex: 1 }}><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
            <div style={{ display: "flex", gap: "0.5rem" }}><input type="time" value={newForm.start} onChange={e => setNewForm({ ...newForm, start: e.target.value })} style={{ ...st.fi, flex: 1 }} /><input type="time" value={newForm.end} onChange={e => setNewForm({ ...newForm, end: e.target.value })} style={{ ...st.fi, flex: 1 }} /></div>
            <div style={{ display: "flex", gap: "0.5rem" }}><button onClick={handleCreateTask} style={st.fsb}>添加</button><button onClick={() => setShowAdd(false)} style={st.fcb}>取消</button></div>
          </div>
        )}
      </div>

      {justCompleted && <div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: "#3d9e6b", color: "#fff", padding: "0.8rem 1.5rem", borderRadius: "20px", fontSize: "1rem", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>✅ {justCompleted.title} 完成！+{justCompleted.stars}⭐</div>}
    </div>
  );
}

function TaskCard({ task, child, completingId, schedulingId, scheduleForm, setScheduleForm, editingId, editForm, setEditForm, onComplete, onSchedule, onSaveSchedule, onCancelSchedule, onEdit, onSaveEdit, onCancelEdit, onDelete, scheduleLabel }) {
  const isScheduled = task.scheduled_start;
  const isChildTask = task.created_by === "child";
  const isUnapproved = isChildTask && !task.approved;
  const src = task.schedule_by === "child" ? `${child.name}安排` : task.schedule_by === "parent" ? "" : "";

  return (
    <div key={task.id} style={{ ...st.tc, opacity: task.status === "completed" ? 0.6 : 1 }}>
      {editingId === task.id ? (
        <div>
          <input placeholder="任务名 *" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={st.fi} autoFocus />
          <div style={{ display: "flex", gap: "0.5rem" }}><input type="number" placeholder="分钟 *" value={editForm.minutes} onChange={e => setEditForm({ ...editForm, minutes: e.target.value })} style={{ ...st.fi, flex: 1 }} /><select value={editForm.stars} onChange={e => setEditForm({ ...editForm, stars: parseInt(e.target.value) })} style={{ ...st.fi, flex: 1 }}><option value={1}>⭐</option><option value={2}>⭐⭐</option><option value={3}>⭐⭐⭐</option></select></div>
          <div style={{ display: "flex", gap: "0.5rem" }}><input type="time" value={editForm.start} onChange={e => setEditForm({ ...editForm, start: e.target.value })} style={{ ...st.fi, flex: 1 }} /><input type="time" value={editForm.end} onChange={e => setEditForm({ ...editForm, end: e.target.value })} style={{ ...st.fi, flex: 1 }} /></div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}><button onClick={() => onSaveEdit(task.id)} style={st.fsb}>保存</button><button onClick={onCancelEdit} style={st.fcb}>取消</button></div>
        </div>
      ) : schedulingId === task.id ? (
        <div>
          <div style={{ display: "flex", gap: "0.5rem" }}><input type="time" value={scheduleForm.start} onChange={e => setScheduleForm({ ...scheduleForm, start: e.target.value })} style={{ ...st.fi, flex: 1 }} /><input type="time" value={scheduleForm.end} onChange={e => setScheduleForm({ ...scheduleForm, end: e.target.value })} style={{ ...st.fi, flex: 1 }} /></div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}><button onClick={() => onSaveSchedule(task.id)} style={st.fsb}>保存</button><button onClick={onCancelSchedule} style={st.fcb}>取消</button></div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 600, color: task.status === "completed" ? "#73706b" : "#2d2b28", textDecoration: task.status === "completed" ? "line-through" : "none" }}>
              {isUnapproved && <span style={{ fontSize: "0.65rem", color: "#c97070", marginRight: "0.2rem" }}>待确认</span>}
              {task.title}
            </p>
            <p style={{ fontSize: "0.8rem", color: "#73706b", marginTop: "0.15rem" }}>
              {task.expected_minutes ? `${task.expected_minutes}分钟 · ` : ""}⭐{task.reward_stars}
              {isScheduled ? ` · ${scheduleLabel(task)}${src ? ` (${src})` : ""}` : " · 自由安排"}
            </p>
          </div>
          {isScheduled && task.status !== "completed" && (
            <span style={{ padding: "0.35rem 0.8rem", borderRadius: "999px", background: "#d4e8da", color: "#3d9e6b", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>{task.scheduled_start}</span>
          )}
          {task.status === "completed" ? (
            <span style={{ padding: "0.35rem 0.8rem", borderRadius: "999px", background: "#def0e3", color: "#4b9c64", fontSize: "0.85rem", fontWeight: 600 }}>已完成</span>
          ) : (
            <>
              {isUnapproved && <button onClick={() => onEdit(task)} style={{ padding: "0.35rem 0.6rem", borderRadius: "999px", background: "#e3f0e8", color: "#3d9e6b", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", border: "none", cursor: "pointer" }}>修改</button>}
              {isUnapproved && <button onClick={() => onDelete(task.id)} style={{ padding: "0.35rem 0.6rem", borderRadius: "999px", background: "#fef0f0", color: "#c97070", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", border: "none", cursor: "pointer" }}>删除</button>}
              {!isUnapproved && !isScheduled && task.created_by === "parent" && (
                <button onClick={() => onSchedule(task)} style={{ padding: "0.35rem 0.6rem", borderRadius: "999px", background: "#e3f0e8", color: "#3d9e6b", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", border: "none", cursor: "pointer" }}>安排时间</button>
              )}
              {!isUnapproved && (
                <button onClick={() => onComplete(task)} disabled={completingId === task.id} style={{ padding: "0.45rem 1rem", borderRadius: "999px", background: completingId === task.id ? "#8cb99a" : "#3d9e6b", color: "#fff", fontSize: "0.9rem", fontWeight: 600, whiteSpace: "nowrap", border: "none", cursor: "pointer" }}>{completingId === task.id ? "…" : "完成"}</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const st = {
  tc: { background: "#fff", borderRadius: "18px", padding: "1rem 1.1rem", marginBottom: "0.8rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  fi: { padding: "0.5rem 0.6rem", fontSize: "0.9rem", border: "1px solid #d6d2cc", borderRadius: "12px", outline: "none", background: "#fff", display: "block", marginBottom: "0.5rem", width: "100%" },
  fsb: { flex: 1, padding: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", borderRadius: "12px", border: "none", cursor: "pointer" },
  fcb: { flex: 1, padding: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#73706b", background: "#efece8", borderRadius: "12px", border: "none", cursor: "pointer" },
};
