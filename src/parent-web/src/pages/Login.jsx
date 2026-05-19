import { useState } from "react";
import api from "../api.js";

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const data = await api.login();
      localStorage.setItem("parent_token", data.token);
      onLogin(data.token);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ textAlign: "center", paddingTop: "35vh" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "#7c6f97", marginBottom: "0.5rem" }}>
        Family Plan
      </h1>
      <p style={{ color: "#8c8985", marginBottom: "2rem" }}>家长端</p>
      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          padding: "0.8rem 2.5rem",
          fontSize: "1.05rem",
          fontWeight: 600,
          color: "#fff",
          background: loading ? "#b0aeb8" : "#7c6f97",
          borderRadius: "12px",
        }}
      >
        {loading ? "登录中…" : "开发登录"}
      </button>
    </div>
  );
}
