import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { CATEGORIES, CATEGORY_ICONS, inferCategory } from "../utils/category.js";
import TaskCopilotModal from "../components/TaskCopilotModal.jsx";
import { useFeedback } from "../components/FeedbackContext.jsx";

function parseLocal(s) {
  if (!s || typeof s !== "string") return new Date();
  const parts = s.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return new Date();
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

function fmtDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(s, n) {
  const r = parseLocal(s);
  r.setDate(r.getDate() + n);
  return fmtDate(r);
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const todayStr = fmtDate(new Date());
  const d = parseLocal(dateStr);
  const weekDay = WEEKDAYS[d.getDay()] || "";
  if (dateStr === todayStr) {
    return `${dateStr} ${weekDay} (今天)`;
  }
  return `${dateStr} ${weekDay}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

function autoFillTime(minutes, start, end) {
  const dur = parseInt(minutes) || 0;
  if (!dur) return { start, end };
  if (start && !end) return { start, end: minutesToTime(timeToMinutes(start) + dur) };
  if (end && !start) return { start: minutesToTime(timeToMinutes(end) - dur), end };
  return { start, end };
}

export default function TodayDashboard({
  token,
  children = [],
  activeChild,
  onSelectChild,
  onRefreshMeta,
  onExpired,
  onNavigateSettings,
}) {
  const { toast, confirm } = useFeedback();

  const [date, setDate] = useState(() => fmtDate(new Date()));
  const [tasks, setTasks] = useState([]);
  const [plan, setPlan] = useState(null);
  const [rewards, setRewards] = useState({ stars_total: 0, current_streak_days: 0, streak_freeze_count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  // Modals state
  const [showCopilot, setShowCopilot] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Regular task form state
  const [taskForm, setTaskForm] = useState({
    title: "",
    minutes: "20",
    stars: 1,
    start: "",
    end: "",
    require_approval: false,
    category: "学习思考",
    categoryManuallySet: false,
  });

  // Per-child pending counts map { [childId]: count }
  const [childPendingMap, setChildPendingMap] = useState({});

  const childrenKey = children.map((c) => c.id).join(",");
  const activeChildId = activeChild?.id;

  // Load pending counts for child capsules
  const refreshPendingBadges = useCallback(async () => {
    if (!token || children.length === 0) return;
    const map = {};
    await Promise.all(
      children.map(async (c) => {
        try {
          const ds = await api.fetchDashboard(token, c.id);
          map[c.id] = ds?.today?.submitted_tasks ?? 0;
        } catch {
          map[c.id] = 0;
        }
      })
    );
    setChildPendingMap((prev) => {
      const prevJson = JSON.stringify(prev);
      const nextJson = JSON.stringify(map);
      return prevJson === nextJson ? prev : map;
    });
  }, [token, childrenKey]);

  useEffect(() => {
    refreshPendingBadges();
  }, [refreshPendingBadges]);

  // Load active plan and tasks for active child
  const loadChildData = useCallback(async (showLoadingSpinner = true) => {
    if (!token || !activeChildId) return;
    if (showLoadingSpinner) setLoading(true);
    setError("");
    try {
      const plans = await api.fetchPlans(token, activeChildId);
      let targetPlan = plans.find((p) => p.status === "active") || plans[0];
      if (!targetPlan) {
        // Create default plan
        targetPlan = await api.createPlan(token, {
          child_id: activeChildId,
          title: `${activeChild?.name || "孩子"}的每日计划`,
          start_date: fmtDate(new Date()),
        });
      }
      setPlan(targetPlan);
      const data = await api.fetchDailyTasks(token, targetPlan.id, date);
      setTasks(data.tasks || []);
      setRewards(data.rewards || { stars_total: 0, current_streak_days: 0, streak_freeze_count: 0 });
    } catch (err) {
      setError(`加载数据失败：${err.message}`);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, [token, activeChildId, date]);

  useEffect(() => {
    loadChildData(true);
  }, [loadChildData]);

  // SSE and visibility refresh: silent background sync without showing "加载中…" spinner!
  useSseRefresh({
    token,
    enabled: !!token,
    topics: ["tasks", "settings", "children"],
    childId: activeChildId,
    onRefresh: () => {
      loadChildData(false);
      refreshPendingBadges();
    },
    onExpired,
  });

  useVisibilityRefresh({
    enabled: !!token,
    onRefresh: () => {
      loadChildData(false);
      refreshPendingBadges();
    },
  });

  // 1-Click Approve
  const handleApprove = async (taskId) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      await api.approveTask(token, taskId);
      toast.success("已点赞发星！");
      await loadChildData();
      await refreshPendingBadges();
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`批准失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // 1-Click Reject
  const handleReject = async (taskId) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      await api.rejectTask(token, taskId);
      toast.info("已退回任务重做");
      await loadChildData();
      await refreshPendingBadges();
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`退回失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Approve all submitted tasks
  const handleApproveAll = async () => {
    const submitted = tasks.filter((t) => t.status === "submitted");
    if (submitted.length === 0 || actionInProgress) return;
    setActionInProgress(true);
    try {
      for (const t of submitted) {
        await api.approveTask(token, t.id);
      }
      toast.success(`已全部点赞批准 ${submitted.length} 项任务！`);
      await loadChildData();
      await refreshPendingBadges();
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`批量批准失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Revoke completed task
  const handleRevoke = async (taskId) => {
    if (actionInProgress) return;
    const ok = await confirm({
      title: "撤回任务",
      message: "确定要撤回此已完成任务吗？相应星星与连胜将自动回退。",
      confirmText: "确认撤回",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;

    setActionInProgress(true);
    try {
      await api.revokeTask(token, taskId);
      toast.success("已撤回任务并扣回奖励");
      await loadChildData();
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`撤回失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Parent manual mark complete (代打卡)
  const handleParentCheckTask = async (taskId) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      await api.checkTask(token, taskId);
      toast.success("代打卡成功并已发放奖励！");
      await loadChildData(false);
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`代打卡失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (actionInProgress || !plan) return;
    const ok = await confirm({
      title: "删除任务",
      message: "确定要删除这项日常任务吗？",
      confirmText: "删除",
      cancelText: "保留",
      isDestructive: true,
    });
    if (!ok) return;

    setActionInProgress(true);
    try {
      await api.deleteDailyTask(token, plan.id, taskId);
      toast.success("任务已删除");
      await loadChildData();
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`删除任务失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Open regular task add modal
  const openAddTaskModal = () => {
    setEditingTask(null);
    setTaskForm({
      title: "",
      minutes: "20",
      stars: 1,
      start: "",
      end: "",
      require_approval: false,
      category: "学习思考",
      categoryManuallySet: false,
    });
    setShowTaskModal(true);
  };

  // Open edit task modal
  const openEditTaskModal = (task) => {
    setEditingTask(task.id);
    const cat = inferCategory(task.title, task.description);
    setTaskForm({
      title: task.title || "",
      minutes: String(task.expected_minutes || 20),
      stars: task.reward_stars ?? 1,
      start: task.scheduled_start || "",
      end: task.scheduled_end || "",
      require_approval: !!task.require_approval,
      category: cat,
      categoryManuallySet: true,
    });
    setShowTaskModal(true);
  };

  // Handle title input change in regular task modal with automatic category inference
  const handleTitleChange = (val) => {
    const nextState = { ...taskForm, title: val };
    if (!taskForm.categoryManuallySet) {
      nextState.category = inferCategory(val);
    }
    setTaskForm(nextState);
  };

  // Select category capsule in regular modal
  const handleCategorySelect = (cat) => {
    setTaskForm({
      ...taskForm,
      category: cat,
      categoryManuallySet: true,
    });
  };

  // Save regular task modal
  const handleSaveRegularTask = async () => {
    if (!taskForm.title.trim() || !plan) return;
    const dur = parseInt(taskForm.minutes) || 20;
    const filled = autoFillTime(dur, taskForm.start, taskForm.end);

    setActionInProgress(true);
    try {
      if (editingTask) {
        await api.updateDailyTask(token, plan.id, editingTask, {
          title: taskForm.title.trim(),
          expected_minutes: dur,
          reward_stars: taskForm.stars,
          require_approval: !!taskForm.require_approval,
          scheduled_start: filled.start || null,
          scheduled_end: filled.end || null,
          description: `[${taskForm.category}]`,
        });
      } else {
        await api.createManualTasks(token, plan.id, date, [
          {
            title: taskForm.title.trim(),
            expected_minutes: dur,
            reward_stars: taskForm.stars,
            require_approval: !!taskForm.require_approval,
            scheduled_start: filled.start || null,
            scheduled_end: filled.end || null,
            description: `[${taskForm.category}]`,
          },
        ]);
      }
      setShowTaskModal(false);
      toast.success(editingTask ? "任务已更新！" : "已添加日常任务！");
      await loadChildData();
      onRefreshMeta?.();
    } catch (err) {
      toast.error(`保存任务失败：${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const submittedTasks = tasks.filter((t) => t.status === "submitted");
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  if (children.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px" }}>
        <span style={{ fontSize: "2.4rem", display: "block", marginBottom: "12px" }}>🌱</span>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>还没有添加孩子档案</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
          在“我的设置”中添加孩子后，即可在此查看今日看板与发布任务。
        </p>
        <button
          className="btn-primary"
          onClick={() => onNavigateSettings?.()}
        >
          ⚙️ 前往添加孩子
        </button>
      </div>
    );
  }

  return (
    <div className="today-dashboard">
      {error && (
        <div
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            marginBottom: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* 顶部平铺多孩切换胶囊 (ChildTabs) */}
      <div
        className="child-pills-bar"
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "8px",
          marginBottom: "12px",
          scrollbarWidth: "none",
        }}
      >
        {children.map((c) => {
          const isActive = c.id === activeChild?.id;
          const pCount = childPendingMap[c.id] || 0;
          return (
            <button
              key={c.id}
              onClick={() => onSelectChild(c.id)}
              className={`child-pill ${isActive ? "active" : ""}`}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "var(--radius-pill)",
                border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                backgroundColor: isActive ? "var(--accent-light)" : "var(--card)",
                color: isActive ? "var(--accent)" : "var(--text)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                boxShadow: isActive ? "0 2px 6px rgba(67, 106, 84, 0.15)" : "none",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{c.name}</span>
              {pCount > 0 && (
                <span
                  style={{
                    backgroundColor: "var(--flame)",
                    color: "#FFFFFF",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: "999px",
                    lineHeight: "1.2",
                  }}
                >
                  {pCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 日期选择与导航条 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--card-subtle)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "6px 10px",
          marginBottom: "14px",
        }}
      >
        <button
          onClick={() => setDate(addDays(date, -1))}
          style={{
            padding: "4px 8px",
            color: "var(--muted)",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="前一天"
        >
          ‹
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.95rem" }}>📅</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
            {formatDateDisplay(date)}
          </span>
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          style={{
            padding: "4px 8px",
            color: "var(--muted)",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="后一天"
        >
          ›
        </button>
      </div>

      {/* 置顶高亮【⏳ 待点赞任务 (Pending Approvals)】Hero 卡片 */}
      {submittedTasks.length > 0 && (
        <div
          className="pending-hero-card"
          style={{
            backgroundColor: "var(--star-bg)",
            border: "1.5px solid var(--star-border)",
            borderRadius: "var(--radius)",
            padding: "14px 16px",
            marginBottom: "16px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1.1rem" }}>⏳</span>
              <span style={{ fontWeight: 700, color: "var(--star)", fontSize: "0.95rem" }}>
                待点赞任务 ({submittedTasks.length} 项)
              </span>
            </div>
            {submittedTasks.length > 1 && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleApproveAll}
                disabled={actionInProgress}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.78rem",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                全部批准
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {submittedTasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "var(--card)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  border: "1px solid var(--star-border)",
                }}
              >
                <div>
                  <p style={{ fontWeight: 650, fontSize: "0.92rem", color: "var(--text)" }}>
                    {t.title}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                    用时 {t.expected_minutes || 20} 分钟 · ⭐+{t.reward_stars} · 孩子已打卡提交
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleApprove(t.id)}
                    disabled={actionInProgress}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.82rem",
                    }}
                  >
                    ⭐ 点赞发星
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleReject(t.id)}
                    disabled={actionInProgress}
                    style={{
                      padding: "5px 8px",
                      fontSize: "0.82rem",
                    }}
                  >
                    退回
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 今日进度概览卡片 */}
      <div
        className="today-progress-card"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
            今日已完成 {completedTasks.length} / {tasks.length} 项
          </h2>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "6px" }}>
            <span className="stat-chip">⭐ {formatStars(rewards.stars_total)} 星</span>
            <span className="stat-chip flame">🔥 {rewards.current_streak_days} 天连胜</span>
            {rewards.streak_freeze_count > 0 && (
              <span className="stat-chip protect">❄️ {rewards.streak_freeze_count} 卡</span>
            )}
          </div>
        </div>

        {/* Circular progress badge */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "var(--accent-light)",
            border: "2px solid var(--accent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
            {completionRate}%
          </span>
          <span style={{ fontSize: "0.62rem", color: "var(--muted)", marginTop: "1px" }}>完成度</span>
        </div>
      </div>

      {/* 快捷操作入口条 */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setShowCopilot(true)}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            backgroundColor: "var(--accent-light)",
            border: "1.5px solid var(--accent)",
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(67, 106, 84, 0.12)",
            transition: "all 0.18s ease",
          }}
        >
          <span>✨</span>
          <span>AI 一句话建任务</span>
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={openAddTaskModal}
          style={{
            flex: 1,
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            fontSize: "0.9rem",
          }}
        >
          <span>➕</span>
          <span>添加日常任务</span>
        </button>
      </div>

      {/* 今日任务清单 */}
      <div className="task-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
            📋 今日任务清单 ({tasks.length})
          </h3>
          {loading && (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>加载中…</span>
          )}
        </div>

        {tasks.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius)",
              border: "1px dashed var(--border)",
              color: "var(--muted)",
            }}
          >
            <p style={{ fontSize: "1.6rem", marginBottom: "6px" }}>📝</p>
            <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>今日暂无任务</p>
            <p style={{ fontSize: "0.78rem", marginTop: "4px" }}>
              点击上方【✨ AI 一句话建任务】或【➕ 添加日常任务】开始安排！
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* 1. 待完成任务 */}
          {pendingTasks.map((t) => {
            const cat = inferCategory(t.title, t.description);
            return (
              <div
                key={t.id}
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span style={{ fontSize: "0.85rem" }}>{CATEGORY_ICONS[cat] || "📚"}</span>
                    <span style={{ fontWeight: 650, fontSize: "0.92rem", color: "var(--text)" }}>
                      {t.title}
                    </span>
                    {t.require_approval && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--star)",
                          backgroundColor: "var(--star-bg)",
                          border: "1px solid var(--star-border)",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontWeight: 600,
                        }}
                      >
                        需审核
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    ⏱️ {t.expected_minutes || 20} 分钟 · ⭐ {t.reward_stars} 星
                    {t.scheduled_start && ` · ${t.scheduled_start}${t.scheduled_end ? `-${t.scheduled_end}` : ""}`}
                  </p>
                </div>

                <div className="task-action-cluster">
                  <button
                    type="button"
                    onClick={() => handleParentCheckTask(t.id)}
                    className="capsule-btn capsule-accent"
                    style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                    title="家长代为标记完成并给星"
                  >
                    代打卡
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => openEditTaskModal(t)}
                      className="task-micro-action"
                      title="编辑任务"
                      aria-label="编辑任务"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id)}
                      className="task-micro-action delete"
                      title="删除任务"
                      aria-label="删除任务"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 2. 已完成任务列表 */}
          {completedTasks.map((t) => (
            <div
              key={t.id}
              style={{
                backgroundColor: "var(--card-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: 0.85,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    textDecoration: "line-through",
                    color: "var(--muted)",
                    fontSize: "0.88rem",
                    fontWeight: 500,
                  }}
                >
                  ✓ {t.title}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "8px" }}>
                  (已赚得 ⭐+{t.reward_stars})
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(t.id)}
                style={{
                  padding: "3px 8px",
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  backgroundColor: "var(--card)",
                  cursor: "pointer",
                }}
              >
                撤回
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AI Copilot 抽屉模态框 */}
      <TaskCopilotModal
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
        token={token}
        child={activeChild}
        planId={plan?.id}
        targetDate={date}
        onSuccess={(createdDate) => {
          if (createdDate && createdDate !== date) {
            setDate(createdDate);
          } else {
            loadChildData(false);
          }
          onRefreshMeta?.();
        }}
      />

      {/* 常规添加/编辑任务模态框 */}
      {showTaskModal && (
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
          onClick={() => setShowTaskModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              backgroundColor: "var(--card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-hover)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>
              {editingTask ? "编辑任务" : "添加日常任务"}
            </h3>

            {/* Title */}
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
              任务名称 *
            </label>
            <input
              type="text"
              placeholder="如：练琴20分钟、口算一页、跳绳500下..."
              value={taskForm.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="form-input-journal"
              style={{ marginBottom: "12px" }}
            />

            {/* 四维习惯分类 4 选 1 胶囊 */}
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "6px" }}>
              四维习惯分类 (根据任务名自动推断，支持点击任意切换)
            </label>
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => {
                const isSelected = taskForm.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.82rem",
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: "var(--radius-pill)",
                      border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                      backgroundColor: isSelected ? "var(--accent-light)" : "var(--card-subtle)",
                      color: isSelected ? "var(--accent)" : "var(--muted)",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 2px 6px rgba(67, 106, 84, 0.15)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{CATEGORY_ICONS[cat]} {cat}</span>
                  </button>
                );
              })}
            </div>

            {/* Duration and Stars */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  预计时长 (分钟)
                </span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={taskForm.minutes}
                  onChange={(e) => setTaskForm({ ...taskForm, minutes: e.target.value })}
                  className="form-input-journal"
                />
              </label>

              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  奖励星星
                </span>
                <select
                  value={taskForm.stars}
                  onChange={(e) => setTaskForm({ ...taskForm, stars: parseInt(e.target.value) })}
                  className="form-input-journal"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "0 星" : "⭐".repeat(n) + ` (${n}星)`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Time range with purified journal style */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
              <label style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)" }}>
                    计划开始
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", opacity: 0.8 }}>HH:MM</span>
                </div>
                <input
                  type="text"
                  placeholder="19:00"
                  value={taskForm.start}
                  onChange={(e) => setTaskForm({ ...taskForm, start: e.target.value })}
                  className="form-input-journal"
                />
              </label>

              <label style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)" }}>
                    计划结束
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", opacity: 0.8 }}>自动推算</span>
                </div>
                <input
                  type="text"
                  placeholder="19:20"
                  value={taskForm.end}
                  onChange={(e) => setTaskForm({ ...taskForm, end: e.target.value })}
                  className="form-input-journal"
                />
              </label>
            </div>

            {/* Require Approval Checkbox */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: taskForm.require_approval ? "var(--star-bg)" : "var(--card-subtle)",
                border: taskForm.require_approval ? "1px solid var(--star-border)" : "1px solid var(--border)",
                cursor: "pointer",
                marginBottom: "18px",
              }}
            >
              <input
                type="checkbox"
                checked={taskForm.require_approval}
                onChange={(e) => setTaskForm({ ...taskForm, require_approval: e.target.checked })}
              />
              <span style={{ fontSize: "0.88rem", fontWeight: 650, color: taskForm.require_approval ? "var(--star)" : "var(--text)" }}>
                需家长点赞审核确认（孩子提交打卡后，需家长点赞发星）
              </span>
            </label>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowTaskModal(false)}
                disabled={actionInProgress}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveRegularTask}
                disabled={actionInProgress || !taskForm.title.trim()}
              >
                {actionInProgress ? "保存中..." : "保存任务"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
