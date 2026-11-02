import { useState, useEffect, useRef } from "react";
import useScreenWakeLock from "../hooks/useScreenWakeLock.js";
import { playTimerDone } from "../utils/soundFx.js";

/**
 * 沉浸式专注计时器 (FocusTimer)
 * 专为 iPad / 儿童平板打造：
 * 1. 采用大号 SVG 环状进度条，视觉直观生动
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

  // SVG 环状进度条几何参数
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
    <div style={styles.overlay}>
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

      {/* 核心圆形计时区域 */}
      <div style={styles.centerContainer}>
        <div style={styles.timerWrap}>
          <svg
            width={size}
            height={size}
            style={styles.svg}
            viewBox={`0 0 ${size} ${size}`}
          >
            {/* 渐变定义：森林绿+琥珀金温润双色 */}
            <defs>
              <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#436A54" />
                <stop offset="100%" stopColor="#9A6700" />
              </linearGradient>
            </defs>

            {/* 底层柔和手账纸质轨道 */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#EAE4D9"
              strokeWidth={strokeWidth}
            />

            {/* 动态进度环 */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="url(#focusGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "50% 50%",
                transition: "stroke-dashoffset 0.8s ease-out, stroke 0.3s ease",
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
              {status === "paused" ? "⏸️ 暂停中·屏幕常亮已暂缓" : "💡 屏幕常亮待命"}
            </span>
          )}
        </div>
      </div>

      {/* 底部大触控控制按钮群 */}
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
            {onComplete && (
              <button
                onClick={handleFinishAndComplete}
                style={styles.completeBtn}
              >
                🌟 领取奖励并完成任务
              </button>
            )}
            <button onClick={onClose} style={styles.secondaryBtn}>
              返回今日任务
            </button>
          </div>
        )}
      </div>

      {/* 退出防误触确认弹窗 */}
      {showConfirmQuit && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}>
              🤔
            </div>
            <h3 style={styles.modalTitle}>确定要提前结束专注吗？</h3>
            <p style={styles.modalText}>
              距离完成还剩 {mins} 分钟，坚持一下，专注的小朋友最帅气！
            </p>
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowConfirmQuit(false)}
                style={styles.modalStayBtn}
              >
                继续坚持
              </button>
              <button
                onClick={handleConfirmQuit}
                style={styles.modalQuitBtn}
              >
                确定结束
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
    zIndex: 1000,
    backgroundColor: "rgba(250, 248, 245, 0.96)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
    overflowY: "auto",
    color: "var(--text)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 600,
    margin: "0 auto",
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    border: "1px solid var(--border)",
    background: "#F0ECE4",
    color: "var(--text)",
    fontSize: "1.2rem",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  },
  headerTitleWrap: {
    textAlign: "center",
  },
  headerBadge: {
    fontSize: "0.8rem",
    fontWeight: 650,
    color: "var(--accent)",
    background: "var(--accent-light)",
    border: "1px solid var(--accent-pill)",
    padding: "3px 12px",
    borderRadius: 14,
  },
  taskTitle: {
    fontSize: "1.35rem",
    fontWeight: 700,
    color: "var(--text)",
    marginTop: "0.3rem",
    maxWidth: "320px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    fontSize: "3.6rem",
    fontWeight: 800,
    color: "var(--text)",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
  },
  statusBadge: {
    fontSize: "0.95rem",
    fontWeight: 650,
    color: "var(--accent)",
    marginTop: "0.2rem",
    background: "var(--accent-light)",
    border: "1px solid var(--accent-pill)",
    padding: "4px 14px",
    borderRadius: "16px",
  },
  rewardHint: {
    fontSize: "0.85rem",
    color: "var(--star)",
    fontWeight: 650,
    marginTop: "0.4rem",
  },
  wakeLockIndicator: {
    marginTop: "1.5rem",
    textAlign: "center",
  },
  wakeLockActive: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--accent)",
    background: "var(--accent-light)",
    border: "1px solid var(--accent-pill)",
    padding: "5px 14px",
    borderRadius: 999,
  },
  wakeLockInactive: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.85rem",
    color: "var(--muted)",
    background: "#F0ECE4",
    border: "1px solid var(--border)",
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
    minHeight: 64,
    padding: "16px",
    borderRadius: 24,
    background: "var(--card)",
    border: "2.5px solid var(--accent)",
    color: "var(--accent)",
    fontSize: "1.2rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(67, 106, 84, 0.12)",
    touchAction: "manipulation",
  },
  resumeBtn: {
    width: "100%",
    minHeight: 64,
    padding: "16px",
    borderRadius: 24,
    background: "var(--accent)",
    border: "none",
    color: "#FFFFFF",
    fontSize: "1.2rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(67, 106, 84, 0.28)",
    touchAction: "manipulation",
  },
  completeBtn: {
    width: "100%",
    minHeight: 64,
    padding: "16px",
    borderRadius: 24,
    background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
    border: "none",
    color: "#FFFFFF",
    fontSize: "1.2rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(67, 106, 84, 0.3)",
    touchAction: "manipulation",
  },
  secondaryBtn: {
    width: "100%",
    minHeight: 48,
    padding: "12px",
    borderRadius: 18,
    background: "#F0ECE4",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    touchAction: "manipulation",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    background: "rgba(45, 55, 49, 0.45)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    background: "var(--card)",
    borderRadius: 24,
    border: "1px solid var(--border)",
    padding: "26px 22px",
    maxWidth: 360,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 12px 36px rgba(70, 60, 50, 0.15)",
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: "0.5rem",
  },
  modalText: {
    fontSize: "0.95rem",
    color: "var(--muted)",
    lineHeight: 1.6,
    marginBottom: "1.4rem",
  },
  modalActions: {
    display: "flex",
    gap: "0.8rem",
  },
  modalStayBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    background: "var(--accent)",
    color: "#FFFFFF",
    fontSize: "1.05rem",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(67, 106, 84, 0.2)",
  },
  modalQuitBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    background: "#F0ECE4",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};
