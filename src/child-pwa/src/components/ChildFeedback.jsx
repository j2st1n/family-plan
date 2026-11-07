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
  const dialog = useRef(null);

  useEffect(() => {
    if (!confirmDialog) return;
    const previousFocus = document.activeElement;
    const buttons = () => [...(dialog.current?.querySelectorAll("button") || [])];
    buttons()[0]?.focus();
    const keyboard = event => {
      if (event.key === "Escape") {event.preventDefault(); confirmDialog.resolve(false);}
      if (event.key === "Tab") {
        const targets = buttons();
        const next = event.shiftKey ? targets.at(-1) : targets[0];
        const boundary = event.shiftKey ? targets[0] : targets.at(-1);
        if (document.activeElement === boundary) {event.preventDefault(); next?.focus();}
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [confirmDialog]);

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
        icon: opts.icon === undefined ? "⭐" : opts.icon,
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

      {/* Child iOS Standard Alert Modal */}
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
          <div ref={dialog} role="alertdialog" aria-modal="true" aria-label={confirmDialog.title}
            style={{
              backgroundColor: "var(--card)",
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
              {confirmDialog.icon && (
                <div style={{ fontSize: "2rem", marginBottom: "6px" }}>
                  {confirmDialog.icon}
                </div>
              )}
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 650,
                  color: "var(--text)",
                  marginBottom: "6px",
                  letterSpacing: "-0.015em",
                }}
              >
                {confirmDialog.title}
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text)",
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
                  color: "var(--accent)",
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
                  color: "var(--accent)",
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
    </ChildFeedbackContext.Provider>
  );
}
