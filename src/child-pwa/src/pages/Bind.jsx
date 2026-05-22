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
    <form onSubmit={handleSubmit} style={{ textAlign: "center", paddingTop: "32vh" }}>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: "#3d9e6b",
          marginBottom: "0.4rem",
        }}
      >
        Family Plan
      </h1>
      <p style={{ fontSize: "1rem", color: "#73706b", marginBottom: "2rem" }}>
        输入家长给您的访问码
      </p>
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
          border: "2px solid #d6d2cc",
          borderRadius: "16px",
          background: "#fff",
          outline: "none",
          marginBottom: "1.2rem",
        }}
      />
      {error && (
        <p style={{ color: "#c97070", marginBottom: "0.8rem", fontSize: "0.95rem" }}>
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
          fontWeight: 600,
          color: "#fff",
          background: loading ? "#73706b" : "#3d9e6b",
          borderRadius: "14px",
          transition: "background 0.15s",
        }}
      >
        {loading ? "绑定中…" : "绑定"}
      </button>
    </form>
  );
}
