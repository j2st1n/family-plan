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
        title: opts.title || "确认提示",
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
        title: opts.title || "系统提示",
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
                  backgroundColor: isSuccess ? "#EEF4F0" : isError ? "#FDF2F2" : "#FFFFFF",
                  color: isSuccess ? "#264834" : isError ? "var(--danger, #BA3A3A)" : "var(--text, #2D3731)",
                  border: `1px solid ${isSuccess ? "#7DAE88" : isError ? "#FECACA" : "var(--border, #E8E2D5)"}`,
                }}
              >
                <span>{isSuccess ? "✓" : isError ? "⚠" : "ℹ"}</span>
                <span>{t.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hand-drawn Journal Style Confirm Modal */}
      {confirmDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => confirmDialog.resolve(false)}
        >
          <div
            style={{
              backgroundColor: "var(--card, #FFFFFF)",
              borderRadius: "var(--radius-lg, 20px)",
              border: "1px solid var(--border, #E8E2D5)",
              boxShadow: "var(--shadow-hover, 0 4px 14px rgba(80, 70, 60, 0.08))",
              padding: "20px 22px",
              width: "100%",
              maxWidth: "380px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--text, #2D3731)",
                marginBottom: "8px",
              }}
            >
              {confirmDialog.title}
            </h3>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--muted, #67736C)",
                lineHeight: 1.6,
                marginBottom: "20px",
              }}
            >
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => confirmDialog.resolve(false)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "var(--radius-sm, 8px)",
                  backgroundColor: "var(--card-subtle, #FAF7F2)",
                  border: "1px solid var(--border, #E8E2D5)",
                  color: "var(--muted, #67736C)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.resolve(true)}
                style={{
                  padding: "7px 18px",
                  borderRadius: "var(--radius-sm, 8px)",
                  backgroundColor: confirmDialog.isDestructive ? "var(--danger, #BA3A3A)" : "var(--accent, #436A54)",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 650,
                  cursor: "pointer",
                  boxShadow: confirmDialog.isDestructive ? "0 2px 6px rgba(186, 58, 58, 0.25)" : "0 2px 6px rgba(67, 106, 84, 0.25)",
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hand-drawn Journal Style Alert Modal */}
      {alertDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(45, 55, 49, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => alertDialog.resolve()}
        >
          <div
            style={{
              backgroundColor: "var(--card, #FFFFFF)",
              borderRadius: "var(--radius-lg, 20px)",
              border: "1px solid var(--border, #E8E2D5)",
              boxShadow: "var(--shadow-hover, 0 4px 14px rgba(80, 70, 60, 0.08))",
              padding: "20px 22px",
              width: "100%",
              maxWidth: "360px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "1.02rem",
                fontWeight: 700,
                color: "var(--text, #2D3731)",
                marginBottom: "8px",
              }}
            >
              {alertDialog.title}
            </h3>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--muted, #67736C)",
                lineHeight: 1.6,
                marginBottom: "18px",
              }}
            >
              {alertDialog.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => alertDialog.resolve()}
                style={{
                  padding: "7px 18px",
                  borderRadius: "var(--radius-sm, 8px)",
                  backgroundColor: "var(--accent, #436A54)",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 650,
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
