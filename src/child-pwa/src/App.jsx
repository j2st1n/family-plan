import { useState } from "react";
import Bind from "./pages/Bind.jsx";
import Today from "./pages/Today.jsx";
import Shop from "./pages/Shop.jsx";

export default function App() {
  const [deviceToken, setDeviceToken] = useState(() => localStorage.getItem("device_token"));
  const [child, setChild] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("child_profile"));
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState("today");

  function handleBound(token, profile) {
    localStorage.setItem("device_token", token);
    localStorage.setItem("child_profile", JSON.stringify(profile));
    setDeviceToken(token);
    setChild(profile);
  }

  function handleExpired() {
    localStorage.removeItem("device_token");
    localStorage.removeItem("child_profile");
    setDeviceToken(null);
    setChild(null);
  }

  if (!deviceToken) {
    return <Bind onBound={handleBound} />;
  }

  return (
    <>
      <div style={{ display: tab === "today" ? undefined : "none" }}>
        <Today child={child} onExpired={handleExpired} active={tab === "today"} />
      </div>
<div style={{ display: tab === "shop" ? undefined : "none" }}>
  <Shop onExpired={handleExpired} active={tab === "shop"} />
</div>
      <nav className="nav-tabs" role="navigation">
        <button className={`nav-tab${tab === "today" ? " on" : ""}`} onClick={() => setTab("today")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "today" ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="4" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>今日任务</span>
        </button>
        <button className={`nav-tab${tab === "shop" ? " on" : ""}`} onClick={() => setTab("shop")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === "shop" ? "2.2" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span>星星商城</span>
        </button>
      </nav>
    </>
  );
}
