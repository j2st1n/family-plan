import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import ChildCreate from "./ChildCreate.jsx";
import RewardSettings from "./RewardSettings.jsx";
import TaskManage from "./TaskManage.jsx";
import { formatStars } from "../utils/format.js";
import { useFeedback } from "../components/FeedbackContext.jsx";

const AVATARS = ["#0071E3", "#34C759", "#FF9500", "#FF3B30", "#00C7BE", "#5856D6"];

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

export default function Home({ token, isActive, onLogout, onExpired }) {
  const { toast, confirm } = useFeedback();
  const [children, setChildren] = useState([]);
  const [dashboards, setDashboards] = useState({});
  const [view, setView] = useState("home");
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingChild, setEditingChild] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", stage: "", grade: "", threshold: "80" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.fetchChildren(token);
      setChildren(list);
      const ds = {};
      await Promise.all(list.map(async (c) => { 
        try { 
          ds[c.id] = await api.fetchDashboard(token, c.id); 
        } catch (err) {
          ds[c.id] = null;
          setError("加载" + c.name + "的仪表盘失败: " + (err.message || "未知错误"));
        }
      }));
      setDashboards(ds);
    } catch (err) {
      setError("加载人员列表失败: " + (err.message || "未知错误"));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useSseRefresh({ token, enabled: isActive && view === "home", topics: ["tasks", "children", "settings"], onRefresh: load, onExpired });
  useVisibilityRefresh({ enabled: isActive, onRefresh: load });

  function startEdit(c) {
    const { stage, grade } = parseGradeLabel(c.grade_label || "");
    setEditingChild(c.id);
    setEditForm({ name: c.name, stage, grade, threshold: c.streak_threshold?.toString() || "80" });
  }

  async function saveEdit() {
    if (!editingChild || !editForm.name.trim()) return;
    const gradeLabel = composeGradeLabel(editForm.stage, editForm.grade) || null;
    try {
      await api.updateChild(token, editingChild, { name: editForm.name.trim(), grade_label: gradeLabel, streak_threshold: parseInt(editForm.threshold) || 0 });
      setEditingChild(null); load();
    } catch (err) {
      setError("保存人员信息失败: " + (err.message || "未知错误"));
    }
  }

  async function handleDelete(childId) {
    const ok = await confirm({
      title: "删除人员",
      message: "确定要删除该人员档案吗？此操作不可逆。",
      confirmText: "删除",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteChild(token, childId);
      toast.success("已删除人员档案");
      load();
    } catch (err) {
      setError("删除人员失败: " + (err.message || "未知错误"));
    }
  }

  if (view === "create-child") return <ChildCreate token={token} onDone={() => { setView("home"); load(); }} onCancel={() => setView("home")} />;
  if (view === "task-manage" && selectedChild) return <TaskManage token={token} child={selectedChild} isActive={isActive} onExpired={onExpired} onBack={() => { setView("home"); load(); }} />;
  if (view === "reward-settings" && selectedChild) return <RewardSettings token={token} child={selectedChild} onBack={() => { setView("home"); load(); }} />;

  return (
    <div>
      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.015em" }}>Family Plan</h1>
        <button onClick={onLogout} style={{ color: "var(--muted)", fontSize: "0.85rem", cursor: "pointer" }}>退出</button>
      </div>

      {loading && <p style={{ color: "var(--muted)", textAlign: "center", paddingTop: "2rem" }}>加载中…</p>}

      {!loading && children.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "2rem", background: "var(--card)", borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: "2.2rem", display: "block", marginBottom: "0.4rem" }}>🌱</span>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>还没有添加人员</p>
          <button onClick={() => setView("create-child")} className="btn-primary">+ 添加孩子</button>
        </div>
      )}

      {children.map((c) => {
        const d = dashboards[c.id];
        const completed = d?.today?.completed_tasks ?? 0;
        const total = d?.today?.total_tasks ?? 0;
        const stars = d?.rewards?.stars_total ?? 0;
        const streak = d?.rewards?.current_streak_days ?? 0;
        const rate = total > 0 ? Math.round((completed / total) * 100) : null;
        const submitted = d?.submitted_tasks ?? d?.today?.submitted_tasks ?? 0;

        return (
          <div key={c.id} style={styles.card}>
            {editingChild === c.id ? (
              <div className="ios-grouped-card" style={{ padding: "12px", margin: "6px 0" }}>
                <input
                  placeholder="孩子姓名"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: "100%", border: "none", outline: "none", fontSize: "1rem", color: "var(--text)", marginBottom: "8px" }}
                  autoFocus
                />
                <div className="ios-separator" />
                <div style={{ padding: "8px 0" }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "6px" }}>学段</div>
                  <div className="ios-segmented-control">
                    {Object.keys(GRADE_OPTIONS).map(s => (
                      <button
                        key={s}
                        type="button"
                        className={`ios-segmented-item ${editForm.stage === s ? "active" : ""}`}
                        onClick={() => setEditForm({ ...editForm, stage: s, grade: (GRADE_OPTIONS[s] || [])[0] || "" })}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {editForm.stage && (
                  <>
                    <div className="ios-separator" />
                    <div style={{ padding: "8px 0" }}>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "6px" }}>年级</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {(GRADE_OPTIONS[editForm.stage] || []).map(g => (
                          <button
                            key={g}
                            type="button"
                            className={`pill-segment-btn ${editForm.grade === g ? "active" : ""}`}
                            onClick={() => setEditForm({ ...editForm, grade: g })}
                            style={{ padding: "4px 10px", fontSize: "0.8rem", borderRadius: "8px" }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="ios-separator" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>每日连胜达标标准 (%)</span>
                  <input
                    value={editForm.threshold}
                    onChange={e => setEditForm({ ...editForm, threshold: e.target.value })}
                    type="number"
                    min="50"
                    max="100"
                    className="ios-time-input"
                    style={{ width: "64px", textAlign: "right" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.6rem", marginTop: "10px" }}>
                  <button onClick={saveEdit} style={styles.sb}>保存</button>
                  <button onClick={() => setEditingChild(null)} style={styles.cb}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div className="child-avatar" style={{ background: AVATARS[c.id.charCodeAt?.(0) % AVATARS.length || 0] }}>{c.name[0]}</div>
                    {submitted > 0 && (
                      <span
                        title={`${submitted} 项待审核任务`}
                        style={{
                          position: "absolute",
                          top: "-4px",
                          right: "-4px",
                          minWidth: "18px",
                          height: "18px",
                          padding: "0 4px",
                          borderRadius: "999px",
                          background: "var(--flame)",
                          color: "#FFFFFF",
                          fontSize: "0.68rem",
                          fontWeight: 750,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "2px solid var(--card)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        }}
                      >
                        {submitted}
                      </span>
                    )}
                  </div>
                  <div onClick={() => { setSelectedChild(c); setView("task-manage"); }} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{c.name}</span>
                      {c.grade_label && <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{c.grade_label}</span>}
                      {submitted > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px",
                            padding: "2px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            borderRadius: "var(--radius-pill)",
                            background: "var(--star-bg)",
                            color: "var(--star)",
                            border: "1px solid var(--star-border)",
                          }}
                        >
                          ⏳ 待点赞 {submitted}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                      <span className="stat-chip">⭐ {formatStars(stars)}</span>
                      <span className="stat-chip flame">🔥 {streak}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>达标线 {c.streak_threshold ?? 80}%</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexShrink: 0 }}>
                    <button onClick={() => startEdit(c)} style={styles.ib} title="编辑">✎</button>
                    <button onClick={() => { setSelectedChild(c); setView("reward-settings"); }} style={styles.settingsBtn}>奖励设置</button>
                    <button onClick={() => handleDelete(c.id)} style={styles.ib} title="删除">✕</button>
                  </div>
                </div>
                {rate !== null && (
                  <div style={{ marginTop: "0.6rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "0.7rem" }}>
                    <ProgressRing percent={rate} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: 650, letterSpacing: "-0.01em", color: "var(--text)" }}>{completed}/{total} 项完成</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.05rem" }}>当日进度</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {children.length > 0 && (
        <button onClick={() => setView("create-child")} style={styles.ab}>+ 添加孩子</button>
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
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--accent)" strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)"
      }}>{percent}%</div>
    </div>
  );
}

const styles = {
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem 1.15rem", marginBottom: "0.85rem", boxShadow: "var(--shadow-card)" },
  ib: { width: "1.8rem", height: "1.8rem", borderRadius: "50%", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  settingsBtn: { padding: "0.26rem 0.65rem", borderRadius: "var(--radius-pill)", fontSize: "0.74rem", fontWeight: 650, color: "var(--accent)", background: "var(--accent-light)", border: "1px solid var(--accent-pill)", cursor: "pointer", whiteSpace: "nowrap" },
  ei: { width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.95rem", border: "1px solid var(--border)", borderRadius: "8px", outline: "none", marginBottom: "0.35rem", display: "block", background: "var(--card)", color: "var(--text)", fontVariantNumeric: "tabular-nums" },
  el: { display: "block", fontSize: "0.78rem", fontWeight: 650, color: "var(--muted)", marginBottom: "0.15rem", marginTop: "0.35rem" },
  sb: { flex: 1, padding: "0.45rem", fontSize: "0.85rem", fontWeight: 650, color: "#FFFFFF", background: "var(--accent)", borderRadius: "8px", border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)" },
  cb: { flex: 1, padding: "0.45rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", background: "#F0ECE4", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer" },
  ab: { width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 650, color: "#FFFFFF", background: "var(--accent)", borderRadius: "12px", marginTop: "0.8rem", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(67, 106, 84, 0.2)" },
  errorBanner: {
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-border)",
    borderRadius: "10px",
    padding: "0.8rem 1rem",
    marginBottom: "0.8rem",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    color: "var(--danger)",
    fontSize: "0.85rem",
  },
  errorIcon: {
    fontSize: "1.1rem",
    fontWeight: 600,
  },
  errorClose: {
    marginLeft: "auto",
    fontSize: "0.9rem",
    color: "var(--danger)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};
