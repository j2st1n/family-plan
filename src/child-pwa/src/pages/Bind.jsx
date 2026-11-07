import { useState } from "react";
import { bindDevice } from "../api.js";
import AuthShell from "../../../shared-web/AuthShell.jsx";

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

  return <AuthShell subtitle="输入家长提供的 6 位访问码">
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <div className="auth-fields">
      <label className="auth-field auth-field--code"><span>设备访问码</span><input
        type="text"
        name="access_code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="输入 6 位数字"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-code-help auth-error" : "auth-code-help"}
      /></label>
      </div>
      <p className="auth-help" id="auth-code-help">在家长端的设置中获取访问码</p>
      {error && <p className="auth-error" id="auth-error" role="alert">{error}</p>}
      <button
        type="submit"
        className="auth-submit"
        disabled={loading}
      >
        {loading ? "绑定中…" : "绑定设备"}
      </button>
    </form>
  </AuthShell>;
}
