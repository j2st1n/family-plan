import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import StreakFreezeModal from "../components/StreakFreezeModal.jsx";

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
  for (const [stage, grades] of Object.entries(GRADE_OPTIONS)) {
    if (grades.includes(label)) return { stage, grade: label };
  }
  return { stage: "", grade: label };
}

function composeGradeLabel(stage, grade) {
  return stage && grade ? stage + grade : "";
}

function formatLogDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${m}-${day}`;
  } catch {
    return isoStr;
  }
}

const WEEKDAYS = [
  { id: 1, label: "一" },
  { id: 2, label: "二" },
  { id: 3, label: "三" },
  { id: 4, label: "四" },
  { id: 5, label: "五" },
  { id: 6, label: "六" },
  { id: 7, label: "日" },
];

export default function Settings({
  token,
  children = [],
  onRefreshChildren,
  onLogout,
  onExpired,
}) {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || "");
  const [accessCode, setAccessCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit child modal
  const [editingChild, setEditingChild] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", stage: "小学", grade: "三年级", threshold: "80" });

  // Add child modal
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildForm, setNewChildForm] = useState({ name: "", stage: "小学", grade: "一年级" });

  // Reward settings modal
  const [rewardChild, setRewardChild] = useState(null);
  const [rewardThreshold, setRewardThreshold] = useState("80");
  const [discountTiers, setDiscountTiers] = useState([]);

  // Routine tasks state
  const [routineChildId, setRoutineChildId] = useState(children[0]?.id || "");
  const [routineTasks, setRoutineTasks] = useState([]);
  const [routinePlanId, setRoutinePlanId] = useState(null);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [routineForm, setRoutineForm] = useState({
    title: "",
    minutes: "20",
    stars: 1,
    weekdays: [1, 2, 3, 4, 5],
    require_approval: false,
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Streak Freeze Management state
  const [freezeChildId, setFreezeChildId] = useState(children[0]?.id || "");
  const [freezeData, setFreezeData] = useState(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeError, setFreezeError] = useState("");
  const [freezeSuccess, setFreezeSuccess] = useState("");
  const [freezeModalChild, setFreezeModalChild] = useState(null);
  const [freezeStarCost, setFreezeStarCost] = useState("5");
  const [freezeMaxLimit, setFreezeMaxLimit] = useState(2);
  const [freezeMonthlyGrant, setFreezeMonthlyGrant] = useState(1);
  const [savingFreezeRules, setSavingFreezeRules] = useState(false);
  const [freezeAdjustDelta, setFreezeAdjustDelta] = useState(null);
  const [freezeAdjustReason, setFreezeAdjustReason] = useState("");
  const [adjustingFreeze, setAdjustingFreeze] = useState(false);

  const loadFreezeData = useCallback(async () => {
    if (!token || !freezeChildId) return;
    setFreezeLoading(true);
    setFreezeError("");
    try {
      const data = await api.fetchChildFreeze(token, freezeChildId);
      setFreezeData(data);
      setFreezeStarCost(data.star_cost ? String(Number(data.star_cost)) : "5");
      setFreezeMaxLimit(data.max_limit ?? 2);
      setFreezeMonthlyGrant(data.monthly_grant ?? 1);
    } catch (err) {
      setFreezeError("加载保护卡数据失败: " + (err.message || "未知错误"));
    } finally {
      setFreezeLoading(false);
    }
  }, [token, freezeChildId]);

  useEffect(() => {
    loadFreezeData();
  }, [loadFreezeData]);

  useEffect(() => {
    if (children.length > 0) {
      if (!selectedChildId || !children.find((c) => c.id === selectedChildId)) {
        setSelectedChildId(children[0].id);
      }
      if (!routineChildId || !children.find((c) => c.id === routineChildId)) {
        setRoutineChildId(children[0].id);
      }
      if (!freezeChildId || !children.find((c) => c.id === freezeChildId)) {
        setFreezeChildId(children[0].id);
      }
    }
  }, [children, selectedChildId, routineChildId]);

  // Load routine tasks for selected routine child
  const loadRoutines = useCallback(async () => {
    if (!token || !routineChildId) return;
    try {
      const plans = await api.fetchPlans(token, routineChildId);
      const activePlan = plans.find((p) => p.status === "active") || plans[0];
      if (activePlan) {
        setRoutinePlanId(activePlan.id);
        const tasks = (activePlan.tasks || []).filter((t) => t.status === "active");
        setRoutineTasks(tasks);
      } else {
        setRoutinePlanId(null);
        setRoutineTasks([]);
      }
    } catch (err) {
      console.warn("Load routines error", err);
    }
  }, [token, routineChildId]);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  // Generate iPad access code
  const handleGenerateCode = async () => {
    if (!selectedChildId) return;
    setCodeLoading(true);
    setCopied(false);
    try {
      const res = await api.getAccessCode(token, selectedChildId);
      setAccessCode(res.code || res.access_code);
    } catch (err) {
      alert(`生成访问码失败：${err.message}`);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!accessCode) return;
    navigator.clipboard.writeText(accessCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Fallback
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    );
  };

  // Child Profile Actions
  const startEditChild = (child) => {
    const { stage, grade } = parseGradeLabel(child.grade_label || "");
    setEditingChild(child.id);
    setEditForm({
      name: child.name,
      stage: stage || "小学",
      grade: grade || "一年级",
      threshold: String(child.streak_threshold ?? 80),
    });
  };

  const saveEditChild = async () => {
    if (!editingChild || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const gradeLabel = composeGradeLabel(editForm.stage, editForm.grade) || null;
      await api.updateChild(token, editingChild, {
        name: editForm.name.trim(),
        grade_label: gradeLabel,
        streak_threshold: parseInt(editForm.threshold) || 80,
      });
      setEditingChild(null);
      onRefreshChildren?.();
    } catch (err) {
      alert(`保存档案失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (childId, childName) => {
    if (!window.confirm(`确定要删除孩子“${childName}”的所有档案与记录吗？此操作不可逆。`)) return;
    try {
      await api.deleteChild(token, childId);
      onRefreshChildren?.();
    } catch (err) {
      alert(`删除孩子失败：${err.message}`);
    }
  };

  const handleAddChild = async () => {
    if (!newChildForm.name.trim()) return;
    setSaving(true);
    try {
      const gradeLabel = composeGradeLabel(newChildForm.stage, newChildForm.grade) || null;
      await api.createChild(token, newChildForm.name.trim(), gradeLabel);
      setShowAddChild(false);
      setNewChildForm({ name: "", stage: "小学", grade: "一年级" });
      onRefreshChildren?.();
    } catch (err) {
      alert(`添加孩子失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reward settings
  const openRewardSettings = async (child) => {
    setRewardChild(child);
    try {
      const res = await api.fetchRewardSettings(token, child.id);
      setRewardThreshold(String(res.streak_threshold ?? 80));
      setDiscountTiers(res.discount_tiers || []);
    } catch {
      setRewardThreshold(String(child.streak_threshold ?? 80));
      setDiscountTiers([]);
    }
  };

  const saveRewardSettings = async () => {
    if (!rewardChild) return;
    setSaving(true);
    try {
      await api.updateRewardSettings(token, rewardChild.id, {
        streak_threshold: parseInt(rewardThreshold) || 80,
        discount_tiers: discountTiers,
      });
      setRewardChild(null);
      onRefreshChildren?.();
    } catch (err) {
      alert(`保存奖励达标线失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Routine tasks actions
  const handleSaveRoutine = async () => {
    if (!routinePlanId || !routineForm.title.trim()) return;
    setSaving(true);
    try {
      await api.addRoutineTask(token, routinePlanId, {
        title: routineForm.title.trim(),
        expected_minutes: parseInt(routineForm.minutes) || 20,
        reward_stars: routineForm.stars,
        repeat_weekdays: routineForm.weekdays,
        require_approval: !!routineForm.require_approval,
      });
      setShowAddRoutine(false);
      setRoutineForm({
        title: "",
        minutes: "20",
        stars: 1,
        weekdays: [1, 2, 3, 4, 5],
        require_approval: false,
      });
      await loadRoutines();
    } catch (err) {
      alert(`添加例行任务失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoutine = async (templateId) => {
    if (!routinePlanId) return;
    if (!window.confirm("确定要删除这个例行循环任务吗？")) return;
    try {
      await api.deleteRoutineTask(token, routinePlanId, templateId);
      await loadRoutines();
    } catch (err) {
      alert(`删除例行任务失败：${err.message}`);
    }
  };

  const toggleWeekday = (dayId) => {
    const cur = routineForm.weekdays;
    if (cur.includes(dayId)) {
      setRoutineForm({ ...routineForm, weekdays: cur.filter((d) => d !== dayId) });
    } else {
      setRoutineForm({ ...routineForm, weekdays: [...cur, dayId].sort() });
    }
  };

  return (
    <div className="settings-page" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 页面大标题 */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "1.25rem" }}>⚙️</span>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)" }}>我的与设置</h2>
      </div>

      {/* Section 1: 家庭与孩子档案列表 */}
      <section
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "1.1rem" }}>👨‍👩‍👧‍👦</span>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>家庭与孩子档案</h3>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddChild(true)}
            style={{ padding: "4px 10px", fontSize: "0.8rem", borderRadius: "var(--radius-pill)" }}
          >
            + 添加孩子
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {children.map((child) => (
            <div
              key={child.id}
              style={{
                backgroundColor: "var(--card-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                    👦 {child.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                    }}
                  >
                    {child.grade_label || "未设置学段"}
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>
                  打卡达标线: {child.streak_threshold ?? 80}% 完成度
                </p>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => startEditChild(child)}
                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                >
                  ✎ 编辑
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFreezeModalChild(child);
                    setFreezeChildId(child.id);
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.78rem",
                    color: "var(--protect)",
                    borderColor: "var(--protect-border)",
                  }}
                >
                  ❄️ 保护卡
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => openRewardSettings(child)}
                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                >
                  达标线
                </button>
                {children.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteChild(child.id, child.name)}
                    style={{
                      padding: "4px 6px",
                      fontSize: "0.78rem",
                      color: "var(--danger)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    title="删除档案"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: iPad 设备访问码集中查看、生成与复制 */}
      <section
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          <span style={{ fontSize: "1.1rem" }}>📱</span>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>iPad 设备绑定访问码</h3>
        </div>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "14px" }}>
          在儿童 iPad 端打开应用并输入 6 位配对码即可自动绑定，24 小时内有效：
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <select
            value={selectedChildId}
            onChange={(e) => {
              setSelectedChildId(e.target.value);
              setAccessCode("");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card-subtle)",
              color: "var(--text)",
              fontSize: "0.88rem",
            }}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerateCode}
            disabled={codeLoading}
            style={{ padding: "6px 14px", fontSize: "0.85rem" }}
          >
            {codeLoading ? "生成中..." : accessCode ? "重新生成" : "生成 6 位访问码"}
          </button>
        </div>

        {accessCode && (
          <div
            style={{
              backgroundColor: "var(--accent-light)",
              border: "1.5px solid var(--accent)",
              borderRadius: "var(--radius)",
              padding: "16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                letterSpacing: "0.25em",
                color: "var(--accent)",
                fontFamily: "monospace",
              }}
            >
              {accessCode}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyCode}
              style={{ padding: "6px 16px", fontSize: "0.85rem", fontWeight: 700 }}
            >
              {copied ? "✓ 访问码已复制" : "📋 复制 6 位访问码"}
            </button>
          </div>
        )}
      </section>

      {/* Section 3: 重复例行任务模板库 */}
      <section
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "1.1rem" }}>🔁</span>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>重复例行任务模板库</h3>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddRoutine(true)}
            style={{ padding: "4px 10px", fontSize: "0.8rem", borderRadius: "var(--radius-pill)" }}
          >
            + 添加循环任务
          </button>
        </div>

        {/* Child selector for routine tasks */}
        {children.length > 1 && (
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginRight: "8px" }}>当前孩子:</span>
            <select
              value={routineChildId}
              onChange={(e) => setRoutineChildId(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card-subtle)",
                fontSize: "0.82rem",
              }}
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {routineTasks.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center", padding: "12px 0" }}>
            暂无每周循环例行任务，点击上方按钮可为孩子配置工作日固定任务。
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {routineTasks.map((rt) => {
              const daysStr = (rt.repeat_weekdays || [])
                .map((d) => (d === 7 ? "周日" : `周${WEEKDAYS.find((w) => w.id === d)?.label || d}`))
                .join("、");
              return (
                <div
                  key={rt.id}
                  style={{
                    backgroundColor: "var(--card-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 650, fontSize: "0.9rem", color: "var(--text)" }}>{rt.title}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      ⏱️ {rt.expected_minutes || 20} 分钟 · ⭐+{rt.reward_stars} · {daysStr || "每天"}
                      {rt.require_approval && " · 需审核"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRoutine(rt.id)}
                    style={{
                      color: "var(--muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                    title="删除循环任务"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 4: 连击保护卡与补签管理 */}
      <section
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "1.1rem" }}>❄️</span>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>连击保护卡与补签管理</h3>
          </div>
          {children.length > 1 && (
            <select
              value={freezeChildId}
              onChange={(e) => setFreezeChildId(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card-subtle)",
                fontSize: "0.82rem",
                color: "var(--text)",
              }}
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "12px" }}>
          配置连击保护卡兑换价格、防囤积上限，支持家长手动奖惩增减卡片，并可查阅全生命周期审计流水。
        </p>

        {freezeError && (
          <div style={{ padding: "8px 12px", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "8px", fontSize: "0.8rem", marginBottom: "10px" }}>
            {freezeError}
          </div>
        )}
        {freezeSuccess && (
          <div style={{ padding: "8px 12px", background: "var(--accent-light)", color: "var(--accent)", borderRadius: "8px", fontSize: "0.8rem", marginBottom: "10px" }}>
            {freezeSuccess}
          </div>
        )}

        {freezeLoading && !freezeData ? (
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem", padding: "12px 0" }}>加载中…</p>
        ) : freezeData && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 库存展示与奖惩 */}
            <div style={{ backgroundColor: "var(--card-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>
                      ❄️ {freezeData.available_count} 张
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600 }}>
                      / 持有上限 {freezeData.max_limit} 张
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                    商城兑换单价：⭐{Number(freezeData.star_cost)} 颗星星 · 每月赠送：{freezeData.monthly_grant} 张
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={freezeData.available_count <= 0}
                    onClick={() => {
                      setFreezeAdjustDelta(-1);
                      setFreezeAdjustReason("");
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.78rem",
                      color: freezeData.available_count <= 0 ? "var(--muted)" : "var(--danger)",
                    }}
                  >
                    - 扣除 1 张
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setFreezeAdjustDelta(1);
                      setFreezeAdjustReason("");
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.78rem",
                      color: "var(--protect)",
                      borderColor: "var(--protect-border)",
                    }}
                  >
                    + 奖励 1 张
                  </button>
                </div>
              </div>

              {/* 手动调整对话输入框 */}
              {freezeAdjustDelta !== null && (
                <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "var(--card)", border: "1px dashed var(--border)", borderRadius: "8px" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "6px" }}>
                    {freezeAdjustDelta > 0 ? "🎁 家长手动奖励 1 张保护卡" : "⚠️ 家长手动扣除 1 张保护卡"}
                  </p>
                  <input
                    type="text"
                    value={freezeAdjustReason}
                    onChange={(e) => setFreezeAdjustReason(e.target.value)}
                    placeholder={freezeAdjustDelta > 0 ? "请输入奖励理由，如：发烧生病特许免死金牌" : "请输入扣除理由，如：错记纠偏回收"}
                    style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text)", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setFreezeAdjustDelta(null)}
                      style={{ padding: "4px 10px", fontSize: "0.75rem", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", borderRadius: "6px", cursor: "pointer" }}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={adjustingFreeze}
                      onClick={async () => {
                        setAdjustingFreeze(true);
                        setFreezeError("");
                        setFreezeSuccess("");
                        try {
                          const defReason = freezeAdjustDelta > 0 ? "家长手动奖励" : "家长手动扣除";
                          const res = await api.adjustChildFreeze(token, freezeChildId, freezeAdjustDelta, freezeAdjustReason.trim() || defReason);
                          setFreezeData(res);
                          setFreezeSuccess(freezeAdjustDelta > 0 ? "🎁 成功奖励 1 张保护卡！" : "⚠️ 成功扣除 1 张保护卡！");
                          setFreezeAdjustDelta(null);
                        } catch (err) {
                          setFreezeError("调整失败: " + (err.message || "未知错误"));
                        } finally {
                          setAdjustingFreeze(false);
                        }
                      }}
                      style={{
                        padding: "4px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        backgroundColor: freezeAdjustDelta > 0 ? "var(--protect)" : "var(--danger)",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      {adjustingFreeze ? "提交中…" : "确认"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 规则配置表单 */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingFreezeRules(true);
                setFreezeError("");
                setFreezeSuccess("");
                try {
                  const res = await api.updateFreezeSettings(token, freezeChildId, {
                    star_cost: Number(freezeStarCost),
                    max_limit: Number(freezeMaxLimit),
                    monthly_grant: Number(freezeMonthlyGrant),
                  });
                  setFreezeData(res);
                  setFreezeSuccess("✅ 规则与风控设定已保存！");
                } catch (err) {
                  setFreezeError("保存规则失败: " + (err.message || "未知错误"));
                } finally {
                  setSavingFreezeRules(false);
                }
              }}
              style={{
                backgroundColor: "var(--card-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 650, color: "var(--text)", marginBottom: "4px" }}>
                    ⭐ 兑换星数 (1~50星)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={freezeStarCost}
                    onChange={(e) => setFreezeStarCost(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text)", boxSizing: "border-box" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 650, color: "var(--text)", marginBottom: "4px" }}>
                    🛡️ 最大持有上限 (1~5张)
                  </label>
                  <select
                    value={freezeMaxLimit}
                    onChange={(e) => setFreezeMaxLimit(Number(e.target.value))}
                    style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text)", boxSizing: "border-box" }}
                  >
                    {[1, 2, 3, 5].map((lim) => (
                      <option key={lim} value={lim}>
                        {lim} 张 {lim === 2 ? "(推荐)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  每月初自动赠送：{freezeMonthlyGrant} 张保底
                </span>
                <button
                  type="submit"
                  disabled={savingFreezeRules}
                  className="btn-primary"
                  style={{ padding: "4px 12px", fontSize: "0.8rem", borderRadius: "var(--radius-pill)" }}
                >
                  {savingFreezeRules ? "保存中…" : "保存规则修改"}
                </button>
              </div>
            </form>

            {/* 流水明细查阅 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>
                  📜 流水与抵扣明细 ({freezeData.history?.length ?? freezeData.usages?.length ?? 0}条)
                </span>
                <button
                  type="button"
                  onClick={() => setFreezeModalChild(children.find((c) => c.id === freezeChildId) || { id: freezeChildId, name: "孩子" })}
                  style={{ background: "none", border: "none", color: "var(--protect)", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}
                >
                  打开完整抽屉 ↗
                </button>
              </div>

              {(!freezeData.history || freezeData.history.length === 0) && (!freezeData.usages || freezeData.usages.length === 0) ? (
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>
                  暂无流水记录
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                  {freezeData.history && freezeData.history.length > 0 ? (
                    freezeData.history.slice(0, 5).map((h) => (
                      <div
                        key={h.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          backgroundColor: "var(--card-subtle)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "0.78rem",
                        }}
                      >
                        <div>
                          <strong style={{ color: "var(--text)" }}>{h.reason || h.event_type}</strong>
                          <span style={{ fontSize: "0.7rem", color: "var(--muted)", marginLeft: "6px" }}>
                            {formatLogDate(h.created_at)}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: h.delta > 0 ? "var(--accent)" : "var(--flame)" }}>
                          {h.delta > 0 ? `+${h.delta}` : h.delta} 张 (余{h.balance_after})
                        </span>
                      </div>
                    ))
                  ) : (
                    freezeData.usages?.slice(0, 5).map((u) => (
                      <div
                        key={u.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          backgroundColor: "var(--card-subtle)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "0.78rem",
                        }}
                      >
                        <span>🤖 {u.used_date} 遗漏自动抵扣</span>
                        <span style={{ fontWeight: 700, color: "var(--flame)" }}>-1 张</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section 5: 账号与系统信息，规范退出收纳在页面最下方 */}
      <section
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          boxShadow: "var(--shadow-card)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "4px" }}>
          Family Plan 亲子自律计划系统 v1.2.0
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "16px" }}>
          自然温润纸质手账风 · 陪伴成长每一步
        </p>

        <button
          type="button"
          onClick={() => {
            if (window.confirm("确定要退出当前登录吗？退出后需要重新输入用户名与密码。")) {
              onLogout?.();
            }
          }}
          style={{
            color: "var(--danger)",
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius-sm)",
            fontWeight: 700,
            fontSize: "0.9rem",
            padding: "8px 24px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          🚪 退出当前登录
        </button>
      </section>

      {/* Edit Child Modal */}
      {editingChild && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setEditingChild(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px" }}>编辑孩子资料</h3>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
              孩子姓名 *
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "12px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  学段
                </span>
                <select
                  value={editForm.stage}
                  onChange={(e) => {
                    const st = e.target.value;
                    const defaultGrade = GRADE_OPTIONS[st]?.[0] || "";
                    setEditForm({ ...editForm, stage: st, grade: defaultGrade });
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                >
                  {Object.keys(GRADE_OPTIONS).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  年级
                </span>
                <select
                  value={editForm.grade}
                  onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                >
                  {(GRADE_OPTIONS[editForm.stage] || []).map((gr) => (
                    <option key={gr} value={gr}>
                      {gr}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
              打卡达标线百分比 (默认 80%)
            </label>
            <input
              type="number"
              min={10}
              max={100}
              value={editForm.threshold}
              onChange={(e) => setEditForm({ ...editForm, threshold: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={() => setEditingChild(null)}>
                取消
              </button>
              <button type="button" className="btn-primary" onClick={saveEditChild} disabled={saving}>
                {saving ? "保存中..." : "保存资料"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      {showAddChild && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowAddChild(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px" }}>添加新孩子</h3>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
              孩子称呼/姓名 *
            </label>
            <input
              type="text"
              placeholder="如：小明、Lily"
              value={newChildForm.name}
              onChange={(e) => setNewChildForm({ ...newChildForm, name: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "12px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  学段
                </span>
                <select
                  value={newChildForm.stage}
                  onChange={(e) => {
                    const st = e.target.value;
                    const defaultGrade = GRADE_OPTIONS[st]?.[0] || "";
                    setNewChildForm({ ...newChildForm, stage: st, grade: defaultGrade });
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                >
                  {Object.keys(GRADE_OPTIONS).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  年级
                </span>
                <select
                  value={newChildForm.grade}
                  onChange={(e) => setNewChildForm({ ...newChildForm, grade: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                >
                  {(GRADE_OPTIONS[newChildForm.stage] || []).map((gr) => (
                    <option key={gr} value={gr}>
                      {gr}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddChild(false)}>
                取消
              </button>
              <button type="button" className="btn-primary" onClick={handleAddChild} disabled={saving || !newChildForm.name.trim()}>
                {saving ? "添加中..." : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward Settings Modal */}
      {rewardChild && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setRewardChild(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px" }}>
              {rewardChild.name}的奖励与达标线设置
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "14px" }}>
              设定每天完成任务百分比达标线，达到该比例才累计连胜天数：
            </p>

            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
              每日打卡达标比例 (%)
            </label>
            <input
              type="number"
              min={10}
              max={100}
              value={rewardThreshold}
              onChange={(e) => setRewardThreshold(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={() => setRewardChild(null)}>
                取消
              </button>
              <button type="button" className="btn-primary" onClick={saveRewardSettings} disabled={saving}>
                {saving ? "保存中..." : "保存设置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Routine Task Modal */}
      {showAddRoutine && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowAddRoutine(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px" }}>添加每周循环例行任务</h3>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
              任务名称 *
            </label>
            <input
              type="text"
              placeholder="如：课外阅读30分钟、跳绳、整理书包..."
              value={routineForm.title}
              onChange={(e) => setRoutineForm({ ...routineForm, title: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "12px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  预计时长 (分钟)
                </span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={routineForm.minutes}
                  onChange={(e) => setRoutineForm({ ...routineForm, minutes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  奖励星星
                </span>
                <select
                  value={routineForm.stars}
                  onChange={(e) => setRoutineForm({ ...routineForm, stars: parseInt(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "0 星" : "⭐".repeat(n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "6px" }}>
              循环星期 (多选)
            </label>
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
              {WEEKDAYS.map((w) => {
                const checked = routineForm.weekdays.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWeekday(w.id)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      borderRadius: "6px",
                      border: checked ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                      backgroundColor: checked ? "var(--accent-light)" : "var(--card-subtle)",
                      color: checked ? "var(--accent)" : "var(--muted)",
                      fontWeight: checked ? 700 : 500,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                backgroundColor: "var(--card-subtle)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                marginBottom: "16px",
              }}
            >
              <input
                type="checkbox"
                checked={routineForm.require_approval}
                onChange={(e) => setRoutineForm({ ...routineForm, require_approval: e.target.checked })}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>需家长审核确认</span>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddRoutine(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveRoutine}
                disabled={saving || !routineForm.title.trim() || routineForm.weekdays.length === 0}
              >
                {saving ? "保存中..." : "保存例行任务"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Streak Freeze Management Modal */}
      {freezeModalChild && (
        <StreakFreezeModal
          isOpen={Boolean(freezeModalChild)}
          onClose={() => setFreezeModalChild(null)}
          token={token}
          childId={freezeModalChild.id}
          childName={freezeModalChild.name}
          onUpdated={loadFreezeData}
        />
      )}
    </div>
  );
}
