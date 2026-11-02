import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login.jsx";
import TodayDashboard from "./pages/TodayDashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Shop from "./pages/Shop.jsx";
import Settings from "./pages/Settings.jsx";
import api from "./api.js";
import useSseRefresh from "./hooks/useSseRefresh.js";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("parent_token"));
  const [tab, setTab] = useState(() => localStorage.getItem("parent_active_tab") || "today");
  const [children, setChildren] = useState([]);
  const [activeChildId, setActiveChildId] = useState(() => localStorage.getItem("parent_active_child_id") || "");
  const [totalPending, setTotalPending] = useState(0);

  function clearSession() {
    localStorage.removeItem("parent_token");
    setToken(null);
  }

  // Token expiration check
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        clearSession();
      }
    } catch {
      clearSession();
    }
  }, [token]);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    localStorage.setItem("parent_active_tab", nextTab);
  };

  const handleChildChange = (childId) => {
    setActiveChildId(childId);
    localStorage.setItem("parent_active_child_id", childId);
  };

  // Refresh children list and aggregate pending review tasks count
  const refreshGlobalMeta = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.fetchChildren(token);
      setChildren(list);
      if (list.length > 0 && (!activeChildId || !list.find((c) => c.id === activeChildId))) {
        setActiveChildId(list[0].id);
        localStorage.setItem("parent_active_child_id", list[0].id);
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
    }
  }, [token, activeChildId]);

  useEffect(() => {
    refreshGlobalMeta();
  }, [refreshGlobalMeta]);

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
      {/* 一体化响应式 Header：手机端极简品牌栏（无胶囊、无退出），桌面端呈现顶部 4 栏导航 */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.3rem" }}>🌱</span>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent)" }}>Family Plan</h1>
        </div>

        {/* 桌面端顶部导航链接（>=768px 显示，移动端由 CSS display:none 隐藏） */}
        <nav className="desktop-nav-links" role="navigation">
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "today" ? "active" : ""}`}
            onClick={() => handleTabChange("today")}
          >
            <span>📌 今日看板</span>
            {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
          </button>
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "analytics" ? "active" : ""}`}
            onClick={() => handleTabChange("analytics")}
          >
            📊 成长统计
          </button>
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "shop" ? "active" : ""}`}
            onClick={() => handleTabChange("shop")}
          >
            🎁 星星商城
          </button>
          <button
            type="button"
            className={`desktop-nav-btn ${tab === "settings" ? "active" : ""}`}
            onClick={() => handleTabChange("settings")}
          >
            ⚙️ 我的设置
          </button>
        </nav>
      </header>

      {/* 4 大核心 Tab 主体内容区 */}
      <main style={{ minHeight: "calc(100vh - 160px)" }}>
        {tab === "today" && (
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
        {tab === "analytics" && (
          <Analytics
            token={token}
            isActive={tab === "analytics"}
            onExpired={clearSession}
          />
        )}
        {tab === "shop" && (
          <Shop
            token={token}
            isActive={tab === "shop"}
            onExpired={clearSession}
          />
        )}
        {tab === "settings" && (
          <Settings
            token={token}
            children={children}
            onRefreshChildren={refreshGlobalMeta}
            onLogout={clearSession}
            onExpired={clearSession}
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
          <span className="tab-icon">📌</span>
          <span className="tab-label">今日看板</span>
          {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
        </button>
        <button
          type="button"
          className={`tab-item ${tab === "analytics" ? "active" : ""}`}
          onClick={() => handleTabChange("analytics")}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">成长统计</span>
        </button>
        <button
          type="button"
          className={`tab-item ${tab === "shop" ? "active" : ""}`}
          onClick={() => handleTabChange("shop")}
        >
          <span className="tab-icon">🎁</span>
          <span className="tab-label">星星商城</span>
        </button>
        <button
          type="button"
          className={`tab-item ${tab === "settings" ? "active" : ""}`}
          onClick={() => handleTabChange("settings")}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">我的设置</span>
        </button>
      </nav>
    </>
  );
}
