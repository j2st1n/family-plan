export default function WarmEmptyState({
  title = "暂无内容",
  description = "",
  icon = "book",
  actionText,
  onAction,
  style = {},
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        textAlign: "center",
        ...style,
      }}
    >
      <div
        style={{
          width: "68px",
          height: "68px",
          borderRadius: "50%",
          backgroundColor: "var(--accent-light, #F0F6FD)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "12px",
          boxShadow: "0 2px 8px rgba(0, 113, 227, 0.08)",
        }}
      >
        {icon === "book" && (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #0071E3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10"/>
            <path d="M6 10h7"/>
          </svg>
        )}
        {icon === "task" && (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #0071E3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        )}
        {icon === "freeze" && (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--protect, #00C7BE)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
          </svg>
        )}
        {icon === "child" && (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #0071E3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="4"/>
            <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/>
          </svg>
        )}
        {icon === "box" && (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--star, #FF9500)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
        )}
      </div>
      <h4
        style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "var(--text, #1D1D1F)",
          marginBottom: "4px",
          fontFamily: "var(--font-heading)",
        }}
      >
        {title}
      </h4>
      {description && (
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--muted, #86868B)",
            maxWidth: "280px",
            lineHeight: 1.5,
            marginBottom: actionText ? "14px" : "0",
          }}
        >
          {description}
        </p>
      )}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary"
          style={{
            padding: "5px 14px",
            fontSize: "0.82rem",
            borderRadius: "var(--radius-pill, 999px)",
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
