import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import { useFeedback } from "../components/FeedbackContext.jsx";
import WarmEmptyState from "../components/WarmEmptyState.jsx";

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
  const { toast, confirm } = useFeedback();

  // Active modal drawer: 'profiles' | 'accessCode' | 'routineTasks' | 'freeze' | null
  const [activeDrawer, setActiveDrawer] = useState(null);

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

  const [saving, setSaving] = useState(false);

  // Streak Freeze Management state
  const [freezeChildId, setFreezeChildId] = useState(children[0]?.id || "");
  const [freezeData, setFreezeData] = useState(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
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
    try {
      const data = await api.fetchChildFreeze(token, freezeChildId);
      setFreezeData(data);
      setFreezeStarCost(data.star_cost ? String(Number(data.star_cost)) : "5");
      setFreezeMaxLimit(data.max_limit ?? 2);
      setFreezeMonthlyGrant(data.monthly_grant ?? 1);
    } catch (err) {
      toast.error("加载保护卡数据失败: " + (err.message || "未知错误"));
    } finally {
      setFreezeLoading(false);
    }
  }, [token, freezeChildId, toast]);

  useEffect(() => {
    if (activeDrawer === "freeze") {
      loadFreezeData();
    }
  }, [activeDrawer, loadFreezeData]);

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
  }, [children, selectedChildId, routineChildId, freezeChildId]);

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
      toast.success("访问码生成成功！");
    } catch (err) {
      toast.error(`生成访问码失败：${err.message}`);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!accessCode) return;
    navigator.clipboard.writeText(accessCode).then(
      () => {
        setCopied(true);
        toast.success("访问码已复制到剪贴板！");
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setCopied(true);
        toast.success("访问码已复制到剪贴板！");
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
      toast.success("孩子档案已保存！");
      onRefreshChildren?.();
    } catch (err) {
      toast.error(`保存档案失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (childId, childName) => {
    const ok = await confirm({
      title: "删除孩子档案",
      message: `确定要删除孩子“${childName}”的所有档案与记录吗？此操作不可逆。`,
      confirmText: "确认删除",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteChild(token, childId);
      toast.success(`已删除孩子“${childName}”`);
      onRefreshChildren?.();
    } catch (err) {
      toast.error(`删除孩子失败：${err.message}`);
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
      toast.success("成功添加孩子档案！");
      onRefreshChildren?.();
    } catch (err) {
      toast.error(`添加孩子失败：${err.message}`);
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
      toast.success("奖励达标线已更新！");
      onRefreshChildren?.();
    } catch (err) {
      toast.error(`保存奖励达标线失败：${err.message}`);
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
      toast.success("已添加例行循环任务！");
      await loadRoutines();
    } catch (err) {
      toast.error(`添加例行任务失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoutine = async (templateId) => {
    if (!routinePlanId) return;
    const ok = await confirm({
      title: "删除例行任务",
      message: "确定要删除这个例行循环任务吗？",
      confirmText: "删除",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteRoutineTask(token, routinePlanId, templateId);
      toast.success("已删除例行任务");
      await loadRoutines();
    } catch (err) {
      toast.error(`删除例行任务失败：${err.message}`);
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

  // Streak Freeze Actions
  const handleSaveFreezeRules = async () => {
    if (!freezeChildId) return;
    setSavingFreezeRules(true);
    try {
      const updated = await api.updateFreezeSettings(token, freezeChildId, {
        star_cost: Number(freezeStarCost),
        max_limit: Number(freezeMaxLimit),
        monthly_grant: Number(freezeMonthlyGrant),
      });
      setFreezeData(updated);
      toast.success("连击保护卡风控规则已保存！");
    } catch (err) {
      toast.error("保存保护卡规则失败: " + (err.message || "未知错误"));
    } finally {
      setSavingFreezeRules(false);
    }
  };

  const handleAdjustFreeze = async () => {
    if (!freezeChildId || freezeAdjustDelta === null) return;
    setAdjustingFreeze(true);
    try {
      const defaultReason = freezeAdjustDelta > 0 ? "生病/突出表现特别奖励" : "家长手动调减纠偏";
      const reason = freezeAdjustReason.trim() || defaultReason;
      const updated = await api.adjustChildFreeze(token, freezeChildId, freezeAdjustDelta, reason);
      setFreezeData(updated);
      toast.success(freezeAdjustDelta > 0 ? "已成功发放 1 张连击保护卡！" : "已成功扣除 1 张保护卡！");
      setFreezeAdjustDelta(null);
      setFreezeAdjustReason("");
    } catch (err) {
      toast.error("操作失败: " + (err.message || "未知错误"));
    } finally {
      setAdjustingFreeze(false);
    }
  };

  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0];
  const routineChild = children.find((c) => c.id === routineChildId) || children[0];

  const handleLogoutClick = async () => {
    // Replaces legacy window.confirm with hand-drawn journal confirm dialog
    const ok = await confirm({
      title: "退出登录",
      message: "确定要退出当前登录吗？退出后需要重新输入用户名与密码。",
      confirmText: "退出当前登录",
      cancelText: "取消",
      isDestructive: true,
    });
    if (ok) {
      onLogout?.();
    }
  };

  return (
    <div className="settings-page" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 视觉脱水：页面大标题（剔除泛滥的 Emoji，保留文字排版层级） */}
      <div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
          我的设置
        </h2>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
          家庭档案、设备绑定与习惯风控管理
        </p>
      </div>

      {/* 架构收拢：主页改为清爽的分组列表，页面垂直高度压缩 65% 以上 */}
      <div className="setting-group-card">
        {/* Item 1: 家庭与孩子档案 */}
        <button
          type="button"
          className="setting-row-item"
          onClick={() => setActiveDrawer("profiles")}
        >
          <div className="setting-row-left">
            <span className="setting-row-title">家庭与孩子档案</span>
            <span className="setting-row-subtitle">
              {children.length > 0 ? `${children.length} 位孩子档案 · 学段与达标线` : "未配置孩子档案"}
            </span>
          </div>
          <div className="setting-row-right">
            <span className="setting-row-chevron">›</span>
          </div>
        </button>

        {/* Item 2: iPad 设备访问码 */}
        <button
          type="button"
          className="setting-row-item"
          onClick={() => setActiveDrawer("accessCode")}
        >
          <div className="setting-row-left">
            <span className="setting-row-title">iPad 设备访问码</span>
            <span className="setting-row-subtitle">
              儿童端登录配对 · 6 位动态安全码
            </span>
          </div>
          <div className="setting-row-right">
            <span className="setting-row-chevron">›</span>
          </div>
        </button>

        {/* Item 3: 例行任务模板库 */}
        <button
          type="button"
          className="setting-row-item"
          onClick={() => setActiveDrawer("routineTasks")}
        >
          <div className="setting-row-left">
            <span className="setting-row-title">例行任务模板库</span>
            <span className="setting-row-subtitle">
              {routineTasks.length > 0 ? `${routineTasks.length} 项循环任务 · 每周固定习惯` : "每周固定循环习惯配置"}
            </span>
          </div>
          <div className="setting-row-right">
            <span className="setting-row-chevron">›</span>
          </div>
        </button>

        {/* Item 4: 连击保护卡与风控 */}
        <button
          type="button"
          className="setting-row-item"
          onClick={() => setActiveDrawer("freeze")}
        >
          <div className="setting-row-left">
            <span className="setting-row-title">连击保护卡与风控</span>
            <span className="setting-row-subtitle">
              防断签护航 · 库存调整、兑换星数与持有上限
            </span>
          </div>
          <div className="setting-row-right">
            <span className="setting-row-chevron">›</span>
          </div>
        </button>
      </div>

      {/* 账号退出操作区 */}
      <div style={{ marginTop: "4px" }}>
        <button
          type="button"
          onClick={handleLogoutClick}
          style={{
            width: "100%",
            color: "var(--danger)",
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontWeight: 650,
            fontSize: "0.9rem",
            padding: "13px 20px",
            cursor: "pointer",
            boxShadow: "var(--shadow-card)",
            transition: "all 0.15s ease",
            textAlign: "center",
          }}
        >
          退出当前登录
        </button>
      </div>

      {/* 版本号微型弱化置于底部 */}
      <div
        className="settings-version-footer"
        style={{
          textAlign: "center",
          fontSize: "0.72rem",
          color: "var(--muted)",
          opacity: 0.65,
          padding: "14px 0 20px 0",
        }}
      >
        Family Plan 亲子自律计划 · v1.2.0
      </div>

      {/* =========================================================================
          Drawer 1: 家庭与孩子档案
          ========================================================================= */}
      {activeDrawer === "profiles" && (
        <div className="hand-drawer-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="hand-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="drawer-header">
              <h3 className="drawer-header-title">家庭与孩子档案</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  className="capsule-btn capsule-accent"
                  onClick={() => setShowAddChild(true)}
                >
                  + 添加孩子
                </button>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setActiveDrawer(null)}
                  title="关闭"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {children.length === 0 ? (
                <WarmEmptyState
                  icon="child"
                  title="暂无孩子档案"
                  description="添加孩子档案，开始制定专属自律与成长打卡计划"
                  actionText="+ 添加第一位孩子"
                  onAction={() => setShowAddChild(true)}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {children.map((child) => (
                    <div
                      key={child.id}
                      style={{
                        backgroundColor: "var(--card-subtle)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "12px",
                            backgroundColor: "var(--accent-light)",
                            color: "var(--accent)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1rem",
                            fontWeight: 700,
                            border: "1px solid var(--accent-pill)",
                          }}
                        >
                          {child.name.slice(0, 1)}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                              {child.name}
                            </span>
                            {child.grade_label && (
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "1px 6px",
                                  borderRadius: "var(--radius-pill)",
                                  backgroundColor: "var(--card)",
                                  border: "1px solid var(--border)",
                                  color: "var(--muted)",
                                }}
                              >
                                {child.grade_label}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "2px" }}>
                            奖励达标线: {child.streak_threshold ?? 80}%
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="capsule-btn capsule-muted"
                          onClick={() => startEditChild(child)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="capsule-btn capsule-muted"
                          onClick={() => openRewardSettings(child)}
                        >
                          达标线
                        </button>
                        <button
                          type="button"
                          className="capsule-btn capsule-danger"
                          onClick={() => handleDeleteChild(child.id, child.name)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Drawer 2: iPad 设备访问码
          ========================================================================= */}
      {activeDrawer === "accessCode" && (
        <div className="hand-drawer-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="hand-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="drawer-header">
              <h3 className="drawer-header-title">iPad 设备访问码</h3>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setActiveDrawer(null)}
                title="关闭"
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              <p style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: "14px", lineHeight: 1.6 }}>
                在儿童 iPad 端打开应用并输入 6 位配对码即可自动绑定，24 小时内有效：
              </p>

              {children.length > 1 && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                    选择绑定孩子:
                  </label>
                  <select
                    value={selectedChildId}
                    onChange={(e) => {
                      setSelectedChildId(e.target.value);
                      setAccessCode("");
                    }}
                    className="form-input-journal"
                    style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                  >
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 访问码展示卡 */}
              <div
                style={{
                  backgroundColor: "var(--card-subtle)",
                  border: "1.5px dashed var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "20px 16px",
                  textAlign: "center",
                  marginBottom: "16px",
                }}
              >
                {accessCode ? (
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "6px" }}>
                      {selectedChild?.name} 的 6 位设备访问码
                    </div>
                    <div
                      style={{
                        fontSize: "2.4rem",
                        fontWeight: 800,
                        letterSpacing: "0.35em",
                        color: "var(--accent)",
                        fontFamily: "monospace",
                        padding: "4px 0",
                      }}
                    >
                      {accessCode}
                    </div>
                    <div style={{ marginTop: "12px", display: "flex", justifyContent: "center", gap: "10px" }}>
                      <button
                        type="button"
                        className="capsule-btn capsule-accent"
                        onClick={handleCopyCode}
                        style={{ padding: "6px 18px", fontSize: "0.84rem" }}
                      >
                        {copied ? "已复制 ✓" : "一键复制"}
                      </button>
                      <button
                        type="button"
                        className="capsule-btn capsule-muted"
                        onClick={handleGenerateCode}
                        disabled={codeLoading}
                        style={{ padding: "6px 14px", fontSize: "0.84rem" }}
                      >
                        {codeLoading ? "生成中…" : "重新生成"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: "0.86rem", color: "var(--muted)", marginBottom: "12px" }}>
                      点击下方按钮为 {selectedChild?.name || "孩子"} 生成 6 位 iPad 配对码
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleGenerateCode}
                      disabled={codeLoading}
                      style={{
                        padding: "8px 24px",
                        fontSize: "0.88rem",
                        borderRadius: "var(--radius-pill)",
                      }}
                    >
                      {codeLoading ? "正在生成…" : "生成 6 位访问码"}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6, padding: "0 4px" }}>
                💡 <strong>使用方法：</strong>
                <ol style={{ paddingLeft: "18px", marginTop: "4px" }}>
                  <li>在 iPad Safari 打开儿童打卡端；</li>
                  <li>选择或输入上方 6 位访问码；</li>
                  <li>配对完成后即可免密码打卡。</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Drawer 3: 例行任务模板库
          ========================================================================= */}
      {activeDrawer === "routineTasks" && (
        <div className="hand-drawer-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="hand-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="drawer-header">
              <h3 className="drawer-header-title">例行任务模板库</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  className="capsule-btn capsule-accent"
                  onClick={() => setShowAddRoutine(true)}
                >
                  + 添加循环任务
                </button>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setActiveDrawer(null)}
                  title="关闭"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {children.length > 1 && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                    当前孩子:
                  </label>
                  <select
                    value={routineChildId}
                    onChange={(e) => setRoutineChildId(e.target.value)}
                    className="form-input-journal"
                    style={{ padding: "6px 10px", fontSize: "0.85rem" }}
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
                <WarmEmptyState
                  icon="task"
                  title="暂无例行任务"
                  description="为孩子配置工作日或周末固定循环打卡任务，到期系统将自动生成。"
                  actionText="+ 添加第一条例行任务"
                  onAction={() => setShowAddRoutine(true)}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {routineTasks.map((rt) => {
                    const daysStr = (rt.repeat_weekdays || [])
                      .map((d) => ["", "一", "二", "三", "四", "五", "六", "日"][d])
                      .filter(Boolean)
                      .join("、");

                    return (
                      <div
                        key={rt.id}
                        style={{
                          backgroundColor: "var(--card-subtle)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 650, fontSize: "0.9rem", color: "var(--text)" }}>
                              {rt.title}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--star)", fontWeight: 700 }}>
                              ⭐{rt.reward_stars}
                            </span>
                            {rt.require_approval && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  backgroundColor: "var(--card)",
                                  border: "1px solid var(--border)",
                                  padding: "1px 5px",
                                  borderRadius: "var(--radius-pill)",
                                  color: "var(--muted)",
                                }}
                              >
                                需审核
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "3px" }}>
                            时长 {rt.expected_minutes} 分钟 · 每周 {daysStr || "每天"}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="capsule-btn capsule-danger"
                          onClick={() => handleDeleteRoutine(rt.id)}
                        >
                          删除
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Drawer 4: 连击保护卡与风控
          ========================================================================= */}
      {activeDrawer === "freeze" && (
        <div className="hand-drawer-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="hand-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="drawer-header">
              <h3 className="drawer-header-title">连击保护卡与风控</h3>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setActiveDrawer(null)}
                title="关闭"
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {children.length > 1 && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                    管理孩子:
                  </label>
                  <select
                    value={freezeChildId}
                    onChange={(e) => setFreezeChildId(e.target.value)}
                    className="form-input-journal"
                    style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                  >
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {freezeLoading && !freezeData ? (
                <p style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: "0.86rem" }}>
                  加载保护卡数据中…
                </p>
              ) : freezeData && (
                <div>
                  {/* 库存卡片与家长手动奖惩 */}
                  <div
                    style={{
                      backgroundColor: "var(--card-subtle)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius)",
                      padding: "14px 16px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>当前可用库存</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "2px" }}>
                          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--protect)" }}>
                            {freezeData.available_count}
                          </span>
                          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                            / 上限 {freezeData.max_limit} 张
                          </span>
                          {freezeData.available_count >= freezeData.max_limit && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "1px 6px",
                                borderRadius: "var(--radius-pill)",
                                backgroundColor: "var(--card)",
                                border: "1px solid var(--border)",
                                color: "var(--muted)",
                              }}
                            >
                              已满
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="capsule-btn capsule-muted"
                          disabled={freezeData.available_count <= 0}
                          onClick={() => {
                            setFreezeAdjustDelta(-1);
                            setFreezeAdjustReason("");
                          }}
                          style={{
                            opacity: freezeData.available_count <= 0 ? 0.4 : 1,
                            cursor: freezeData.available_count <= 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          - 扣除 1 张
                        </button>
                        <button
                          type="button"
                          className="capsule-btn capsule-accent"
                          onClick={() => {
                            setFreezeAdjustDelta(1);
                            setFreezeAdjustReason("");
                          }}
                        >
                          + 奖励 1 张
                        </button>
                      </div>
                    </div>

                    {/* Manual Adjust Reason Box */}
                    {freezeAdjustDelta !== null && (
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop: "1px dashed var(--border)",
                        }}
                      >
                        <div style={{ fontSize: "0.78rem", fontWeight: 650, color: "var(--text)", marginBottom: "4px" }}>
                          {freezeAdjustDelta > 0 ? "发放保护卡理由 (选填):" : "调减保护卡理由 (选填):"}
                        </div>
                        <input
                          type="text"
                          placeholder={freezeAdjustDelta > 0 ? "如：生病特许免死金牌、突出表现奖励..." : "如：家长手动纠偏调减..."}
                          value={freezeAdjustReason}
                          onChange={(e) => setFreezeAdjustReason(e.target.value)}
                          className="form-input-journal"
                          style={{ fontSize: "0.82rem", padding: "6px 10px", marginBottom: "8px" }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            type="button"
                            className="capsule-btn capsule-muted"
                            onClick={() => setFreezeAdjustDelta(null)}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className={freezeAdjustDelta > 0 ? "capsule-btn capsule-accent" : "capsule-btn capsule-danger"}
                            disabled={adjustingFreeze}
                            onClick={handleAdjustFreeze}
                          >
                            {adjustingFreeze ? "提交中…" : "确认调整"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 保护卡风控设置卡片化：iOS 风格的紧凑设置行 (Setting Rows) */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", paddingLeft: "4px" }}>
                      规则与风控设定
                    </div>
                    <div className="ios-setting-card">
                      {/* Row 1: 兑换星数 */}
                      <div className="ios-setting-row">
                        <div className="ios-row-label-group">
                          <span className="ios-row-title">兑换星数</span>
                          <span className="ios-row-hint">孩子在星星商城购买单价</span>
                        </div>
                        <div className="compact-stepper">
                          <button
                            type="button"
                            className="stepper-btn"
                            disabled={Number(freezeStarCost) <= 1}
                            onClick={() => setFreezeStarCost((v) => String(Math.max(1, Number(v) - 1)))}
                          >
                            -
                          </button>
                          <span className="stepper-val">{freezeStarCost} 星</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            disabled={Number(freezeStarCost) >= 50}
                            onClick={() => setFreezeStarCost((v) => String(Math.min(50, Number(v) + 1)))}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Row 2: 最大持有上限 */}
                      <div className="ios-setting-row">
                        <div className="ios-row-label-group">
                          <span className="ios-row-title">持有上限</span>
                          <span className="ios-row-hint">防囤积：达上限后商城禁止购买</span>
                        </div>
                        <div className="pill-segment-group">
                          {[1, 2, 3, 5].map((lim) => (
                            <button
                              key={lim}
                              type="button"
                              className={`pill-segment-btn ${freezeMaxLimit === lim ? "active" : ""}`}
                              onClick={() => setFreezeMaxLimit(lim)}
                            >
                              {lim}张
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Row 3: 每月初自动补给 */}
                      <div className="ios-setting-row">
                        <div className="ios-row-label-group">
                          <span className="ios-row-title">每月初补给</span>
                          <span className="ios-row-hint">每月1日自动赠送额度 (不超过上限)</span>
                        </div>
                        <div className="pill-segment-group">
                          {[0, 1, 2].map((g) => (
                            <button
                              key={g}
                              type="button"
                              className={`pill-segment-btn ${freezeMonthlyGrant === g ? "active" : ""}`}
                              onClick={() => setFreezeMonthlyGrant(g)}
                            >
                              {g === 0 ? "不赠送" : `${g}张`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      disabled={savingFreezeRules}
                      onClick={handleSaveFreezeRules}
                      style={{
                        width: "100%",
                        padding: "8px 16px",
                        fontSize: "0.85rem",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {savingFreezeRules ? "保存规则中…" : "保存规则修改"}
                    </button>
                  </div>

                  {/* 抵扣与流转历史流水 */}
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", paddingLeft: "4px" }}>
                      流转明细流水
                    </div>
                    {(!freezeData.history || freezeData.history.length === 0) &&
                    (!freezeData.usages || freezeData.usages.length === 0) ? (
                      <WarmEmptyState
                        icon="freeze"
                        title="暂无流转记录"
                        description="当发生自动抵扣、商城兑换或家长手动奖惩时，流转明细将自动呈现在此。"
                      />
                    ) : (
                      <div
                        style={{
                          backgroundColor: "var(--card-subtle)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius)",
                          padding: "10px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          maxHeight: "180px",
                          overflowY: "auto",
                        }}
                      >
                        {(freezeData.history || []).map((h) => (
                          <div
                            key={h.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.78rem",
                              padding: "4px 0",
                              borderBottom: "1px dashed var(--border-subtle)",
                            }}
                          >
                            <span style={{ color: "var(--text)" }}>
                              {h.delta > 0 ? "奖励" : "扣除"} {formatLogDate(h.created_at)}
                              {h.reason ? ` · ${h.reason}` : ""}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: h.delta > 0 ? "var(--accent)" : "var(--flame)",
                              }}
                            >
                              {h.delta > 0 ? `+${h.delta}` : h.delta} 张
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Sub-Modals: Edit Child, Add Child, Reward Settings, Add Routine
          ========================================================================= */}

      {/* Edit Child Modal */}
      {editingChild && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1100,
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
              maxWidth: "400px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-hover)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>
              编辑孩子档案
            </h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                孩子姓名 *
              </label>
              <input
                type="text"
                className="form-input-journal"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="如：乐乐"
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  学段
                </label>
                <select
                  className="form-input-journal"
                  value={editForm.stage}
                  onChange={(e) => {
                    const st = e.target.value;
                    const defaultGrades = GRADE_OPTIONS[st] || [];
                    setEditForm({ ...editForm, stage: st, grade: defaultGrades[0] || "" });
                  }}
                >
                  {Object.keys(GRADE_OPTIONS).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  年级
                </label>
                <select
                  className="form-input-journal"
                  value={editForm.grade}
                  onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                >
                  {(GRADE_OPTIONS[editForm.stage] || []).map((gr) => (
                    <option key={gr} value={gr}>
                      {gr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                每日习惯连胜达标线 (%)
              </label>
              <input
                type="number"
                min={50}
                max={100}
                className="form-input-journal"
                value={editForm.threshold}
                onChange={(e) => setEditForm({ ...editForm, threshold: e.target.value })}
              />
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "2px", display: "block" }}>
                建议设置为 80%：完成当天 80% 任务即视为连胜达标
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="capsule-btn capsule-muted"
                onClick={() => setEditingChild(null)}
                style={{ padding: "7px 16px" }}
              >
                取消
              </button>
              <button
                type="button"
                className="capsule-btn capsule-accent"
                disabled={saving || !editForm.name.trim()}
                onClick={saveEditChild}
                style={{ padding: "7px 20px" }}
              >
                {saving ? "保存中…" : "保存修改"}
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
            zIndex: 1100,
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
              maxWidth: "380px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-hover)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>
              添加孩子档案
            </h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                孩子姓名 *
              </label>
              <input
                type="text"
                className="form-input-journal"
                value={newChildForm.name}
                onChange={(e) => setNewChildForm({ ...newChildForm, name: e.target.value })}
                placeholder="如：乐乐"
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  学段
                </label>
                <select
                  className="form-input-journal"
                  value={newChildForm.stage}
                  onChange={(e) => {
                    const st = e.target.value;
                    const defaultGrades = GRADE_OPTIONS[st] || [];
                    setNewChildForm({ ...newChildForm, stage: st, grade: defaultGrades[0] || "" });
                  }}
                >
                  {Object.keys(GRADE_OPTIONS).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  年级
                </label>
                <select
                  className="form-input-journal"
                  value={newChildForm.grade}
                  onChange={(e) => setNewChildForm({ ...newChildForm, grade: e.target.value })}
                >
                  {(GRADE_OPTIONS[newChildForm.stage] || []).map((gr) => (
                    <option key={gr} value={gr}>
                      {gr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="capsule-btn capsule-muted"
                onClick={() => setShowAddChild(false)}
                style={{ padding: "7px 16px" }}
              >
                取消
              </button>
              <button
                type="button"
                className="capsule-btn capsule-accent"
                disabled={saving || !newChildForm.name.trim()}
                onClick={handleAddChild}
                style={{ padding: "7px 20px" }}
              >
                {saving ? "添加中…" : "确认添加"}
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
            zIndex: 1100,
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
              maxWidth: "400px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-hover)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>
              {rewardChild.name} 的连胜奖励达标线
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                每日完成率达标阈值 (%)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  min={50}
                  max={100}
                  className="form-input-journal"
                  style={{ width: "90px" }}
                  value={rewardThreshold}
                  onChange={(e) => setRewardThreshold(e.target.value)}
                />
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  当天完成率 ≥ 此数值算作坚持成功
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="capsule-btn capsule-muted"
                onClick={() => setRewardChild(null)}
                style={{ padding: "7px 16px" }}
              >
                取消
              </button>
              <button
                type="button"
                className="capsule-btn capsule-accent"
                disabled={saving}
                onClick={saveRewardSettings}
                style={{ padding: "7px 20px" }}
              >
                {saving ? "保存中…" : "保存设定"}
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
            zIndex: 1100,
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
              maxWidth: "440px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-hover)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>
              为 {routineChild?.name} 添加每周循环例行任务
            </h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                任务名称 *
              </label>
              <input
                type="text"
                placeholder="如：练琴20分钟、晨读15分钟..."
                className="form-input-journal"
                value={routineForm.title}
                onChange={(e) => setRoutineForm({ ...routineForm, title: e.target.value })}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  预计时长 (分钟)
                </label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  className="form-input-journal"
                  value={routineForm.minutes}
                  onChange={(e) => setRoutineForm({ ...routineForm, minutes: e.target.value })}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  奖励星星
                </label>
                <select
                  className="form-input-journal"
                  value={routineForm.stars}
                  onChange={(e) => setRoutineForm({ ...routineForm, stars: parseInt(e.target.value) })}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "0 星" : `⭐ ${n} 星`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "6px" }}>
                每周循环日 (点击切换)
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                {WEEKDAYS.map((w) => {
                  const isChecked = routineForm.weekdays.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => toggleWeekday(w.id)}
                      className={`pill-segment-btn ${isChecked ? "active" : ""}`}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        textAlign: "center",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.84rem" }}>
                <input
                  type="checkbox"
                  checked={routineForm.require_approval}
                  onChange={(e) => setRoutineForm({ ...routineForm, require_approval: e.target.checked })}
                />
                <span>需要家长审核确认</span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="capsule-btn capsule-muted"
                onClick={() => setShowAddRoutine(false)}
                style={{ padding: "7px 16px" }}
              >
                取消
              </button>
              <button
                type="button"
                className="capsule-btn capsule-accent"
                disabled={saving || !routineForm.title.trim() || routineForm.weekdays.length === 0}
                onClick={handleSaveRoutine}
                style={{ padding: "7px 20px" }}
              >
                {saving ? "保存中…" : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
