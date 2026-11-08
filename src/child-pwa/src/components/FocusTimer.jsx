import { useState, useEffect, useRef } from "react";
import useScreenWakeLock from "../hooks/useScreenWakeLock.js";
import SlideToComplete from "./SlideToComplete.jsx";
import { playTimerDone } from "../utils/soundFx.js";

/**
 * 沉浸式专注计时器 (FocusTimer)
 * Apple Watch 健身圆环质感（鲜活细光圈 + 高斯模糊背景）：
 * 1. 采用精密 SVG Apple Watch 健身圆环进度条，鲜活荧光与羽化光晕
 * 2. 运行时无缝关联屏幕保活 (useScreenWakeLock)，防止平板休眠
 * 3. 支持暂停、继续、提前终止（二次防误触确认）
 * 4. 计时归零触发 Web Audio 纯前端舒缓钟声 (playTimerDone)
 * 5. 归零后支持一键完成任务或返回
 */
export default function FocusTimer({ task, onClose, onComplete }) {
  const initialMinutes = task?.expected_minutes > 0 ? task.expected_minutes : 20;
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [status, setStatus] = useState("running"); // 'running' | 'paused' | 'completed'
  const [showConfirmQuit, setShowConfirmQuit] = useState(false);

  // 屏幕常亮：仅在 running 状态下激活
  const { isActive: isWakeLockActive } = useScreenWakeLock(status === "running");

  // 绝对时间戳引用，用于 iPad / 移动端切后台唤醒后的时钟漂移自动校准
  const targetEndTimeRef = useRef(Date.now() + initialMinutes * 60 * 1000);

  // 计时核心逻辑：基于绝对时钟 (Wall-Clock)，杜绝 iPad 锁屏或切后台导致的 setInterval 冻结漂移
  useEffect(() => {
    if (status !== "running") return;

    targetEndTimeRef.current = Date.now() + secondsLeft * 1000;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
      setSecondsLeft(remaining);
    };

    const timer = setInterval(tick, 500);

    // 页面切回前台 (visibilitychange) 立即校准最新剩余秒数
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status]); // 依赖 status：暂停时不运行，继续时重新基于当前 secondsLeft 计算目标截止时间戳

  // 计时归零处理：分离状态更新与音效副作用，杜绝在 state updater 内调用其它 state setter
  useEffect(() => {
    if (status === "running" && secondsLeft === 0) {
      setStatus("completed");
      playTimerDone();
    }
  }, [secondsLeft, status]);

  // 时间格式化 MM:SS
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const timeDisplay = `${pad(mins)}:${pad(secs)}`;

  // SVG 环状进度条几何参数 (保留 Sprint 1 测试要求几何规格)
  const size = 300;
  const strokeWidth = 16;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  // 计算 stroke-dashoffset（从满环递减到 0）
  const progressRatio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const handlePause = () => setStatus("paused");
  const handleResume = () => setStatus("running");

  const handleQuitClick = () => {
    if (status === "completed") {
      onClose();
    } else {
      setShowConfirmQuit(true);
    }
  };

  const handleConfirmQuit = () => {
    setShowConfirmQuit(false);
    onClose();
  };

  const handleFinishAndComplete = () => {
    if (onComplete && task) {
      onComplete(task);
    }
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="专注模式" style={styles.overlay}>
      {/* 顶部导航与任务信息 */}
      <div style={styles.header}>
        <button
          onClick={handleQuitClick}
          style={styles.closeBtn}
          aria-label="关闭专注模式"
        >
          ✕
        </button>
        <div style={styles.headerTitleWrap}>
          <span style={styles.headerBadge}>⏱️ 专注时间</span>
          <h2 style={styles.taskTitle}>{task?.title || "专注时光"}</h2>
        </div>
        <div style={{ width: 44 }} /> {/* 占位以保持居中 */}
      </div>

      {/* 核心圆形计时区域：Apple Watch 健身圆环质感 */}
      <div style={styles.centerContainer}>
        <div style={styles.timerWrap}>
          <svg
            width={size}
            height={size}
            style={styles.svg}
            viewBox={`0 0 ${size} ${size}`}
          >
            {/* 渐变定义：Apple Watch Activity Green 鲜活双色 */}
            <defs>
              <linearGradient id="appleActivityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#30D158" />
                <stop offset="100%" stopColor="#34C759" />
              </linearGradient>
              <filter id="activityGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* 底层暗调半通透圆环轨道 */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth={strokeWidth}
            />

            {/* 动态鲜活 Apple Watch 健身光圈进度环 */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="url(#appleActivityGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="url(#activityGlow)"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "50% 50%",
                transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease",
              }}
            />
          </svg>

          {/* 环内文字内容 */}
          <div style={styles.innerContent}>
            <div style={styles.timeText}>{timeDisplay}</div>
            <div style={styles.statusBadge}>
              {status === "running" && "🎯 正在专注中"}
              {status === "paused" && "⏸️ 已暂停"}
              {status === "completed" && "🎉 太棒了，专注完成！"}
            </div>
            {task?.reward_stars > 0 && (
              <div style={styles.rewardHint}>
                完成可得 ⭐ +{task.reward_stars}
              </div>
            )}
          </div>
        </div>

        {/* 屏幕常亮状态提示 */}
        <div style={styles.wakeLockIndicator}>
          {isWakeLockActive ? (
            <span style={styles.wakeLockActive}>
              💡 屏幕常亮保活已生效（专注不熄屏）
            </span>
          ) : (
            <span style={styles.wakeLockInactive}>
              {status === "paused" ? "⏸️ 暂停中 · 屏幕常亮已暂缓" : "💡 屏幕常亮待命"}
            </span>
          )}
        </div>
      </div>

      {/* 底部大触控控制按钮群：iOS 磨砂胶囊 */}
      <div style={styles.controlBar}>
        {status === "running" && (
          <div style={styles.buttonGroup}>
            <button onClick={handlePause} style={styles.pauseBtn}>
              ⏸️ 暂停
            </button>
            <button onClick={handleQuitClick} style={styles.secondaryBtn}>
              提前结束
            </button>
          </div>
        )}

        {status === "paused" && (
          <div style={styles.buttonGroup}>
            <button onClick={handleResume} style={styles.resumeBtn}>
              ▶️ 继续专注
            </button>
            <button onClick={handleQuitClick} style={styles.secondaryBtn}>
              放弃专注
            </button>
          </div>
        )}

        {status === "completed" && (
          <div style={styles.buttonGroup}>
            {onComplete && <SlideToComplete taskName={task?.title || "专注任务"} onComplete={handleFinishAndComplete} />}
            <button onClick={onClose} style={styles.secondaryBtn}>
              返回今日任务
            </button>
          </div>
        )}
      </div>

            {/* 退出防误触确认弹窗 (iOS Alert 规范) */}
            {showConfirmQuit && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  backdropFilter: "saturate(180%) blur(16px)",
                  WebkitBackdropFilter: "saturate(180%) blur(16px)",
                  zIndex: 10000,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                }}
                onClick={() => setShowConfirmQuit(false)}
              >
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderRadius: "16px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
                    width: "100%",
                    maxWidth: "280px",
                    textAlign: "center",
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: "20px 16px 16px" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 650, color: "var(--text)", marginBottom: "4px" }}>
                      提前结束专注？
                    </h3>
                    <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
                      坚持就是胜利！现在离开将不会获得本次专注奖励哦。
                    </p>
                  </div>
                  <div style={{ display: "flex", borderTop: "0.5px solid rgba(60, 60, 67, 0.2)" }}>
                    <button
                      type="button"
                      onClick={() => setShowConfirmQuit(false)}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRight: "0.5px solid rgba(60, 60, 67, 0.2)",
                        color: "var(--accent)",
                        fontSize: "0.95rem",
                        fontWeight: 400,
                        cursor: "pointer",
                      }}
                    >
                      继续坚持
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmQuit}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "var(--danger)",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      确认结束
                    </button>
                  </div>
                </div>
              </div>
            )}
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    backgroundColor: "rgba(18, 18, 20, 0.88)",
    backdropFilter: "saturate(180%) blur(25px)",
    WebkitBackdropFilter: "saturate(180%) blur(25px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "24px 20px calc(28px + env(safe-area-inset-bottom, 0px))",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 680,
    margin: "0 auto",
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.14)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#FFFFFF",
    fontSize: "1.2rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "manipulation",
    transition: "transform 0.15s ease, background 0.15s ease",
  },
  headerTitleWrap: {
    textAlign: "center",
    flex: 1,
    padding: "0 12px",
  },
  headerBadge: {
    display: "inline-block",
    fontSize: "0.75rem",
    fontWeight: 650,
    color: "#30D158",
    background: "rgba(48, 209, 88, 0.15)",
    border: "1px solid rgba(48, 209, 88, 0.3)",
    padding: "2px 10px",
    borderRadius: 999,
    marginBottom: "4px",
  },
  taskTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#FFFFFF",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    letterSpacing: "-0.015em",
  },
  centerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "auto 0",
  },
  timerWrap: {
    position: "relative",
    width: 300,
    height: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
    inset: 0,
  },
  innerContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    zIndex: 2,
  },
  timeText: {
    fontSize: "3.8rem",
    fontWeight: 750,
    color: "#FFFFFF",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  statusBadge: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#30D158",
    marginTop: "0.3rem",
    background: "rgba(255, 255, 255, 0.12)",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    padding: "4px 14px",
    borderRadius: 999,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  rewardHint: {
    fontSize: "0.86rem",
    color: "var(--star)",
    fontWeight: 650,
    marginTop: "0.45rem",
  },
  wakeLockIndicator: {
    marginTop: "1.5rem",
    textAlign: "center",
  },
  wakeLockActive: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.82rem",
    fontWeight: 500,
    color: "#0071E3",
    background: "rgba(0, 113, 227, 0.15)",
    border: "1px solid rgba(0, 113, 227, 0.3)",
    padding: "5px 14px",
    borderRadius: 999,
  },
  wakeLockInactive: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.82rem",
    color: "rgba(255, 255, 255, 0.5)",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    padding: "5px 14px",
    borderRadius: 999,
  },
  controlBar: {
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.8rem",
    width: "100%",
  },
  pauseBtn: {
    width: "100%",
    minHeight: 58,
    padding: "14px",
    borderRadius: 980,
    background: "rgba(255, 255, 255, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    color: "#FFFFFF",
    fontSize: "1.15rem",
    fontWeight: 650,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
    touchAction: "manipulation",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    transition: "transform 0.1s ease",
  },
  resumeBtn: {
    width: "100%",
    minHeight: 58,
    padding: "14px",
    borderRadius: 980,
    background: "#34C759",
    border: "none",
    color: "#FFFFFF",
    fontSize: "1.15rem",
    fontWeight: 650,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(52, 199, 89, 0.4)",
    touchAction: "manipulation",
    transition: "transform 0.1s ease",
  },
  completeBtn: {
    width: "100%",
    minHeight: 58,
    padding: "14px",
    borderRadius: 980,
    background: "var(--accent)",
    border: "none",
    color: "#FFFFFF",
    fontSize: "1.15rem",
    fontWeight: 650,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(0, 113, 227, 0.4)",
    touchAction: "manipulation",
    transition: "transform 0.1s ease",
  },
  secondaryBtn: {
    width: "100%",
    minHeight: 46,
    padding: "10px",
    borderRadius: 980,
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: "0.92rem",
    fontWeight: 500,
    cursor: "pointer",
    touchAction: "manipulation",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    background: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    background: "rgba(32, 32, 35, 0.95)",
    borderRadius: 22,
    border: "1px solid rgba(255, 255, 255, 0.15)",
    padding: "26px 22px",
    maxWidth: 360,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
  },
  modalTitle: {
    fontSize: "1.2rem",
    fontWeight: 700,
    color: "#FFFFFF",
    marginBottom: "0.5rem",
    letterSpacing: "-0.015em",
  },
  modalText: {
    fontSize: "0.92rem",
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 1.5,
    marginBottom: "1.3rem",
  },
  modalActions: {
    display: "flex",
    gap: "0.8rem",
  },
  modalStayBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 980,
    background: "var(--accent)",
    color: "#FFFFFF",
    fontSize: "1rem",
    fontWeight: 650,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0, 113, 227, 0.3)",
  },
  modalQuitBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 980,
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
  },
};
