import { useState } from "react";
import { bindDevice } from "../api.js";

export default function Bind({ onBound }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError("请输入 6 位数字访问码");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await bindDevice(trimmed, "iPad");
      onBound(result.device_token, result.child);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "20vh" }}>
      <div className="brand-icon">🌟</div>
      <h1 style={{ fontSize: "1.7rem", fontWeight: 700, fontFamily: "\"Noto Sans SC\", \"PingFang SC\", -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: "-0.02em", marginBottom: 6 }}>Family Plan</h1>
      <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "2rem" }}>
        输入家长给您的访问码
      </p>
      <div style={{ width: "100%", maxWidth: 380 }}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="6 位访问码"
        autoFocus
        style={{
          width: "100%",
          fontSize: "2.2rem",
          fontWeight: 700,
          letterSpacing: "0.3em",
          textAlign: "center",
          padding: "0.8rem 0.6rem",
          border: "2px solid var(--border)",
          borderRadius: "16px",
          background: "var(--card)",
          color: "var(--text)",
          outline: "none",
          marginBottom: "1.2rem",
          fontVariantNumeric: "tabular-nums",
          boxShadow: "var(--shadow-sm)",
        }}
      />
      {error && (
        <p style={{ color: "var(--danger)", marginBottom: "0.8rem", fontSize: "0.95rem", textAlign: "center" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.9rem",
          fontSize: "1.15rem",
          fontWeight: 650,
          color: "#FFFFFF",
          background: loading ? "var(--border)" : "var(--accent)",
          borderRadius: "16px",
          transition: "all 0.18s ease",
          boxShadow: "0 2px 8px rgba(67, 106, 84, 0.2)",
        }}
      >
        {loading ? "绑定中…" : "绑定"}
      </button>
      </div>
    </form>
  );
}
