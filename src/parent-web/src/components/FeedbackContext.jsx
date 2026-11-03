import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

const FeedbackContext = createContext(null);

let globalFeedback = {
  toast: () => {},
  confirm: () => Promise.resolve(false),
  alert: () => Promise.resolve(),
};

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    return globalFeedback;
  }
  return ctx;
}

export const feedback = {
  toast: (msg, type) => globalFeedback.toast(msg, type),
  success: (msg) => globalFeedback.toast(msg, "success"),
  error: (msg) => globalFeedback.toast(msg, "error"),
  info: (msg) => globalFeedback.toast(msg, "info"),
  confirm: (opts) => globalFeedback.confirm(opts),
  alert: (opts) => globalFeedback.alert(opts),
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [alertDialog, setAlertDialog] = useState(null);

  const toastCounter = useRef(0);

  const showToast = useCallback((message, type = "info", duration = 2800) => {
    if (!message) return;
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const toastObj = useCallback(
    Object.assign(
      (msg, type) => showToast(msg, type),
      {
        success: (msg, dur) => showToast(msg, "success", dur),
        error: (msg, dur) => showToast(msg, "error", dur),
        info: (msg, dur) => showToast(msg, "info", dur),
      }
    ),
    [showToast]
  );

  const showConfirm = useCallback((options) => {
    const opts = typeof options === "string" ? { message: options } : options || {};
    return new Promise((resolve) => {
      setConfirmDialog({
        title: opts.title || "操作确认",
        message: opts.message || "确定继续此操作吗？",
        confirmText: opts.confirmText || "确定",
        cancelText: opts.cancelText || "取消",
        isDestructive: opts.isDestructive ?? true,
        resolve: (verdict) => {
          setConfirmDialog(null);
          resolve(verdict);
        },
      });
    });
  }, []);

  const showAlert = useCallback((options) => {
    const opts = typeof options === "string" ? { message: options } : options || {};
    return new Promise((resolve) => {
      setAlertDialog({
        title: opts.title || "温馨提示",
        message: opts.message || "",
        buttonText: opts.buttonText || "我知道了",
        resolve: () => {
          setAlertDialog(null);
          resolve();
        },
      });
    });
  }, []);

  useEffect(() => {
    globalFeedback = {
      toast: toastObj,
      confirm: showConfirm,
      alert: showAlert,
    };
  }, [toastObj, showConfirm, showAlert]);

  return (
    <FeedbackContext.Provider value={{ toast: toastObj, confirm: showConfirm, alert: showAlert }}>
      {children}

      {/* Floating Toast Notification Stack */}
      {toasts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            pointerEvents: "none",
            width: "calc(100% - 32px)",
            maxWidth: "420px",
          }}
        >
          {toasts.map((t) => {
            const isSuccess = t.type === "success";
            const isError = t.type === "error";
            return (
              <div
                key={t.id}
                style={{
                  pointerEvents: "auto",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-pill, 999px)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(80, 70, 60, 0.12)",
                  transition: "all 0.2s ease",
                  backgroundColor: isSuccess ? "#EBF9EE" : isError ? "#FFF1F0" : "#FFFFFF",
                  color: isSuccess ? "#248A3D" : isError ? "var(--danger, #FF3B30)" : "var(--text, #1D1D1F)",
                  border: `1px solid ${isSuccess ? "#34C759" : isError ? "#FFD1CF" : "var(--border, #E5E5EA)"}`,
                }}
              >
                <span>{isSuccess ? "✓" : isError ? "⚠" : "ℹ"}</span>
                <span>{t.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Apple / iOS Style Confirm Modal */}
      {confirmDialog && (
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
          onClick={() => confirmDialog.resolve(false)}
        >
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
              width: "100%",
              maxWidth: "290px",
              textAlign: "center",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 18px 16px" }}>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 650,
                  color: "var(--text, #1D1D1F)",
                  marginBottom: "6px",
                  letterSpacing: "-0.015em",
                }}
              >
                {confirmDialog.title}
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text, #1D1D1F)",
                  lineHeight: 1.4,
                  opacity: 0.85,
                  margin: 0,
                }}
              >
                {confirmDialog.message}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                borderTop: "0.5px solid rgba(60, 60, 67, 0.25)",
              }}
            >
              <button
                type="button"
                onClick={() => confirmDialog.resolve(false)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRight: "0.5px solid rgba(60, 60, 67, 0.25)",
                  color: "var(--accent, #0071E3)",
                  fontSize: "0.95rem",
                  fontWeight: 400,
                  cursor: "pointer",
                }}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.resolve(true)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  backgroundColor: "transparent",
                  border: "none",
                  color: confirmDialog.isDestructive ? "var(--danger, #FF3B30)" : "var(--accent, #0071E3)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apple / iOS Style Alert Modal */}
      {alertDialog && (
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
          onClick={() => alertDialog.resolve()}
        >
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
              width: "100%",
              maxWidth: "290px",
              textAlign: "center",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 18px 16px" }}>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 650,
                  color: "var(--text, #1D1D1F)",
                  marginBottom: "6px",
                  letterSpacing: "-0.015em",
                }}
              >
                {alertDialog.title}
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text, #1D1D1F)",
                  lineHeight: 1.4,
                  opacity: 0.85,
                  margin: 0,
                }}
              >
                {alertDialog.message}
              </p>
            </div>
            <div
              style={{
                borderTop: "0.5px solid rgba(60, 60, 67, 0.25)",
              }}
            >
              <button
                type="button"
                onClick={() => alertDialog.resolve()}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "var(--accent, #0071E3)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {alertDialog.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export default FeedbackContext;
