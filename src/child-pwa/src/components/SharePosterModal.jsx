import { useEffect, useRef, useState, useCallback } from "react";
import { drawGrowthPoster, shareOrDownloadPoster, downloadPoster } from "../utils/posterCanvas.js";
import { ShareIcon, DownloadIcon } from "./Icons.jsx";

export default function SharePosterModal({
  open = false,
  onClose,
  childName = "小朋友",
  dateStr = "",
  completionRate = 100,
  completedCount = 0,
  totalCount = 0,
  streakDays = 0,
  stars = 0,
  starsToday = 0,
  tasks = [],
  quote = "",
}) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const renderPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsGenerating(true);
      drawGrowthPoster(canvas, {
        childName,
        dateStr,
        completionRate,
        completedCount,
        totalCount,
        streakDays,
        stars,
        starsToday,
        tasks,
        quote,
      });
      const url = canvas.toDataURL("image/png");
      setDataUrl(url);
    } catch (err) {
      console.error("[SharePosterModal] Failed to render poster:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [childName, dateStr, completionRate, completedCount, totalCount, streakDays, stars, starsToday, tasks, quote]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        renderPoster();
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setDataUrl("");
      setShareFeedback("");
    }
  }, [open, renderPoster]);

  const handleShare = async () => {
    if (!canvasRef.current || isSharing) return;
    setIsSharing(true);
    setShareFeedback("");
    try {
      const res = await shareOrDownloadPoster(canvasRef.current, {
        childName,
        dateStr,
        title: `${childName}的自律成长成就卡`,
        text: `看！这是 ${childName} 在 ${dateStr} 的自律成长成就卡，太棒啦！`,
      });
      if (res.method === "download") {
        setShareFeedback("卡片已为您保存下载！");
      }
    } catch (err) {
      console.error("[SharePosterModal] Share failed:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    downloadPoster(canvasRef.current, `${childName}-自律成就-${dateStr || "today"}.png`);
    setShareFeedback("卡片已保存下载！");
  };

  if (!open) return null;

  return (
    <div className="ios-sheet-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="分享自律成长成就卡">
      <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
        <div className="drawer-handle-bar" />
        <div className="ios-sheet-header">
          <div style={{ width: "48px" }} />
          <span className="ios-sheet-header-title">自律成长成就卡</span>
          <button type="button" className="ios-sheet-close-btn" onClick={onClose}>
            完成
          </button>
        </div>

        <div className="ios-sheet-body" style={{ textAlign: "center", padding: "16px 20px calc(24px + env(safe-area-inset-bottom, 16px))" }}>
          {/* Offscreen Canvas for Retina 2x Rendering */}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {isGenerating ? (
            <div style={{ padding: "60px 0", color: "var(--muted)", fontSize: "0.9rem" }}>
              正在生成 Retina 高清卡片…
            </div>
          ) : dataUrl ? (
            <div>
              <img
                src={dataUrl}
                alt="自律成长成就卡预览"
                className="ios-poster-preview-img"
                style={{
                  width: "100%",
                  maxWidth: "280px",
                  height: "auto",
                  display: "block",
                  margin: "0 auto 14px",
                  borderRadius: "16px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                  border: "0.5px solid var(--border)",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              />
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  margin: "0 0 16px 0",
                  lineHeight: "1.4",
                }}
              >
                📱 手机端可<strong>长按图片</strong>直接发送给微信好友或存入系统相册
              </p>
            </div>
          ) : null}

          {shareFeedback && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--accent)",
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              {shareFeedback}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", width: "100%" }}>
            <button
              type="button"
              className="ios-btn-primary"
              onClick={handleShare}
              disabled={isSharing || isGenerating}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px",
                fontSize: "0.95rem",
                fontWeight: 600,
              }}
            >
              <ShareIcon size={18} color="#FFFFFF" />
              <span>{isSharing ? "正在分享…" : "分享"}</span>
            </button>

            <button
              type="button"
              className="ios-btn-secondary"
              onClick={handleDownload}
              disabled={isGenerating}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px",
                fontSize: "0.95rem",
                fontWeight: 600,
              }}
            >
              <DownloadIcon size={18} />
              <span>保存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
