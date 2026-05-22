import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import ChildCreate from "./ChildCreate.jsx";
import TaskManage from "./TaskManage.jsx";

export default function Home({ token, onLogout }) {
  const [children, setChildren] = useState([]);
  const [dashboards, setDashboards] = useState({});
  const [toggles, setToggles] = useState({});
  const [view, setView] = useState("home");
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", grade: "", threshold: "80" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.fetchChildren(token);
      setChildren(list);
      const ds = {};
      await Promise.all(list.map(async (c) => { try { ds[c.id] = await api.fetchDashboard(token, c.id); } catch { ds[c.id] = null; } }));
      setDashboards(ds);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function toggleView(childId) { setToggles(p => ({ ...p, [childId]: !p[childId] })); }
  function startEdit(c) { setEditingChild(c.id); setEditForm({ name: c.name, grade: c.grade_label || "", threshold: c.streak_threshold?.toString() || "80" }); }

  async function saveEdit() {
    if (!editingChild || !editForm.name.trim()) return;
    await api.updateChild(token, editingChild, { name: editForm.name.trim(), grade_label: editForm.grade.trim() || null, streak_threshold: parseInt(editForm.threshold) || 0 });
    setEditingChild(null); load();
  }

  async function handleDelete(childId) {
    if (!window.confirm("确定要删除吗？")) return;
    await api.deleteChild(token, childId);
    load();
  }

  if (view === "create-child") return <ChildCreate token={token} onDone={() => { setView("home"); load(); }} onCancel={() => setView("home")} />;
  if (view === "task-manage" && selectedChild) return <TaskManage token={token} child={selectedChild} onBack={() => { setView("home"); load(); }} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Family Plan</h1>
        <button onClick={onLogout} style={{ color: "#73706b", fontSize: "0.85rem" }}>退出</button>
      </div>

      {loading && <p style={{ color: "#73706b", textAlign: "center", paddingTop: "2rem" }}>加载中…</p>}

      {!loading && children.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: "3rem" }}>
          <p style={{ color: "#73706b", marginBottom: "1rem" }}>还没有添加人员</p>
          <button onClick={() => setView("create-child")} style={{ color: "#3d9e6b", fontSize: "1rem", fontWeight: 600 }}>+ 添加</button>
        </div>
      )}

      {children.map((c) => {
        const d = dashboards[c.id];
        const isCumulative = toggles[c.id];
        const completed = d?.today?.completed_tasks ?? 0;
        const total = d?.today?.total_tasks ?? 0;
        const stars = d?.rewards?.stars_total ?? 0;
        const streak = d?.rewards?.current_streak_days ?? 0;
        const rate = total > 0 ? Math.round((completed / total) * 100) : null;

        return (
          <div key={c.id} style={styles.card}>
            {editingChild === c.id ? (
              <div>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={styles.ei} autoFocus />
                <input value={editForm.grade} onChange={e => setEditForm({ ...editForm, grade: e.target.value })} placeholder="年级（选填）" style={styles.ei} />
                <input value={editForm.threshold} onChange={e => setEditForm({ ...editForm, threshold: e.target.value })} placeholder="打卡阈值 0-100" style={styles.ei} />
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                  <button onClick={saveEdit} style={styles.sb}>保存</button>
                  <button onClick={() => setEditingChild(null)} style={styles.cb}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div onClick={() => { setSelectedChild(c); setView("task-manage"); }} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>{c.name}</span>
                      {c.grade_label && <span style={{ fontSize: "0.8rem", color: "#73706b" }}>{c.grade_label}</span>}
                      <span style={{ fontSize: "0.85rem", color: "#c4912a" }}>⭐{stars}</span>
                      <span style={{ fontSize: "0.85rem", color: "#3d9e6b" }}>🔥{streak}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexShrink: 0, marginLeft: "0.5rem" }}>
                    <button onClick={() => toggleView(c.id)} style={{ ...styles.tg, background: isCumulative ? "#3d9e6b" : "#efece8", color: isCumulative ? "#fff" : "#73706b" }}>
                      {isCumulative ? "累计" : "今日"}
                    </button>
                    <button onClick={() => startEdit(c)} style={styles.ib}>✎</button>
                    <button onClick={() => handleDelete(c.id)} style={styles.ib}>✕</button>
                  </div>
                </div>
                {rate !== null && !isCumulative && (
                  <div style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <ProgressRing percent={rate} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.9rem", fontWeight: 650, letterSpacing: "-0.01em" }}>{completed}/{total} 项完成</p>
                      <p style={{ fontSize: "0.75rem", color: "#73706b", marginTop: "0.1rem" }}>当日进度</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {children.length > 0 && (
        <button onClick={() => setView("create-child")} style={styles.ab}>+ 添加</button>
      )}
    </div>
  );
}

function ProgressRing({ percent, size = 52 }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 52 52" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="#e8e4df" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="#3d9e6b" strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", fontWeight: 700, fontFamily: "SF Mono, ui-monospace, Menlo, monospace", color: "#2d2b28"
      }}>{percent}%</div>
    </div>
  );
}

const styles = {
  card: { background: "#fff", borderRadius: "14px", padding: "0.9rem 1rem", marginBottom: "0.7rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  tg: { padding: "0.2rem 0.55rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, border: "none", cursor: "pointer" },
  ib: { width: "1.6rem", height: "1.6rem", borderRadius: "50%", fontSize: "0.75rem", fontWeight: 600, color: "#73706b", background: "transparent", border: "none", cursor: "pointer" },
  ei: { width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.95rem", border: "1px solid #e8e4df", borderRadius: "8px", outline: "none", marginBottom: "0.3rem", display: "block" },
  sb: { flex: 1, padding: "0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", borderRadius: "8px" },
  cb: { flex: 1, padding: "0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#73706b", background: "#efece8", borderRadius: "8px" },
  ab: { width: "100%", padding: "0.7rem", fontSize: "0.95rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", borderRadius: "12px", marginTop: "0.6rem" },
};
