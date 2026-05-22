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
        <Shop active={tab === "shop"} />
      </div>
      <nav className="nav-tabs" role="navigation">
        <button className={`nav-tab${tab === "today" ? " on" : ""}`} onClick={() => setTab("today")}>今日任务</button>
        <button className={`nav-tab${tab === "shop" ? " on" : ""}`} onClick={() => setTab("shop")}>星星商城</button>
      </nav>
    </>
  );
}
