import "./auth.css";

export default function AuthShell({subtitle, children}) {
  return <main className="auth-page" aria-labelledby="auth-title">
    <header className="auth-header">
      <div className="auth-mark" aria-hidden="true">🌟</div>
      <h1 id="auth-title">Family Plan</h1>
      <p>{subtitle}</p>
    </header>
    {children}
  </main>;
}
