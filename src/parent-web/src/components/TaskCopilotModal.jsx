import FieldLabel from "../../../shared-web/FieldLabel.jsx";
import RewardStars, {validReward} from "../../../shared-web/RewardStars.jsx";
import TaskTimingFields from "../../../shared-web/TaskTimingFields.jsx";
import {plannedEnd} from "../../../shared-web/taskTiming.js";
import { useState, useEffect } from "react";
import api from "../api.js";
import { CATEGORIES, CATEGORY_ICONS, inferCategory } from "../utils/category.js";

const QUICK_PROMPTS = [
  "今晚7点练琴20分钟给1星",
  "读绘本20分钟，跳绳500下(2星)",
  "整理书包15分钟 1星",
];

export default function TaskCopilotModal({
  isOpen,
  onClose,
  token,
  child,
  planId,
  targetDate,
  onSuccess,
}) {
  const [prompt, setPrompt] = useState("");
  const [taskDate, setTaskDate] = useState(() => targetDate || new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (targetDate) {
      setTaskDate(targetDate);
    }
  }, [targetDate]);

  if (!isOpen) return null;

  async function handleParse() {
    if (!prompt.trim()) {
      setError("请输入口语描述");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.parseCopilotTasks(token, {
        prompt: prompt.trim(),
        child_id: child?.id,
        target_date: taskDate,
      });
      setResult(res);
      if (res.resolved_date) {
        setTaskDate(res.resolved_date);
      }
    } catch (err) {
      setError(`解析失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdateTask(index, field, value) {
    if (!result?.tasks) return;
    const updated = [...result.tasks];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "title" && !updated[index]._categoryManuallySet) {
      updated[index].category = inferCategory(value);
    }
    setResult({ ...result, tasks: updated });
  }

  function handleTiming(index, patch) {
    const tasks=result.tasks.map((t,i)=>i===index?{...t,expected_minutes:Number(patch.minutes),start:patch.start,end:patch.end,scheduled_start:patch.start,scheduled_end:patch.end}:t);
    setResult({...result,tasks});
  }

  function handleSelectCategory(index, cat) {
    if (!result?.tasks) return;
    const updated = [...result.tasks];
    updated[index] = { ...updated[index], category: cat, _categoryManuallySet: true };
    setResult({ ...result, tasks: updated });
  }

  function handleDeleteDraft(index) {
    if (!result?.tasks) return;
    const updated = result.tasks.filter((_, i) => i !== index);
    setResult({ ...result, tasks: updated });
  }

  function handleAddEmptyDraft() {
    const newTask = {
      title: "新任务",
      expected_minutes: 20,
      reward_stars: 1,
      category: "学习思考",
      start: "",
      end: "",
      require_approval: false,
    };
    const currentTasks = result?.tasks || [];
    setResult({
      ...result,
      raw_summary: result?.raw_summary || "任务草稿箱",
      tasks: [...currentTasks, newTask],
    });
  }

  async function handlePublish() {
    if (!result?.tasks || result.tasks.length === 0) {
      setError("没有可发布的任务");
      return;
    }
    if (!planId) {
      setError("当前孩子未初始化学习计划，请先创建计划");
      return;
    }

    if (result.tasks.some(t=>!CATEGORIES.includes(t.category))) {setError("请为每个任务选择习惯分类");return;}
    if (result.tasks.some(t=>!validReward(t.reward_stars))) {setError("每个任务奖励都需要是1–99星的整数");return;}
    if (result.tasks.some(t=>Number(t.expected_minutes)%5!==0)) {setError("请将预计用时调整为5分钟的整数倍");return;}
    setPublishing(true);
    setError("");
    try {
      const payloadTasks = result.tasks.map((t) => ({
        title: (t.title || "").trim(),
        expected_minutes: parseInt(t.expected_minutes) || 20,
        reward_stars: parseInt(t.reward_stars) || 1,
        require_approval: !!t.require_approval,
        scheduled_start: (t.start ?? t.scheduled_start) || null,
        scheduled_end: plannedEnd(t.start ?? t.scheduled_start, t.expected_minutes).time || null,
        description: t.description || (t.category ? `[${t.category}]` : null),
      }));

      await api.createManualTasks(token, planId, taskDate, payloadTasks);
      onSuccess?.(taskDate);
      onClose();
    } catch (err) {
      setError(`发布任务失败：${err.message}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="ios-sheet-overlay" onClick={onClose}>
      <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle-bar" />
        {/* Header */}
        <div className="ios-sheet-header">
          <button
            type="button"
            className="ios-sheet-nav-btn"
            onClick={onClose}
          >
            取消
          </button>
          <span className="ios-sheet-header-title">
            AI 智能建任务
          </span>
          {result?.tasks?.length > 0 ? (
            <button
              type="button"
              className="ios-sheet-nav-action-btn"
              disabled={publishing}
              onClick={handlePublish}
            >
              {publishing ? "发布中…" : "发布"}
            </button>
          ) : (
            <div style={{ width: 44 }} />
          )}
        </div>

        {/* Content body */}
        <div className="ios-sheet-body">
          {error && (
            <div
              style={{
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          {/* Spoken prompt textarea */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 650, color: "var(--muted)", marginBottom: "6px" }}>
              口语描述想让孩子做的事：
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="如：每天晚上7点练琴20分钟给1星需确认；或明天上午读绘本20分钟，下午跳绳500下(2星)..."
              className="form-input-journal"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "0.9rem",
                borderRadius: "10px",
                resize: "none",
                marginBottom: "10px",
                boxSizing: "border-box",
              }}
            />

            {/* Quick chips */}
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "6px" }}>试试示例：</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {QUICK_PROMPTS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(q)}
                    className="capsule-btn capsule-muted"
                    style={{ fontSize: "0.76rem", padding: "5px 10px" }}
                  >
                    {q.length > 20 ? q.slice(0, 20) + "…" : q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="ios-btn-primary"
            onClick={handleParse}
            disabled={loading}
            style={{ width: "100%", padding: "12px", fontSize: "0.95rem", marginBottom: "18px" }}
          >
            {loading ? "正在智能解析中…" : "开始智能解析"}
          </button>

          {/* Parse Results Preview */}
          {result && (
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--accent)" }}>
                  💡 {result.raw_summary}
                </span>
                {result.is_degraded ? (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-pill)",
                      backgroundColor: "var(--card-subtle)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                    }}
                    title="模型响应超时或未开启，已由本地启发式规则毫秒级极速生成"
                  >
                    本地规则兜底
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-pill)",
                      backgroundColor: "#E8F8ED",
                      border: "1px solid #85E09B",
                      color: "#1E7B34",
                      fontWeight: 600,
                    }}
                  >
                    AI 深度生成
                  </span>
                )}
              </div>

              {/* Date preview / selector */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  backgroundColor: "var(--card-subtle)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 650, color: "var(--text)" }}>
                  📅 安排任务到日期：
                </span>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="ios-time-input"
                />
              </div>

              {/* Task drafts cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {result.tasks.map((task, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "var(--card-subtle)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "12px 14px",
                    }}
                  >
                    {/* Title and remove button */}
                    <label htmlFor={`draft-task-title-${idx}`} style={{display:"block",marginBottom:6}}><FieldLabel required>任务名称</FieldLabel></label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <input
                        type="text"
                        id={`draft-task-title-${idx}`} required
                        value={task.title}
                        onChange={(e) => handleUpdateTask(idx, "title", e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          padding: "6px 8px",
                          backgroundColor: "var(--card)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(idx)}
                        style={{
                          color: "var(--muted)",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                        }}
                        title="删除该草稿项"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Category 4-choice capsule */}
                    <div style={{marginBottom:6}}><FieldLabel required>习惯分类</FieldLabel></div>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "8px", overflowX: "auto" }}>
                      {CATEGORIES.map((cat) => {
                        const isSelected = task.category === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleSelectCategory(idx, cat)}
                            style={{
                              padding: "3px 8px",
                              fontSize: "0.75rem",
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: "var(--radius-pill)",
                              border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                              backgroundColor: isSelected ? "var(--accent-light)" : "var(--card)",
                              color: isSelected ? "var(--accent)" : "var(--muted)",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span>{CATEGORY_ICONS[cat]} {cat}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Meta row: duration, stars, times, approval */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div style={{width:"100%"}}><TaskTimingFields minutes={task.expected_minutes} start={task.start ?? task.scheduled_start ?? ""} onChange={patch=>handleTiming(idx,patch)}/></div>
                      <FieldLabel required>奖励星星</FieldLabel><RewardStars value={task.reward_stars} onChange={n=>handleUpdateTask(idx,"reward_stars",n)}/>

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                          marginLeft: "auto",
                        }}
                      >
                        <span style={{ color: task.require_approval ? "var(--accent)" : "var(--muted)", fontWeight: 600, fontSize: "0.78rem" }}>
                          需审核
                        </span>
                        <div
                          className={`ios-switch ${task.require_approval ? "on" : ""}`}
                          onClick={() => handleUpdateTask(idx, "require_approval", !task.require_approval)}
                          style={{ transform: "scale(0.7)", transformOrigin: "right center" }}
                        >
                          <div className="ios-switch-thumb" />
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddEmptyDraft}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: "10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card-subtle)",
                  color: "var(--muted)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                + 添加一项任务
              </button>
            </div>
          )}
        </div>

        {/* Footer actions (iOS 风格底部全宽主按钮) */}
        {result?.tasks?.length > 0 && (
          <div
            style={{
              padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: "0.5px solid var(--separator)",
              backgroundColor: "var(--card)",
            }}
          >
            <button
              type="button"
              className="ios-btn-primary"
              onClick={handlePublish}
              disabled={publishing}
              style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}
            >
              {publishing
                ? "正在发布中…"
                : `确认发布 (${result.tasks.length} 项任务)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
