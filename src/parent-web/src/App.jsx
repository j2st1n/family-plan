import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login.jsx";
import TodayDashboard from "./pages/TodayDashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Shop from "./pages/Shop.jsx";
import Settings from "./pages/Settings.jsx";
import api from "./api.js";
import useSseRefresh from "./hooks/useSseRefresh.js";
import { TodayIcon, AnalyticsIcon, ShopIcon, SettingsIcon } from "./components/Icons.jsx";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("parent_token"));
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem("parent_active_tab");
    return ["today", "analytics", "shop", "settings"].includes(saved) ? saved : "today";
  });
  const [children, setChildren] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeChildId, setActiveChildId] = useState(() => localStorage.getItem("parent_active_child_id") || "");
  const [totalPending, setTotalPending] = useState(0);

  const clearSession = useCallback(() => {
    localStorage.removeItem("parent_token");
    setToken(null);
  }, []);

  // Token expiration check
  useEffect(() => {
    if (!token) return;
    try {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
        if (payload?.exp && payload.exp * 1000 < Date.now()) {
          clearSession();
        }
      }
    } catch (e) {
      console.warn("Token payload parse error", e);
    }
  }, [token, clearSession]);

  const handleTabChange = useCallback((nextTab) => {
    setTab(nextTab);
    localStorage.setItem("parent_active_tab", nextTab);
  }, []);

  const handleChildChange = useCallback((childId) => {
    setActiveChildId(childId);
    localStorage.setItem("parent_active_child_id", childId);
  }, []);

  // Refresh children list and aggregate pending review tasks count
  const refreshGlobalMeta = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.fetchChildren(token);
      setChildren((prev) => {
        const prevJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(list);
        return prevJson === nextJson ? prev : list;
      });

      if (list.length > 0) {
        setActiveChildId((prevId) => {
          if (!prevId || !list.find((c) => c.id === prevId)) {
            localStorage.setItem("parent_active_child_id", list[0].id);
            return list[0].id;
          }
          return prevId;
        });
      }

      // Aggregate pending approvals across all children
      let pendingCount = 0;
      await Promise.all(
        list.map(async (c) => {
          try {
            const ds = await api.fetchDashboard(token, c.id);
            pendingCount += ds?.today?.submitted_tasks ?? 0;
          } catch {
            // ignore
          }
        })
      );
      setTotalPending(pendingCount);
    } catch (e) {
      console.warn("Refresh meta failed", e);
    } finally {
      setInitialLoading(false);
    }
  }, [token]);

  // VisualViewport keyboard dynamic adaptation for iOS Safari
  useEffect(() => {
    refreshGlobalMeta();
  }, [refreshGlobalMeta]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // Calculate keyboard height
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

  useSseRefresh({
    token,
    enabled: !!token,
    topics: ["tasks", "children", "settings"],
    onRefresh: refreshGlobalMeta,
    onExpired: clearSession,
  });

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  const activeChild = children.find((c) => c.id === activeChildId) || children[0] || null;

  return (
    <>
      {/* iOS Frosted Navigation Bar */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
            {tab === "today" ? "今天" : tab === "analytics" ? "成长统计" : tab === "shop" ? "星星商城" : "设置"}
          </span>
          {activeChild && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 500 }}>
                {activeChild.name}
              </span>
            </div>
          )}
        </div>

        {/* 桌面端顶部导航链接（>=768px 显示，移动端由 CSS display:none 隐藏） */}
        <nav className="desktop-nav-links" role="navigation">
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "today" ? "active" : ""}`}
            onClick={() => handleTabChange("today")}
          >
            <TodayIcon size={18} filled={tab === "today"} />
            <span>今天</span>
            {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
          </button>
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "analytics" ? "active" : ""}`}
            onClick={() => handleTabChange("analytics")}
          >
            <AnalyticsIcon size={18} filled={tab === "analytics"} />
            <span>统计</span>
          </button>
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "shop" ? "active" : ""}`}
            onClick={() => handleTabChange("shop")}
          >
            <ShopIcon size={18} filled={tab === "shop"} />
            <span>商城</span>
          </button>
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "settings" ? "active" : ""}`}
            onClick={() => handleTabChange("settings")}
          >
            <SettingsIcon size={18} filled={tab === "settings"} />
            <span>设置</span>
          </button>
        </nav>
      </header>

      {/* 4 大核心 Tab 主体内容区 */}
      <main className="main-content-container" style={{ minHeight: "calc(100vh - 140px)" }}>
        {initialLoading ? (
          <div style={{ textAlign: "center", padding: "60px 16px", color: "var(--muted)" }}>
            <p style={{ fontSize: "0.9rem", fontWeight: 500 }}>正在载入…</p>
          </div>
        ) : tab === "today" ? (
          <TodayDashboard
            token={token}
            children={children}
            activeChild={activeChild}
            onSelectChild={handleChildChange}
            onRefreshMeta={refreshGlobalMeta}
            onExpired={clearSession}
            onNavigateSettings={() => handleTabChange("settings")}
          />
        ) : tab === "analytics" ? (
          <Analytics
            token={token}
            isActive={tab === "analytics"}
            onExpired={clearSession}
          />
        ) : tab === "shop" ? (
          <Shop
            token={token}
            isActive={tab === "shop"}
            onExpired={clearSession}
          />
        ) : tab === "settings" ? (
          <Settings
            token={token}
            children={children}
            onRefreshChildren={refreshGlobalMeta}
            onLogout={clearSession}
            onExpired={clearSession}
          />
        ) : (
          <TodayDashboard
            token={token}
            children={children}
            activeChild={activeChild}
            onSelectChild={handleChildChange}
            onRefreshMeta={refreshGlobalMeta}
            onExpired={clearSession}
            onNavigateSettings={() => handleTabChange("settings")}
          />
        )}
      </main>

      {/* 移动端专用规范 4 栏底部 TabBar (<768px 显示，桌面端由 CSS display:none 隐藏) */}
      <nav className="bottom-tabbar" role="navigation">
        <button
          type="button"
          className={`tab-item ${tab === "today" ? "active" : ""}`}
          onClick={() => handleTabChange("today")}
        >
          <span className="tab-icon">
            <TodayIcon size={22} filled={tab === "today"} />
          </span>
          <span className="tab-label">今天</span>
          {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
        </button>
        <button
          type="button"
          className={`tab-item ${tab === "analytics" ? "active" : ""}`}
          onClick={() => handleTabChange("analytics")}
        >
          <span className="tab-icon">
            <AnalyticsIcon size={22} filled={tab === "analytics"} />
          </span>
          <span className="tab-label">统计</span>
        </button>
        <button
          type="button"
          className={`tab-item ${tab === "shop" ? "active" : ""}`}
          onClick={() => handleTabChange("shop")}
        >
          <span className="tab-icon">
            <ShopIcon size={22} filled={tab === "shop"} />
          </span>
          <span className="tab-label">商城</span>
        </button>
        <button
          type="button"
          className={`tab-item ${tab === "settings" ? "active" : ""}`}
          onClick={() => handleTabChange("settings")}
        >
          <span className="tab-icon">
            <SettingsIcon size={22} filled={tab === "settings"} />
          </span>
          <span className="tab-label">设置</span>
        </button>
      </nav>
    </>
  );
}
