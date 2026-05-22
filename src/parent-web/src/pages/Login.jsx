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
    <form onSubmit={handleSubmit} style={{ textAlign: "center", paddingTop: "30vh" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700, color: "#3d9e6b", marginBottom: "0.5rem" }}>Family Plan</h1>

      <input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} autoFocus style={st} />
      <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} style={st} />

      {error && <p style={{ color: "#c97070", marginBottom: "0.6rem", fontSize: "0.9rem" }}>{error}</p>}

      <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.7rem", fontSize: "1rem", fontWeight: 600, color: "#fff", background: loading ? "#8cb99a" : "#3d9e6b", borderRadius: "12px", marginBottom: "0.6rem" }}>
        {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
      </button>

      <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ color: "#3d9e6b", fontSize: "0.9rem", background: "none", border: "none", cursor: "pointer" }}>
        {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
      </button>
    </form>
  );
}

const st = { width: "100%", padding: "0.7rem 0.8rem", fontSize: "1rem", border: "1px solid #e8e4df", borderRadius: "10px", outline: "none", marginBottom: "0.6rem", display: "block", background: "#fff" };
