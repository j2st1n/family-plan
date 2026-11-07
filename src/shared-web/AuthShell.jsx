import "./auth.css";
import { APP_DESCRIPTION, BRAND_MARK_URL, BRAND_SLOGAN } from "./brand.js";

export default function AuthShell({subtitle, children}) {
  return <main className="auth-page" aria-labelledby="auth-title">
    <header className="auth-header">
      <img className="auth-mark" src={BRAND_MARK_URL} alt={APP_DESCRIPTION} width="90" height="100" />
      <h1 id="auth-title">{BRAND_SLOGAN}</h1>
      <p>{subtitle}</p>
    </header>
    {children}
  </main>;
}
