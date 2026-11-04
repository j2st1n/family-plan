import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import { useFeedback } from "../components/FeedbackContext.jsx";
import WarmEmptyState from "../components/WarmEmptyState.jsx";
import { UserGroupIcon, IpadIcon, RepeatIcon, ShieldFreezeIcon, ChevronRight, SparklesIcon, LockIcon, EyeIcon, EyeOffIcon } from "../components/Icons.jsx";

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

const AI_PRESETS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "ollama",
    label: "本地 Ollama",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:7b",
  },
  {
    id: "custom",
    label: "自定义中转",
    defaultBaseUrl: "",
    defaultModel: "gpt-4o-mini",
  },
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

  // AI Settings state
  const [aiSettings, setAiSettings] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiForm, setAiForm] = useState({
    provider: "deepseek",
    base_url: "https://api.deepseek.com/v1",
    api_key: "",
    model: "deepseek-chat",
    is_enabled: true,
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadAiSettings = useCallback(async () => {
    if (!token) return;
    setAiLoading(true);
    try {
      const data = await api.fetchAiSettings(token);
      setAiSettings(data);
      setAiForm({
        provider: data.provider || "deepseek",
        base_url: data.base_url || "https://api.deepseek.com/v1",
        api_key: "",
        model: data.model || "deepseek-chat",
        is_enabled: data.is_enabled ?? true,
      });
    } catch (err) {
      console.warn("加载 AI 设置失败", err);
    } finally {
      setAiLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAiSettings();
  }, [loadAiSettings]);

  const handleSelectAiProvider = (provId) => {
    const preset = AI_PRESETS.find((p) => p.id === provId);
    setAiForm((prev) => ({
      ...prev,
      provider: provId,
      base_url: preset?.defaultBaseUrl ?? prev.base_url,
      model: preset?.defaultModel ?? prev.model,
    }));
    setTestResult(null);
  };

  const handleSaveAiSettings = async () => {
    if (!token) return;
    setSavingAiSettings(true);
    try {
      const payload = {
        provider: aiForm.provider,
        base_url: aiForm.base_url.trim(),
        model: aiForm.model.trim() || "deepseek-chat",
        is_enabled: aiForm.is_enabled,
      };
      if (aiForm.api_key.trim()) {
        payload.api_key = aiForm.api_key.trim();
      }
      const updated = await api.updateAiSettings(token, payload);
      setAiSettings(updated);
      setAiForm((prev) => ({
        ...prev,
        provider: updated.provider,
        base_url: updated.base_url,
        model: updated.model,
        api_key: "",
        is_enabled: updated.is_enabled,
      }));
      toast.success("AI 智能助手设置已保存");
      setActiveDrawer(null);
    } catch (err) {
      toast.error("保存失败: " + (err.message || "未知错误"));
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleTestAiConnection = async () => {
    if (!token) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const payload = {
        provider: aiForm.provider,
        base_url: aiForm.base_url.trim(),
        model: aiForm.model.trim(),
      };
      if (aiForm.api_key.trim()) {
        payload.api_key = aiForm.api_key.trim();
      }
      const res = await api.testAiConnection(token, payload);
      setTestResult(res);
      if (res.success) {
        toast.success(`连接成功 (${res.latency_ms}ms)`);
      } else {
        toast.error(res.message || "探测失败");
      }
    } catch (err) {
      const errRes = { success: false, message: err.message || "连接失败" };
      setTestResult(errRes);
      toast.error(errRes.message);
    } finally {
      setTestingConnection(false);
    }
  };

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
      toast.success("连击保护卡规则已保存！");
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
      const defaultReason = freezeAdjustDelta > 0 ? "生病/突出表现特别奖励" : "家长手动调减";
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
      <div>
        <h2 className="ios-large-title">我的设置</h2>
        <p className="ios-page-subtitle">家庭档案、设备绑定与习惯规则设置</p>
      </div>

      {/* iOS 标准分组卡片 */}
      <div className="ios-grouped-card">
        {/* Item 1: 家庭与孩子档案 */}
        <button
          type="button"
          className="ios-list-row"
          onClick={() => setActiveDrawer("profiles")}
        >
          <div className="ios-squircle-icon squircle-blue">
            <UserGroupIcon size={18} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>家庭与孩子档案</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              {children.length > 0 ? `${children.length} 位孩子档案 · 学段与达标线` : "未配置孩子档案"}
            </span>
          </div>
          <ChevronRight size={16} />
        </button>

        {/* Item 2: iPad 设备访问码 */}
        <button
          type="button"
          className="ios-list-row"
          onClick={() => setActiveDrawer("accessCode")}
        >
          <div className="ios-squircle-icon squircle-teal">
            <IpadIcon size={18} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>iPad 设备访问码</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              儿童端登录配对 · 6 位动态安全码
            </span>
          </div>
          <ChevronRight size={16} />
        </button>

        {/* Item 3: 例行任务模板库 */}
        <button
          type="button"
          className="ios-list-row"
          onClick={() => setActiveDrawer("routineTasks")}
        >
          <div className="ios-squircle-icon squircle-orange">
            <RepeatIcon size={18} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>例行任务模板库</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              {routineTasks.length > 0 ? `${routineTasks.length} 项循环任务 · 每周固定习惯` : "每周固定循环习惯配置"}
            </span>
          </div>
          <ChevronRight size={16} />
        </button>

        {/* Item 4: 连击保护卡 */}
        <button
          type="button"
          className="ios-list-row"
          onClick={() => setActiveDrawer("freeze")}
        >
          <div className="ios-squircle-icon squircle-purple">
            <ShieldFreezeIcon size={18} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>连击保护卡</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              防断签护航 · 持有张数、兑换星数与月度补给
            </span>
          </div>
          <ChevronRight size={16} />
        </button>

        {/* Item 5: AI 智能助手 */}
        <button
          type="button"
          className="ios-list-row"
          onClick={() => setActiveDrawer("aiSettings")}
        >
          <div className="ios-squircle-icon squircle-indigo">
            <SparklesIcon size={18} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>✦ AI 智能助手</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              {aiSettings?.active_mode || "纯离线规则"} · 智能分词与任务解析
            </span>
          </div>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 账号退出操作区 */}
      <div className="ios-grouped-card">
        <button
          type="button"
          onClick={handleLogoutClick}
          className="ios-list-row"
          style={{ justifyContent: "center", color: "var(--danger)", fontWeight: 600, fontSize: "0.95rem" }}
        >
          退出登录
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
        <div className="ios-sheet-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setActiveDrawer(null)}
              >
                关闭
              </button>
              <span className="ios-sheet-header-title">家庭与孩子档案</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                onClick={() => setShowAddChild(true)}
              >
                添加孩子
              </button>
            </div>

            <div className="ios-sheet-body">
              {children.length === 0 ? (
                <WarmEmptyState
                  icon="child"
                  title="暂无孩子档案"
                  description="添加孩子档案，开始制定专属自律与成长打卡计划"
                  actionText="+ 添加第一位孩子"
                  onAction={() => setShowAddChild(true)}
                />
              ) : (
                <div className="ios-grouped-card">
                  {children.map((child, idx) => (
                    <div key={child.id}>
                      {idx > 0 && <div className="ios-separator" />}
                      <div
                        style={{
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          minHeight: "56px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "12px",
                              backgroundColor: "var(--accent-light)",
                              color: "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.05rem",
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
                                    padding: "2px 8px",
                                    borderRadius: "var(--radius-pill)",
                                    backgroundColor: "var(--card-hover, rgba(0,0,0,0.04))",
                                    color: "var(--muted)",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    lineHeight: 1.2,
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

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <button
                            type="button"
                            className="capsule-btn capsule-muted"
                            onClick={() => startEditChild(child)}
                            style={{ padding: "5px 12px", fontSize: "0.82rem" }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChild(child.id, child.name)}
                            title="删除档案"
                            style={{
                              background: "none",
                              border: "none",
                              padding: "6px",
                              cursor: "pointer",
                              color: "var(--muted)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "8px",
                              transition: "color 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
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
        <div className="ios-sheet-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <div style={{ width: 44 }} />
              <span className="ios-sheet-header-title">iPad 设备访问码</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                onClick={() => setActiveDrawer(null)}
              >
                完成
              </button>
            </div>

            <div className="ios-sheet-body">
              <p style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: "14px", lineHeight: 1.6 }}>
                在儿童 iPad 端打开应用并输入 6 位配对码即可自动绑定，24 小时内有效：
              </p>

              {children.length > 1 && (
                <div style={{ marginBottom: "16px" }}>
                  <div className="ios-group-label" style={{ margin: "0 0 6px 4px" }}>
                    选择绑定孩子
                  </div>
                  <div className="ios-segmented-control">
                    {children.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`ios-segmented-item ${selectedChildId === c.id ? "active" : ""}`}
                        onClick={() => {
                          setSelectedChildId(c.id);
                          setAccessCode("");
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 访问码展示卡 */}
              <div
                style={{
                  backgroundColor: "var(--card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "16px",
                  padding: "24px 16px",
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
                        letterSpacing: "0.25em",
                        color: "var(--accent)",
                        fontFamily: "monospace",
                        fontVariantNumeric: "tabular-nums",
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
                    <p style={{ fontSize: "0.86rem", color: "var(--muted)", marginBottom: "14px" }}>
                      轻点下方按钮为 {selectedChild?.name || "孩子"} 生成 6 位 iPad 配对码
                    </p>
                    <button
                      type="button"
                      className="ios-btn-primary"
                      onClick={handleGenerateCode}
                      disabled={codeLoading}
                      style={{
                        padding: "9px 24px",
                        fontSize: "0.92rem",
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
        <div className="ios-sheet-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setActiveDrawer(null)}
              >
                关闭
              </button>
              <span className="ios-sheet-header-title">例行任务模板库</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                onClick={() => setShowAddRoutine(true)}
              >
                新建例行
              </button>
            </div>

            <div className="ios-sheet-body">
              {children.length > 1 && (
                <div style={{ marginBottom: "16px" }}>
                  <div className="ios-group-label" style={{ margin: "0 0 6px 4px" }}>
                    当前孩子
                  </div>
                  <div className="ios-segmented-control">
                    {children.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`ios-segmented-item ${routineChildId === c.id ? "active" : ""}`}
                        onClick={() => setRoutineChildId(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
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
                <div className="ios-grouped-card">
                  {routineTasks.map((rt, idx) => {
                    const daysStr = (rt.repeat_weekdays || [])
                      .map((d) => ["", "一", "二", "三", "四", "五", "六", "日"][d])
                      .filter(Boolean)
                      .join("、");

                    return (
                      <div key={rt.id}>
                        {idx > 0 && <div className="ios-separator" />}
                        <div
                          style={{
                            padding: "12px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            minHeight: "52px",
                          }}
                        >
                          <div style={{ flex: 1, marginRight: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 650, fontSize: "0.92rem", color: "var(--text)" }}>
                                {rt.title}
                              </span>
                              <span style={{ fontSize: "0.78rem", color: "var(--star)", fontWeight: 700 }}>
                                ⭐{rt.reward_stars}
                              </span>
                              {rt.require_approval && (
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    backgroundColor: "var(--card-subtle)",
                                    border: "1px solid var(--border-subtle)",
                                    padding: "1px 6px",
                                    borderRadius: "var(--radius-pill)",
                                    color: "var(--muted)",
                                  }}
                                >
                                  需审核
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
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
          Drawer 4: 连击保护卡
          ========================================================================= */}
      {activeDrawer === "freeze" && (
        <div className="ios-sheet-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setActiveDrawer(null)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">连击保护卡</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                disabled={savingFreezeRules}
                onClick={handleSaveFreezeRules}
              >
                {savingFreezeRules ? "保存中…" : "保存"}
              </button>
            </div>

            <div className="ios-sheet-body">
              {children.length > 1 && (
                <div style={{ marginBottom: "16px" }}>
                  <div className="ios-group-label" style={{ margin: "0 0 6px 4px" }}>
                    管理孩子
                  </div>
                  <div className="ios-segmented-control">
                    {children.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`ios-segmented-item ${freezeChildId === c.id ? "active" : ""}`}
                        onClick={() => setFreezeChildId(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {freezeLoading && !freezeData ? (
                <p style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: "0.86rem" }}>
                  加载保护卡数据中…
                </p>
              ) : freezeData && (
                <div>
                  {/* 持有卡片与家长手动奖惩 */}
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
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>孩子当前拥有</div>
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
                          borderTop: "0.5px solid var(--separator)",
                        }}
                      >
                        <div style={{ fontSize: "0.78rem", fontWeight: 650, color: "var(--text)", marginBottom: "4px" }}>
                          {freezeAdjustDelta > 0 ? "发放保护卡理由 (选填):" : "调减保护卡理由 (选填):"}
                        </div>
                        <input
                          type="text"
                          placeholder={freezeAdjustDelta > 0 ? "如：生病特许免打卡、突出表现奖励..." : "如：家长手动调减、误发撤回..."}
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

                  {/* 保护卡规则设置卡片化：iOS 风格的紧凑设置行 (Setting Rows) */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", paddingLeft: "4px" }}>
                      规则设置
                    </div>
                    <div className="ios-setting-card">
                      {/* Row 1: 兑换星数 */}
                      <div className="ios-setting-row">
                        <div className="ios-row-label-group">
                          <span className="ios-row-title">兑换星数</span>
                          <span className="ios-row-hint">孩子在星星商城兑换单价</span>
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
                          <span className="ios-row-hint">达到上限后商城暂不可购</span>
                        </div>
                        <div className="pill-segment-group">
                          {[1, 2, 3, 5].map((lim) => (
                            <button
                              key={lim}
                              type="button"
                              className={`pill-segment-btn ${freezeMaxLimit === lim ? "active" : ""}`}
                              onClick={() => setFreezeMaxLimit(lim)}
                              style={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: "36px" }}
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
                              style={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: "36px" }}
                            >
                              {g === 0 ? "不赠送" : `${g}张`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 抵扣与流转历史记录 */}
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", paddingLeft: "4px" }}>
                      卡片变动记录
                    </div>
                    {(!freezeData.history || freezeData.history.length === 0) &&
                    (!freezeData.usages || freezeData.usages.length === 0) ? (
                      <WarmEmptyState
                        icon="freeze"
                        title="暂无使用记录"
                        description="当发生自动抵扣、商城兑换或家长手动调整时，记录将呈现在此。"
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
                              borderBottom: "0.5px solid var(--separator)",
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
          Drawer 5: AI 智能助手设置 (iOS Grouped Sheet)
          ========================================================================= */}
      {activeDrawer === "aiSettings" && (
        <div className="ios-sheet-overlay" onClick={() => setActiveDrawer(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setActiveDrawer(null)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">AI 智能助手</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                disabled={savingAiSettings}
                onClick={handleSaveAiSettings}
              >
                {savingAiSettings ? "保存中..." : "保存"}
              </button>
            </div>

            <div className="ios-sheet-body">
              {/* 模式状态横幅与说明 */}
              <div style={{ marginBottom: "16px", padding: "0 4px" }}>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  配置家长端大语言模型，用于一句话自然语言拆解任务与四维习惯分类。支持云端官方 API、自定义反向代理与本地局域网 Ollama 模型。
                </div>
              </div>

              {/* 卡片 0: 启用开关 */}
              <div className="ios-grouped-card" style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
                      启用 AI 助手
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      关闭后将始终使用极速确定性离线规则解析任务
                    </div>
                  </div>
                  <div
                    className={`ios-switch ${aiForm.is_enabled ? "on" : ""}`}
                    onClick={() => setAiForm((prev) => ({ ...prev, is_enabled: !prev.is_enabled }))}
                    role="switch"
                    aria-checked={aiForm.is_enabled}
                  >
                    <div className="ios-switch-thumb" />
                  </div>
                </div>
              </div>

              {/* 卡片 1: 服务商快捷分段器 */}
              <div className="ios-grouped-card" style={{ marginBottom: "16px", padding: "14px 16px" }}>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600, marginBottom: "10px" }}>
                  服务商快捷选择
                </div>
                <div className="ios-segmented-control" style={{ width: "100%" }}>
                  {AI_PRESETS.map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      className={`ios-segment-item ${aiForm.provider === prov.id ? "active" : ""}`}
                      onClick={() => handleSelectAiProvider(prov.id)}
                    >
                      {prov.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 卡片 2: Inset Grouped TableView 表单 (Base URL, API Key 带眼睛与加密锁, Model) */}
              <div className="ios-grouped-card" style={{ marginBottom: "16px" }}>
                {/* Row 1: Base URL */}
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 500, marginBottom: "4px" }}>
                    接口地址 (Base URL)
                  </div>
                  <input
                    type="text"
                    value={aiForm.base_url}
                    onChange={(e) => setAiForm({ ...aiForm, base_url: e.target.value })}
                    placeholder="https://api.deepseek.com/v1"
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: "0.95rem",
                      color: "var(--text)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="ios-separator" />

                {/* Row 2: API Key */}
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 500 }}>
                      API Key
                    </span>
                    {aiSettings?.has_api_key && !aiForm.api_key && (
                      <span style={{ fontSize: "0.72rem", color: "#34C759", fontWeight: 500 }}>
                        已配置并加密
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={aiForm.api_key}
                      onChange={(e) => setAiForm({ ...aiForm, api_key: e.target.value })}
                      placeholder={
                        aiSettings?.has_api_key
                          ? (aiSettings.api_key_masked || "sk-••••••••")
                          : (aiForm.provider === "ollama" ? "本地 Ollama 无需 Key (可留空)" : "请输入 sk- 开头的 API Key")
                      }
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: "0.95rem",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={showApiKey ? "隐藏密码" : "查看明文"}
                    >
                      {showApiKey ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "6px" }}>
                    <LockIcon size={12} color="var(--muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.35, wordBreak: "break-word" }}>
                      {aiSettings?.has_api_key && !aiForm.api_key
                        ? `当前状态：已安全加密 (${aiSettings.api_key_masked})，留空提交保持原配置`
                        : "AES-256-GCM 服务端密钥派生加密，零明文泄露风险"}
                    </span>
                  </div>
                </div>

                <div className="ios-separator" />

                {/* Row 3: Model 名称 */}
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 500, marginBottom: "4px" }}>
                    模型标识 (Model)
                  </div>
                  <input
                    type="text"
                    value={aiForm.model}
                    onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                    placeholder="deepseek-chat"
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: "0.95rem",
                      color: "var(--text)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* 卡片 3: 行内「测试连接」胶囊按钮，显示探测动画与绿色毫秒耗时/友好错误提示 */}
              <div className="ios-grouped-card" style={{ marginBottom: "16px", padding: "13px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)", marginBottom: "3px" }}>
                      连通性测试
                    </div>
                    <div style={{ fontSize: "0.76rem", lineHeight: 1.35 }}>
                      {testingConnection ? (
                        <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span className="probe-spinner" /> 正在向端点发送轻量 ping 探测...
                        </span>
                      ) : testResult ? (
                        testResult.success ? (
                          <span style={{ color: "#34C759", fontWeight: 600 }}>
                            ✓ {testResult.message}
                          </span>
                        ) : (
                          <span style={{ color: "var(--danger)" }}>
                            ✕ {testResult.message}
                          </span>
                        )
                      ) : (
                        <span style={{ color: "var(--muted)" }}>
                          测试当前 Base URL 与 Key 是否能正常响应模型请求
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="capsule-btn capsule-accent"
                    onClick={handleTestAiConnection}
                    disabled={testingConnection}
                    style={{ flexShrink: 0 }}
                  >
                    {testingConnection ? "探测中..." : "测试连接"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Sub-Modals: Edit Child, Add Child, Reward Settings, Add Routine
          ========================================================================= */}

      {/* Edit Child Modal (iOS 底部抽屉 Sheet) */}
      {editingChild && (
        <div className="ios-sheet-overlay" style={{ zIndex: 1100 }} onClick={() => setEditingChild(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setEditingChild(null)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">编辑孩子档案</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                disabled={saving || !editForm.name.trim()}
                onClick={saveEditChild}
              >
                保存
              </button>
            </div>

            <div className="ios-sheet-body">
              {/* Group 1: 档案基本信息 Inset Grouped */}
              <div className="ios-grouped-card" style={{ marginBottom: "18px" }}>
                <div style={{ padding: "12px 16px" }}>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="孩子姓名 (如：乐乐)"
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

                <div style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: "0.88rem", color: "var(--muted)", fontWeight: 500, marginBottom: "8px" }}>
                    学段
                  </div>
                  <div className="ios-segmented-control">
                    {Object.keys(GRADE_OPTIONS).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`ios-segmented-item ${editForm.stage === st ? "active" : ""}`}
                        onClick={() => {
                          const defaultGrades = GRADE_OPTIONS[st] || [];
                          setEditForm({ ...editForm, stage: st, grade: defaultGrades[0] || "" });
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ios-separator" />

                <div style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: "0.88rem", color: "var(--muted)", fontWeight: 500, marginBottom: "8px" }}>
                    年级
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(GRADE_OPTIONS[editForm.stage] || []).map((gr) => (
                      <button
                        key={gr}
                        type="button"
                        className={`pill-segment-btn ${editForm.grade === gr ? "active" : ""}`}
                        onClick={() => setEditForm({ ...editForm, grade: gr })}
                        style={{ padding: "6px 12px", fontSize: "0.82rem", borderRadius: "8px", whiteSpace: "nowrap" }}
                      >
                        {gr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Group 2: 连胜规则 */}
              <div className="ios-group-label" style={{ margin: "0 0 6px 16px" }}>连胜达标要求</div>
              <div className="ios-grouped-card" style={{ marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    每日连胜达标线
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={editForm.threshold}
                      onChange={(e) => setEditForm({ ...editForm, threshold: e.target.value })}
                      className="ios-time-input"
                      style={{ width: "64px", textAlign: "right" }}
                    />
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 650 }}>%</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--muted)", margin: "4px 16px 20px 16px", lineHeight: 1.4 }}>
                建议设置为 80%：完成当天 80% 任务即视为连胜达标。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Child Modal (iOS 底部抽屉 Sheet) */}
      {showAddChild && (
        <div className="ios-sheet-overlay" style={{ zIndex: 1100 }} onClick={() => setShowAddChild(false)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setShowAddChild(false)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">添加孩子档案</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                disabled={saving || !newChildForm.name.trim()}
                onClick={handleAddChild}
              >
                添加
              </button>
            </div>

            <div className="ios-sheet-body">
              <div className="ios-grouped-card" style={{ marginBottom: "20px" }}>
                <div style={{ padding: "12px 16px" }}>
                  <input
                    type="text"
                    value={newChildForm.name}
                    onChange={(e) => setNewChildForm({ ...newChildForm, name: e.target.value })}
                    placeholder="孩子姓名 (如：乐乐)"
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

                <div style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: "0.88rem", color: "var(--muted)", fontWeight: 500, marginBottom: "8px" }}>
                    学段
                  </div>
                  <div className="ios-segmented-control">
                    {Object.keys(GRADE_OPTIONS).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`ios-segmented-item ${newChildForm.stage === st ? "active" : ""}`}
                        onClick={() => {
                          const defaultGrades = GRADE_OPTIONS[st] || [];
                          setNewChildForm({ ...newChildForm, stage: st, grade: defaultGrades[0] || "" });
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ios-separator" />

                <div style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: "0.88rem", color: "var(--muted)", fontWeight: 500, marginBottom: "8px" }}>
                    年级
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(GRADE_OPTIONS[newChildForm.stage] || []).map((gr) => (
                      <button
                        key={gr}
                        type="button"
                        className={`pill-segment-btn ${newChildForm.grade === gr ? "active" : ""}`}
                        onClick={() => setNewChildForm({ ...newChildForm, grade: gr })}
                        style={{ padding: "6px 12px", fontSize: "0.82rem", borderRadius: "8px", whiteSpace: "nowrap" }}
                      >
                        {gr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reward Settings Modal (iOS 标准底部抽屉 Sheet) */}
      {rewardChild && (
        <div className="ios-sheet-overlay" style={{ zIndex: 1100 }} onClick={() => setRewardChild(null)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setRewardChild(null)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">{rewardChild.name} 连胜规则</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                disabled={saving}
                onClick={saveRewardSettings}
              >
                保存
              </button>
            </div>

            <div className="ios-sheet-body">
              <div className="ios-grouped-card" style={{ marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    {rewardChild.name} 的连胜达标标准
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      className="ios-time-input"
                      style={{ width: "64px", textAlign: "right" }}
                      value={rewardThreshold}
                      onChange={(e) => setRewardThreshold(e.target.value)}
                    />
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 650 }}>%</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--muted)", margin: "4px 16px 20px 16px", lineHeight: 1.4 }}>
                当天任务完成率达到此数值，即算作连胜坚持成功。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Routine Task Modal (iOS 标准底部抽屉 Sheet) */}
      {showAddRoutine && (
        <div className="ios-sheet-overlay" style={{ zIndex: 1100 }} onClick={() => setShowAddRoutine(false)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setShowAddRoutine(false)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">添加例行任务</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                disabled={saving || !routineForm.title.trim() || routineForm.weekdays.length === 0}
                onClick={handleSaveRoutine}
              >
                添加
              </button>
            </div>

            <div className="ios-sheet-body">
              {/* Group 1: 核心信息 Inset Grouped */}
              <div className="ios-grouped-card" style={{ marginBottom: "18px" }}>
                <div style={{ padding: "12px 16px" }}>
                  <input
                    type="text"
                    placeholder="任务名称，如：练琴20分钟、晨读15分钟..."
                    value={routineForm.title}
                    onChange={(e) => setRoutineForm({ ...routineForm, title: e.target.value })}
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

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    预计时长
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setRoutineForm((f) => ({ ...f, minutes: Math.max(5, (parseInt(f.minutes) || 20) - 5) }))}
                      className="ios-stepper-btn"
                    >
                      −
                    </button>
                    <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", minWidth: "44px", textAlign: "center" }}>
                      {routineForm.minutes || 20} 分钟
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoutineForm((f) => ({ ...f, minutes: Math.min(180, (parseInt(f.minutes) || 20) + 5) }))}
                      className="ios-stepper-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="ios-separator" />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    奖励星星
                  </span>
                  <div className="ios-segmented-control">
                    {[1, 2, 3, 5].map((starVal) => {
                      const active = routineForm.stars === starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setRoutineForm({ ...routineForm, stars: starVal })}
                          className={`ios-segmented-item ${active ? "active" : ""}`}
                        >
                          ⭐ {starVal}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Group 2: 每周循环设置 */}
              <div className="ios-group-label" style={{ margin: "0 0 6px 16px" }}>每周重复日</div>
              <div className="ios-grouped-card" style={{ padding: "10px 14px", marginBottom: "18px" }}>
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
                          minWidth: 0,
                          padding: "6px 0",
                          textAlign: "center",
                          backgroundColor: isChecked ? "var(--accent)" : "rgba(118, 118, 128, 0.12)",
                          color: isChecked ? "#FFFFFF" : "var(--muted)",
                          fontWeight: isChecked ? 650 : 500,
                          borderRadius: "8px",
                          border: "none",
                          whiteSpace: "nowrap",
                          fontSize: "0.82rem",
                        }}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: 需家长审核 Inset Grouped */}
              <div className="ios-grouped-card" style={{ marginBottom: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }}>
                  <div>
                    <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                      需家长点赞确认发星
                    </span>
                    <p style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "2px" }}>
                      孩子打卡后不立即加星，需家长确认后发放
                    </p>
                  </div>
                  <div
                    className={`ios-switch ${routineForm.require_approval ? "on" : ""}`}
                    onClick={() => setRoutineForm({ ...routineForm, require_approval: !routineForm.require_approval })}
                  >
                    <div className="ios-switch-thumb" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
