import { useState, useEffect } from "react";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Shop from "./pages/Shop.jsx";
import Analytics from "./pages/Analytics.jsx";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("parent_token"));
  const [tab, setTab] = useState("home");

  function clearSession() {
    localStorage.removeItem("parent_token");
    setToken(null);
  }

  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("parent_token");
        setToken(null);
      }
    } catch {
      localStorage.removeItem("parent_token");
      setToken(null);
    }
  }, [token]);

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <>
      <header
        className="top-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.4rem 0 0.8rem",
          marginBottom: "0.8rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            className={`top-nav-btn ${tab === "home" ? "active" : ""}`}
            onClick={() => setTab("home")}
            style={{
              padding: "5px 12px",
              borderRadius: "999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 650,
              cursor: "pointer",
              background: tab === "home" ? "var(--accent)" : "transparent",
              color: tab === "home" ? "#fff" : "var(--muted)",
            }}
          >
            首页
          </button>
          <button
            className={`top-nav-btn ${tab === "analytics" ? "active" : ""}`}
            onClick={() => setTab("analytics")}
            style={{
              padding: "5px 12px",
              borderRadius: "999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 650,
              cursor: "pointer",
              background: tab === "analytics" ? "var(--accent)" : "transparent",
              color: tab === "analytics" ? "#fff" : "var(--muted)",
            }}
          >
            成长看板
          </button>
          <button
            className={`top-nav-btn ${tab === "shop" ? "active" : ""}`}
            onClick={() => setTab("shop")}
            style={{
              padding: "5px 12px",
              borderRadius: "999px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 650,
              cursor: "pointer",
              background: tab === "shop" ? "var(--accent)" : "transparent",
              color: tab === "shop" ? "#fff" : "var(--muted)",
            }}
          >
            星星商城
          </button>
        </div>
        <button
          onClick={clearSession}
          style={{
            color: "var(--muted)",
            fontSize: "0.8rem",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          退出
        </button>
      </header>

      <div style={{ display: tab === "home" ? undefined : "none" }}>
        <Home token={token} isActive={tab === "home"} onLogout={clearSession} onExpired={clearSession} />
      </div>
      <div style={{ display: tab === "analytics" ? undefined : "none" }}>
        <Analytics token={token} isActive={tab === "analytics"} onExpired={clearSession} />
      </div>
      <div style={{ display: tab === "shop" ? undefined : "none" }}>
        <Shop token={token} isActive={tab === "shop"} onExpired={clearSession} />
      </div>
      <nav className="nav-tabs" role="navigation">
        <button className={`nav-tab${tab === "home" ? " on" : ""}`} onClick={() => setTab("home")}>首页</button>
        <button className={`nav-tab${tab === "analytics" ? " on" : ""}`} onClick={() => setTab("analytics")}>成长看板</button>
        <button className={`nav-tab${tab === "shop" ? " on" : ""}`} onClick={() => setTab("shop")}>星星商城</button>
      </nav>
    </>
  );
}
