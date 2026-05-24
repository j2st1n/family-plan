import { useState, useEffect } from "react";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Shop from "./pages/Shop.jsx";

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
      <div style={{ display: tab === "home" ? undefined : "none" }}>
        <Home token={token} isActive={tab === "home"} onLogout={clearSession} onExpired={clearSession} />
      </div>
      <div style={{ display: tab === "shop" ? undefined : "none" }}>
        <Shop token={token} isActive={tab === "shop"} onExpired={clearSession} />
      </div>
      <nav className="nav-tabs" role="navigation">
        <button className={`nav-tab${tab === "home" ? " on" : ""}`} onClick={() => setTab("home")}>首页</button>
        <button className={`nav-tab${tab === "shop" ? " on" : ""}`} onClick={() => setTab("shop")}>星星商城</button>
      </nav>
    </>
  );
}
