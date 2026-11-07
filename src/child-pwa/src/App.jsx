import { useState, useEffect } from "react";
import Bind from "./pages/Bind.jsx";
import Today from "./pages/Today.jsx";
import Shop from "./pages/Shop.jsx";
import Growth from "./pages/Growth.jsx";
import { GrowthIcon } from "../../shared-web/GrowthBoard.jsx";
import { TodayIcon, ShopIcon } from "./components/Icons.jsx";

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

  // VisualViewport keyboard dynamic adaptation for iOS Safari
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
      document.documentElement.style.setProperty("--visual-viewport-height", `${vv.height}px`);
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

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
      <div style={{ display: tab === "growth" ? undefined : "none" }}>
        <Growth onExpired={handleExpired} active={tab === "growth"} />
      </div>
      <div style={{ display: tab === "shop" ? undefined : "none" }}>
        <Shop onExpired={handleExpired} active={tab === "shop"} />
      </div>
      <nav className="nav-tabs" role="navigation">
        <button className={`nav-tab${tab === "today" ? " on" : ""}`} onClick={() => setTab("today")}>
          <TodayIcon size={22} filled={tab === "today"} />
          <span>今天</span>
        </button>
        <button className={`nav-tab${tab === "growth" ? " on" : ""}`} onClick={() => setTab("growth")}>
          <GrowthIcon size={22} /><span>成长</span>
        </button>
        <button className={`nav-tab${tab === "shop" ? " on" : ""}`} onClick={() => setTab("shop")}>
          <ShopIcon size={22} filled={tab === "shop"} />
          <span>商城</span>
        </button>
      </nav>
    </>
  );
}
