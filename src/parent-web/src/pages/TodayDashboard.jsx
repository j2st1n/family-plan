import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { CATEGORIES, CATEGORY_ICONS, inferCategory } from "../utils/category.js";
import TaskCopilotModal from "../components/TaskCopilotModal.jsx";
import { useFeedback } from "../components/FeedbackContext.jsx";
import { CheckCircleIcon, SparklesIcon, PlusIcon } from "../components/Icons.jsx";

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

      {/* 顶部平铺多孩切换 (iOS Segmented Control) */}
      {children.length > 1 && (
        <div className="ios-segmented-control" style={{ marginBottom: "14px" }}>
          {children.map((c) => {
            const isActive = c.id === activeChild?.id;
            const pCount = childPendingMap[c.id] || 0;
            return (
              <button
                key={c.id}
                onClick={() => onSelectChild(c.id)}
                className={`ios-segment-item ${isActive ? "active" : ""}`}
              >
                <span>{c.name}</span>
                {pCount > 0 && (
                  <span
                    style={{
                      backgroundColor: "var(--flame)",
                      color: "#FFFFFF",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "0 5px",
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
      )}

      {/* 日期选择与导航条 (iOS 极简胶囊切换) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#FFFFFF",
          borderRadius: "10px",
          padding: "6px 14px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <button
          onClick={() => setDate(addDays(date, -1))
          }
          style={{
            padding: "4px 8px",
            color: "var(--accent)",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="前一天"
        >
          ‹
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {formatDateDisplay(date)}
          </span>
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          style={{
            padding: "4px 8px",
            color: "var(--accent)",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
            backgroundColor: "var(--card)",
            border: "1px solid #FFE5B5",
            borderRadius: "var(--radius)",
            padding: "16px",
            marginBottom: "16px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1.1rem" }}>⏳</span>
              <span style={{ fontWeight: 700, color: "var(--star)", fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
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
                  padding: "4px 12px",
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
                  backgroundColor: "#FFFDF9",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  border: "1px solid #FFE5B5",
                  boxShadow: "var(--shadow-sm)",
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

      {/* 今日进度概览卡片 (Apple Fitness / Activity Rings 风格) */}
      <div
        className="today-progress-card"
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.08rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px", letterSpacing: "-0.015em" }}>
            今日已完成 {completedTasks.length} / {tasks.length} 项
          </h2>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "8px", flexWrap: "wrap" }}>
            <span className="stat-chip">⭐ {formatStars(rewards.stars_total)} 星</span>
            <span className="stat-chip flame">🔥 {rewards.current_streak_days} 天连胜</span>
            {rewards.streak_freeze_count > 0 && (
              <span className="stat-chip protect">❄️ {rewards.streak_freeze_count} 卡</span>
            )}
          </div>
        </div>

        {/* Apple Fitness Activity Ring */}
        <div style={{ position: "relative", width: "76px", height: "76px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="76" height="76" viewBox="0 0 76 76" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle
              cx="38"
              cy="38"
              r="31"
              fill="none"
              stroke="#E5E5EA"
              strokeWidth="5.5"
            />
            <circle
              cx="38"
              cy="38"
              r="31"
              fill="none"
              stroke="#34C759"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 31}
              strokeDashoffset={2 * Math.PI * 31 * (1 - Math.min(100, Math.max(0, completionRate)) / 100)}
              style={{
                transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                filter: completionRate > 0 ? "drop-shadow(0 0 4px rgba(52, 199, 89, 0.3))" : "none",
              }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", lineHeight: "1.1", letterSpacing: "-0.03em" }}>
              {completionRate}%
            </span>
            <span style={{ fontSize: "0.62rem", color: "var(--muted)", fontWeight: 500, lineHeight: "1", marginTop: "2px" }}>
              达成
            </span>
          </div>
        </div>
      </div>

      {/* 快捷操作入口条：移动端（竖屏）全宽等分饱满易点；PC/平板大屏端靠右自适应不劈叉 */}
      <div className="today-actions-bar">
        <button
          type="button"
          onClick={() => setShowCopilot(true)}
          className="ios-btn-secondary today-action-btn"
        >
          <SparklesIcon size={16} />
          <span>AI 建议建任务</span>
        </button>

        <button
          type="button"
          className="ios-btn-primary today-action-btn"
          onClick={openAddTaskModal}
        >
          <PlusIcon size={16} />
          <span>添加日常任务</span>
        </button>
      </div>

      {/* 今日任务清单 (Apple Reminders 极简分组列表) */}
      <div className="task-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            padding: "0 4px",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
            今日任务 ({tasks.length})
          </h3>
          {loading && (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>加载中…</span>
          )}
        </div>

        {tasks.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 16px",
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "var(--shadow-sm)",
              color: "var(--muted)",
            }}
          >
            <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>今日暂无任务</p>
            <p style={{ fontSize: "0.78rem", marginTop: "4px" }}>
              轻点上方“添加日常任务”开始安排
            </p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="ios-grouped-card">
            {/* 1. 待完成任务 */}
            {pendingTasks.map((t) => {
              const cat = inferCategory(t.title, t.description);
              return (
                <div key={t.id} className="reminders-task-row">
                  <button
                    type="button"
                    className="reminders-checkbox-btn"
                    onClick={() => handleParentCheckTask(t.id)}
                    title="轻点打卡"
                  >
                    <CheckCircleIcon checked={false} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text)" }}>
                        {t.title}
                      </span>
                      <span className="ios-badge">{cat}</span>
                      {t.require_approval && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--star)",
                            backgroundColor: "var(--star-bg)",
                            border: "1px solid var(--star-border)",
                            padding: "1px 6px",
                            borderRadius: "999px",
                            fontWeight: 600,
                          }}
                        >
                          需审核
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {t.expected_minutes || 20} 分钟 · +{t.reward_stars} 星
                      {t.scheduled_start && ` · ${t.scheduled_start}${t.scheduled_end ? `-${t.scheduled_end}` : ""}`}
                    </p>
                  </div>
                  <div className="task-action-cluster">
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
              );
            })}

            {/* 2. 待点赞审核任务 (孩子已打卡提交，等待家长审核) */}
            {submittedTasks.map((t) => (
              <div key={t.id} className="reminders-task-row">
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--star-bg)",
                    border: "1px solid var(--star-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  title="等待家长点赞发星"
                >
                  <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>⏳</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text)" }}>
                      {t.title}
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--star)",
                        backgroundColor: "var(--star-bg)",
                        border: "1px solid var(--star-border)",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        fontWeight: 600,
                      }}
                    >
                      等待点赞
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {t.expected_minutes || 20} 分钟 · ⭐+{t.reward_stars} · 孩子已提交
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="capsule-btn capsule-accent"
                    onClick={() => handleApprove(t.id)}
                    disabled={actionInProgress}
                    style={{ padding: "4px 10px", fontSize: "0.74rem" }}
                  >
                    ⭐ 点赞发星
                  </button>
                  <button
                    type="button"
                    className="capsule-btn capsule-muted"
                    onClick={() => handleReject(t.id)}
                    disabled={actionInProgress}
                    style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                  >
                    退回
                  </button>
                </div>
              </div>
            ))}

            {/* 3. 已完成任务 */}
            {completedTasks.map((t) => (
              <div key={t.id} className="reminders-task-row">
                <button
                  type="button"
                  className="reminders-checkbox-btn"
                  onClick={() => handleRevoke(t.id)}
                  title="轻点撤销完成"
                >
                  <CheckCircleIcon checked={true} color="#34C759" />
                </button>
                <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: "0.92rem",
                        color: "var(--muted)",
                        textDecoration: "line-through",
                      }}
                    >
                      {t.title}
                    </span>
                    {t.require_approval && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "#34C759",
                          backgroundColor: "rgba(52, 199, 89, 0.12)",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          fontWeight: 600,
                        }}
                      >
                        已点赞发星
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                    已赚得 ⭐+{t.reward_stars}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(t.id)}
                  className="capsule-btn capsule-muted"
                  style={{ padding: "4px 10px", fontSize: "0.74rem" }}
                >
                  撤回
                </button>
              </div>
            ))}
          </div>
        )}
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

      {/* 常规添加/编辑任务模态框 (统一 iOS 底部拉出抽屉 Sheet) */}
      {showTaskModal && (
        <div className="ios-sheet-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setShowTaskModal(false)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">
                {editingTask ? "编辑任务" : "添加日常任务"}
              </span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                onClick={handleSaveRegularTask}
                disabled={actionInProgress || !taskForm.title.trim()}
              >
                {editingTask ? "保存" : "添加"}
              </button>
            </div>

            <div className="ios-sheet-body">
              {/* Group 1: 基本信息 Inset Grouped */}
              <div className="ios-grouped-card" style={{ marginBottom: "18px" }}>
                {/* 任务名称 */}
                <div style={{ padding: "12px 16px" }}>
                  <input
                    type="text"
                    placeholder="任务名称，如：练琴20分钟、口算一页..."
                    value={taskForm.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="form-input-journal"
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: "1.02rem",
                      color: "var(--text)",
                      fontFamily: "inherit",
                      padding: 0,
                      boxShadow: "none",
                    }}
                    autoFocus
                  />
                </div>

                <div className="ios-separator" />

                {/* 四维习惯分类 */}
                <div style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                      习惯分类
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {taskForm.category}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {CATEGORIES.map((cat) => {
                      const isSelected = taskForm.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className={`capsule-btn ${isSelected ? "capsule-accent" : "capsule-muted"}`}
                          style={{ padding: "4px 10px", fontSize: "0.76rem" }}
                        >
                          <span>{CATEGORY_ICONS[cat]} {cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="ios-separator" />

                {/* 预计时长 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    预计时长
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setTaskForm((f) => ({ ...f, minutes: Math.max(5, (parseInt(f.minutes) || 20) - 5) }))}
                      className="ios-stepper-btn"
                    >
                      −
                    </button>
                    <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", minWidth: "48px", textAlign: "center" }}>
                      {taskForm.minutes || 20} 分钟
                    </span>
                    <button
                      type="button"
                      onClick={() => setTaskForm((f) => ({ ...f, minutes: Math.min(240, (parseInt(f.minutes) || 20) + 5) }))}
                      className="ios-stepper-btn"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="ios-separator" />

                {/* 奖励星星 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    奖励星星
                  </span>
                  <div className="ios-segmented-control">
                    {[0, 1, 2, 3, 5].map((starVal) => {
                      const active = taskForm.stars === starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setTaskForm({ ...taskForm, stars: starVal })}
                          className={`ios-segmented-item ${active ? "active" : ""}`}
                        >
                          {starVal === 0 ? "0星" : `⭐ ${starVal}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Group 2: 时间安排 (可选) */}
              <div className="ios-group-label" style={{ margin: "0 0 6px 16px" }}>时间安排 (可选)</div>
              <div className="ios-grouped-card" style={{ marginBottom: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    计划开始
                  </span>
                  <input
                    type="time"
                    value={taskForm.start || ""}
                    onChange={(e) => setTaskForm({ ...taskForm, start: e.target.value })}
                    className="ios-time-input"
                  />
                </div>

                <div className="ios-separator" />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", minHeight: "48px" }}>
                  <span style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>
                    计划结束
                  </span>
                  <input
                    type="time"
                    value={taskForm.end || ""}
                    onChange={(e) => setTaskForm({ ...taskForm, end: e.target.value })}
                    className="ios-time-input"
                  />
                </div>
              </div>

              {/* Group 3: 需家长点赞审核确认 */}
              <div className="ios-grouped-card" style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text)" }}>
                      需家长点赞确认发星
                    </span>
                    <p style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "2px" }}>
                      孩子打卡后不立即加星，需家长审核后发放
                    </p>
                  </div>
                  <div
                    className={`ios-switch ${taskForm.require_approval ? "on" : ""}`}
                    onClick={() => setTaskForm({ ...taskForm, require_approval: !taskForm.require_approval })}
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
