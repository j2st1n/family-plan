import { useState } from "react";
import api from "../api.js";
import AuthShell from "../../../shared-web/AuthShell.jsx";

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

  return <AuthShell subtitle={mode === "login" ? "家长端 · 亲子计划管理" : "创建家长账号"}>
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <div className="auth-fields">
        <label className="auth-field"><span>用户名</span>
          <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required
            placeholder="输入用户名" value={username} onChange={e => setUsername(e.target.value)}
            aria-invalid={error ? true : undefined} aria-describedby={error ? "auth-error" : undefined}/>
        </label>
        <label className="auth-field"><span>密码</span>
          <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required
            placeholder="输入密码" value={password} onChange={e => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined} aria-describedby={error ? "auth-error" : undefined}/>
        </label>
      </div>
      {error && <p className="auth-error" id="auth-error" role="alert">{error}</p>}
      <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
      </button>
      <button type="button" className="auth-switch" disabled={loading} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
      </button>
    </form>
  </AuthShell>;
}
