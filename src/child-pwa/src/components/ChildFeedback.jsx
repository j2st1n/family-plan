import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

const ChildFeedbackContext = createContext(null);

let globalChildFeedback = {
  toast: () => {},
  confirm: () => Promise.resolve(false),
};

export function useChildFeedback() {
  const ctx = useContext(ChildFeedbackContext);
  if (!ctx) return globalChildFeedback;
  return ctx;
}

export const childFeedback = {
  toast: (msg, type) => globalChildFeedback.toast(msg, type),
  confirm: (opts) => globalChildFeedback.confirm(opts),
};

export function ChildFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const counter = useRef(0);

  const showToast = useCallback((message, type = "info", duration = 2400) => {
    if (!message) return;
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const showConfirm = useCallback((options) => {
    const opts = typeof options === "string" ? { message: options } : options || {};
    return new Promise((resolve) => {
      setConfirmDialog({
        title: opts.title || "要继续吗？",
        message: opts.message || "",
        confirmText: opts.confirmText || "确定",
        cancelText: opts.cancelText || "取消",
        icon: opts.icon || "⭐",
        resolve: (val) => {
          setConfirmDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  useEffect(() => {
    globalChildFeedback = {
      toast: showToast,
      confirm: showConfirm,
    };
  }, [showToast, showConfirm]);

  return (
    <ChildFeedbackContext.Provider value={{ toast: showToast, confirm: showConfirm }}>
      {children}

      {/* Child Toasts */}
      {toasts.length > 0 && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            pointerEvents: "none",
            width: "calc(100% - 32px)",
            maxWidth: "360px",
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                padding: "10px 20px",
                borderRadius: "var(--radius-pill, 999px)",
                fontSize: "0.95rem",
                fontWeight: 700,
                textAlign: "center",
                backgroundColor: t.type === "error" ? "var(--danger-bg)" : "var(--accent-light)",
                color: t.type === "error" ? "var(--danger)" : "var(--accent)",
                border: `1.5px solid ${t.type === "error" ? "var(--danger-border)" : "var(--accent-pill)"}`,
                boxShadow: "0 4px 16px rgba(67, 106, 84, 0.16)",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Child Picture-Book Style Confirm Dialog */}
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
            padding: "20px",
          }}
          onClick={() => confirmDialog.resolve(false)}
        >
          <div
            style={{
              backgroundColor: "var(--card, #FFFFFF)",
              borderRadius: "var(--radius-lg, 24px)",
              border: "2px solid var(--border, #E8E2D5)",
              boxShadow: "0 8px 24px rgba(80, 70, 60, 0.12)",
              padding: "24px 20px",
              width: "100%",
              maxWidth: "340px",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "2.4rem", marginBottom: "8px" }}>
              {confirmDialog.icon}
            </div>
            <h3
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: "8px",
              }}
            >
              {confirmDialog.title}
            </h3>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--muted)",
                lineHeight: 1.6,
                marginBottom: "22px",
              }}
            >
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => confirmDialog.resolve(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: "var(--radius, 18px)",
                  backgroundColor: "var(--card-subtle)",
                  border: "1.5px solid var(--border)",
                  color: "var(--muted)",
                  fontSize: "0.95rem",
                  fontWeight: 700,
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
                  padding: "10px 0",
                  borderRadius: "var(--radius, 18px)",
                  backgroundColor: "var(--accent)",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(67, 106, 84, 0.25)",
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ChildFeedbackContext.Provider>
  );
}
