import { useState } from "react";
import api from "../api.js";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) { setError("请填写用户名和密码"); return; }
    setError(""); setLoading(true);
    try {
      const data = mode === "login" ? await api.login(username.trim(), password) : await api.register(username.trim(), password);
      localStorage.setItem("parent_token", data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "18vh" }}>
      <div className="brand-icon">🌟</div>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 6, color: "var(--accent)" }}>Family Plan</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 28 }}>家长端 · 亲子计划管理</p>

      <div style={{ width: "100%", maxWidth: 340 }}>
        <input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} autoFocus style={st} />
        <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} style={st} />

        {error && <p style={{ color: "var(--danger)", marginBottom: "0.6rem", fontSize: "0.9rem", textAlign: "center" }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", fontWeight: 650, color: "#FFFFFF", background: loading ? "var(--border)" : "var(--accent)", borderRadius: "14px", marginBottom: "0.8rem", letterSpacing: "-0.01em", border: "none", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(67, 106, 84, 0.2)" }}>
          {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
        </button>

        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ width: "100%", color: "var(--accent)", fontSize: "0.88rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "center" }}>
          {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
        </button>
      </div>
    </form>
  );
}

const st = { width: "100%", padding: "0.7rem 0.8rem", fontSize: "1rem", border: "1px solid var(--border)", borderRadius: "12px", outline: "none", marginBottom: "0.65rem", display: "block", background: "var(--card)", color: "var(--text)", fontVariantNumeric: "tabular-nums" };
