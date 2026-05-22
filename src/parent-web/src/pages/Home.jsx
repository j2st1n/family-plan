import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import ChildCreate from "./ChildCreate.jsx";
import TaskManage from "./TaskManage.jsx";

const AVATARS = ["#3d9e6b", "#c4912a", "#5b8fb9", "#c97070", "#8b6f9e", "#4b9c64"];

const GRADE_OPTIONS = {
  幼儿园: ["小班", "中班", "大班"],
  小学: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
  初中: ["初一", "初二", "初三"],
  高中: ["高一", "高二", "高三"],
};

function parseGradeLabel(label) {
  if (!label) return { stage: "", grade: "" };
  for (const [stage, grades] of Object.entries(GRADE_OPTIONS)) {
    if (label.startsWith(stage)) return { stage, grade: label.slice(stage.length) };
  }
  // Legacy free-text: try to infer stage from grade name
  for (const [stage, grades] of Object.entries(GRADE_OPTIONS)) {
    if (grades.includes(label)) return { stage, grade: label };
  }
  return { stage: "", grade: label };
}

function composeGradeLabel(stage, grade) {
  return stage && grade ? stage + grade : "";
}

export default function Home({ token, onLogout }) {
  const [children, setChildren] = useState([]);
  const [dashboards, setDashboards] = useState({});
  const [toggles, setToggles] = useState({});
  const [view, setView] = useState("home");
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", stage: "", grade: "", threshold: "80" });

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
  function startEdit(c) {
    const { stage, grade } = parseGradeLabel(c.grade_label || "");
    setEditingChild(c.id);
    setEditForm({ name: c.name, stage, grade, threshold: c.streak_threshold?.toString() || "80" });
  }

  async function saveEdit() {
    if (!editingChild || !editForm.name.trim()) return;
    const gradeLabel = composeGradeLabel(editForm.stage, editForm.grade) || null;
    await api.updateChild(token, editingChild, { name: editForm.name.trim(), grade_label: gradeLabel, streak_threshold: parseInt(editForm.threshold) || 0 });
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
                <label style={styles.el}>名字</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={styles.ei} autoFocus />
                <label style={styles.el}>学段</label>
                <select value={editForm.stage} onChange={e => setEditForm({ ...editForm, stage: e.target.value, grade: "" })} style={styles.ei}>
                  <option value="">不填</option>
                  {Object.keys(GRADE_OPTIONS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {editForm.stage && (
                  <>
                    <label style={styles.el}>年级</label>
                    <select value={editForm.grade} onChange={e => setEditForm({ ...editForm, grade: e.target.value })} style={styles.ei}>
                      <option value="">请选择</option>
                      {GRADE_OPTIONS[editForm.stage].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </>
                )}
                <label style={styles.el}>完成当日 X% 的任务 → 打卡次数 +1</label>
                <input value={editForm.threshold} onChange={e => setEditForm({ ...editForm, threshold: e.target.value })} type="number" min="0" max="100" style={styles.ei} />
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                  <button onClick={saveEdit} style={styles.sb}>保存</button>
                  <button onClick={() => setEditingChild(null)} style={styles.cb}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div className="child-avatar" style={{ background: AVATARS[c.id.charCodeAt?.(0) % AVATARS.length || 0] }}>{c.name[0]}</div>
                  <div onClick={() => { setSelectedChild(c); setView("task-manage"); }} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "\"Noto Sans SC\", \"PingFang SC\", -apple-system, BlinkMacSystemFont, sans-serif" }}>{c.name}</span>
                      {c.grade_label && <span style={{ fontSize: "0.78rem", color: "#73706b" }}>{c.grade_label}</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                      <span className="stat-chip">⭐ {stars}</span>
                      <span className="stat-chip green">🔥 {streak}</span>
                      <span style={{ fontSize: "0.72rem", color: "#9e948a" }}>达标线 {c.streak_threshold ?? 80}%</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.2rem", alignItems: "center", flexShrink: 0 }}>
                    <button onClick={() => toggleView(c.id)} style={{ ...styles.tg, background: isCumulative ? "#3d9e6b" : "#efece8", color: isCumulative ? "#fff" : "#73706b" }}>
                      {isCumulative ? "累计" : "今日"}
                    </button>
                    <button onClick={() => startEdit(c)} style={styles.ib}>✎</button>
                    <button onClick={() => handleDelete(c.id)} style={styles.ib}>✕</button>
                  </div>
                </div>
                {rate !== null && !isCumulative && (
                  <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #f0ece6", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <ProgressRing percent={rate} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: 650, letterSpacing: "-0.01em" }}>{completed}/{total} 项完成</p>
                      <p style={{ fontSize: "0.72rem", color: "#73706b", marginTop: "0.05rem" }}>当日进度</p>
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
  el: { display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#4a4540", marginBottom: "0.15rem", marginTop: "0.3rem" },
  sb: { flex: 1, padding: "0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", borderRadius: "8px" },
  cb: { flex: 1, padding: "0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#73706b", background: "#efece8", borderRadius: "8px" },
  ab: { width: "100%", padding: "0.7rem", fontSize: "0.95rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", borderRadius: "12px", marginTop: "0.6rem" },
};
