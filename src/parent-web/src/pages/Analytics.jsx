import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { alignHeatmapToCalendar } from "../utils/calendar.js";
import StreakFreezeModal from "../components/StreakFreezeModal.jsx";
import { useFeedback } from "../components/FeedbackContext.jsx";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const STATUS_CONFIG = {
  perfect: { label: "满分达标", color: "#248A3D", bg: "var(--cell-perfect)", icon: "🌲" },
  qualified: { label: "达标完成", color: "#34C759", bg: "var(--cell-qualified)", icon: "🌱" },
  missed: { label: "未达标", color: "#FF3B30", bg: "var(--cell-missed)", icon: "🍂" },
  rest: { label: "休息日", color: "#86868B", bg: "var(--cell-rest)", icon: "☁️" },
  vacation: { label: "休假中", color: "#FF9500", bg: "var(--cell-vacation)", icon: "🌴" },
  frozen: { label: "保护卡抵扣", color: "#00C7BE", bg: "var(--cell-frozen)", icon: "❄️" },
};

const CATEGORY_ICONS = {
  学习思考: "📚",
  体育运动: "🏃",
  生活自理: "🪥",
  家务协助: "🧹",
};

export default function Analytics({ token, isActive, onExpired }) {
  const { toast, confirm } = useFeedback();

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [days, setDays] = useState(30);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [freezeInfo, setFreezeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vacation modal
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [vacations, setVacations] = useState([]);
  const [vacationLoading, setVacationLoading] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [vacationError, setVacationError] = useState("");

  // Selected cell hover/click preview
  const [selectedCell, setSelectedCell] = useState(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);

  const alignedHeatmap = useMemo(() => {
    return alignHeatmapToCalendar(analyticsData?.heatmap || []);
  }, [analyticsData?.heatmap]);

  // Initial load children
  const loadChildren = useCallback(async () => {
    try {
      const list = await api.fetchChildren(token);
      setChildren(list);
      if (list.length > 0 && !selectedChildId) {
        setSelectedChildId(list[0].id);
      }
    } catch (err) {
      setError("加载人员失败: " + (err.message || "未知错误"));
    }
  }, [token, selectedChildId]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // Load analytics and freeze info for selected child
  const loadData = useCallback(async () => {
    if (!selectedChildId) return;
    setLoading(true);
    setError(null);
    try {
      const [ana, freeze] = await Promise.all([
        api.fetchAnalytics(token, selectedChildId, days),
        api.fetchChildFreeze(token, selectedChildId).catch(() => null),
      ]);
      setAnalyticsData(ana);
      setFreezeInfo(freeze);
      // Default select the last day in heatmap
      if (ana?.heatmap?.length > 0) {
        setSelectedCell(ana.heatmap[ana.heatmap.length - 1]);
      }
    } catch (err) {
      setError("加载成长数据失败: " + (err.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }, [token, selectedChildId, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useSseRefresh({
    token,
    enabled: isActive,
    topics: ["tasks", "settings", "shop"],
    onRefresh: loadData,
    onExpired,
  });
  useVisibilityRefresh({ enabled: isActive, onRefresh: loadData });

  // Vacation actions
  const loadVacations = async () => {
    if (!selectedChildId) return;
    setVacationLoading(true);
    setVacationError("");
    try {
      const list = await api.fetchVacations(token, selectedChildId);
      setVacations(list);
    } catch (err) {
      setVacationError("获取休假列表失败: " + (err.message || "未知错误"));
    } finally {
      setVacationLoading(false);
    }
  };

  const handleOpenVacationModal = () => {
    setShowVacationModal(true);
    loadVacations();
  };

  const handleCreateVacation = async (e) => {
    e.preventDefault();
    if (!vacationForm.start_date || !vacationForm.end_date) {
      setVacationError("请选择休假起始和结束日期");
      return;
    }
    if (vacationForm.start_date > vacationForm.end_date) {
      setVacationError("结束日期必须在开始日期之后或当天");
      return;
    }
    setVacationError("");
    try {
      await api.createVacation(token, selectedChildId, {
        start_date: vacationForm.start_date,
        end_date: vacationForm.end_date,
        reason: vacationForm.reason || null,
      });
      setVacationForm({ start_date: "", end_date: "", reason: "" });
      await loadVacations();
      loadData();
    } catch (err) {
      setVacationError("创建休假失败: " + (err.message || "未知错误"));
    }
  };

  const handleDeleteVacation = async (vacationId) => {
    const ok = await confirm({
      title: "删除休假记录",
      message: "确定删除这条休假记录吗？删除后该日期将恢复正常习惯考核。",
      confirmText: "删除",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteVacation(token, selectedChildId, vacationId);
      toast.success("休假记录已删除");
      await loadVacations();
      loadData();
    } catch (err) {
      setVacationError("删除休假失败: " + (err.message || "未知错误"));
    }
  };

  const currentChild = children.find((c) => c.id === selectedChildId);

  return (
    <div style={{ paddingBottom: "2rem" }}>
      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>成长看板</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>统计分析与连击防断签</p>
        </div>
        <button onClick={handleOpenVacationModal} style={styles.vacationBtn}>
          🌴 休假管理
        </button>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", overflowX: "auto", paddingBottom: "4px" }}>
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChildId(c.id)}
              style={{
                ...styles.childTab,
                ...(c.id === selectedChildId ? styles.childTabActive : {}),
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Time Range Selector & Freeze status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={styles.toggleGroup}>
          <button
            onClick={() => setDays(30)}
            style={{ ...styles.toggleBtn, ...(days === 30 ? styles.toggleBtnActive : {}) }}
          >
            30 天
          </button>
          <button
            onClick={() => setDays(90)}
            style={{ ...styles.toggleBtn, ...(days === 90 ? styles.toggleBtnActive : {}) }}
          >
            90 天
          </button>
        </div>

        {freezeInfo && (
          <button
            type="button"
            onClick={() => setShowFreezeModal(true)}
            style={{
              ...styles.freezeChip,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 1px 3px rgba(14, 116, 144, 0.12)",
              transition: "transform 0.12s ease",
            }}
            title="点击打开连击保护卡与补签管理抽屉"
          >
            <span>❄️ 连击保护卡 <strong>{freezeInfo.available_count}</strong> 张</span>
            <span style={{ fontSize: "0.68rem", opacity: 0.85, background: "rgba(14, 116, 144, 0.1)", padding: "1px 5px", borderRadius: "var(--radius-pill)" }}>管理⚙️</span>
          </button>
        )}
      </div>

      {loading && !analyticsData && (
        <p style={{ textAlign: "center", color: "var(--muted)", padding: "2rem 0" }}>加载统计中…</p>
      )}

      {analyticsData && (
        <>
          {/* Heatmap Card */}
          <div className="compact-heatmap-card" style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h2 style={styles.cardTitle}>📅 习惯微日历 ({days}天)</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {analyticsData.start_date} ~ {analyticsData.end_date}
              </span>
            </div>

            {/* Heatmap Grid */}
            <div style={styles.heatmapWrapper}>
              <div className="heatmap-matrix-box">
                {/* 星期微标行 */}
                <div className="weekday-header-row">
                  {WEEKDAYS.map((w, idx) => (
                    <span key={idx} className="weekday-micro-label">
                      {w}
                    </span>
                  ))}
                </div>

                {/* 7 列严格对齐微日历网格 */}
                <div className="micro-calendar-grid">
                  {alignedHeatmap.map((item) => {
                    if (item.isPlaceholder) {
                      return <div key={item.key} className="cell-placeholder" />;
                    }
                    const isSelected = selectedCell?.date === item.date;
                    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.rest;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => setSelectedCell(item)}
                        title={`${item.date}: ${cfg.label} (${item.completed_tasks}/${item.total_tasks})`}
                        className={`heatmap-cell status-${item.status} ${isSelected ? "selected" : ""}`}
                      >
                        {item.status === "frozen" && "❄️"}
                        {item.status === "vacation" && "🌴"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 内联单行详情微胶囊 */}
              {selectedCell && (
                <div className={`selected-pill status-${selectedCell.status}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "0.85rem" }}>
                      {selectedCell.status === "frozen" ? "❄️" : selectedCell.status === "vacation" ? "🌴" : STATUS_CONFIG[selectedCell.status]?.icon || "🌟"}
                    </span>
                    <strong style={{ fontSize: "0.78rem" }}>{selectedCell.date}</strong>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "1px 6px",
                        borderRadius: "var(--radius-pill)",
                        background: STATUS_CONFIG[selectedCell.status]?.bg || "var(--card-subtle)",
                        color: STATUS_CONFIG[selectedCell.status]?.color || "var(--text)",
                        fontWeight: 650,
                      }}
                    >
                      {STATUS_CONFIG[selectedCell.status]?.label || selectedCell.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    {selectedCell.total_tasks > 0
                      ? `完成 ${selectedCell.completed_tasks}/${selectedCell.total_tasks} 项 (${selectedCell.completion_rate}%)`
                      : "休息日无任务"}
                  </div>
                </div>
              )}

              {/* 单行横向微图例 */}
              <div className="compact-legend-row">
                <span className="legend-chip"><i className="dot dot-perfect" />完美</span>
                <span className="legend-chip"><i className="dot dot-qualified" />达标</span>
                <span className="legend-chip"><i className="dot dot-missed" />未达标</span>
                <span className="legend-chip">❄️ 保护</span>
                <span className="legend-chip">🌴 休假</span>
                <span className="legend-chip"><i className="dot dot-rest" />休息</span>
              </div>
            </div>
          </div>

          {/* Categories Progress Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>🎯 四维习惯分类完成率</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.7rem" }}>
              {analyticsData.categories.map((cat) => (
                <div key={cat.category}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                    <span>
                      {CATEGORY_ICONS[cat.category] || "📌"} <strong>{cat.category}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "6px" }}>
                        ({cat.completed_tasks}/{cat.total_tasks} 项)
                      </span>
                    </span>
                    <strong style={{ color: cat.completion_rate >= 80 ? "var(--accent)" : "inherit" }}>
                      {cat.completion_rate}%
                    </strong>
                  </div>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressBar,
                        width: `${cat.completion_rate}%`,
                        backgroundColor: cat.completion_rate >= 80 ? "var(--cell-perfect)" : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>💡 自律洞察与表现</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginTop: "0.8rem" }}>
              {/* Best habit */}
              <div style={styles.insightBox}>
                <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700, marginBottom: "4px" }}>
                  🌟 最易坚持习惯
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                  {analyticsData.insights.best_habit?.title || "暂无足够数据"}
                </div>
                {analyticsData.insights.best_habit && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>
                    完成 {analyticsData.insights.best_habit.completed_count}/
                    {analyticsData.insights.best_habit.total_count} 次 ({analyticsData.insights.best_habit.completion_rate}%)
                  </div>
                )}
              </div>

              {/* Attention needed */}
              <div style={{ ...styles.insightBox, background: "var(--danger-bg)", borderColor: "var(--danger-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 700, marginBottom: "4px" }}>
                  🎯 最需关注任务
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--danger)" }}>
                  {analyticsData.insights.attention_needed?.title || "保持优秀，无"}
                </div>
                {analyticsData.insights.attention_needed && (
                  <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "4px" }}>
                    完成率 {analyticsData.insights.attention_needed.completion_rate}% (缺{" "}
                    {analyticsData.insights.attention_needed.total_count - analyticsData.insights.attention_needed.completed_count} 次)
                  </div>
                )}
              </div>
            </div>

            {/* Streak & Star Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.8rem" }}>
              <div style={styles.metricItem}>
                <div style={styles.metricVal}>🔥 {analyticsData.insights.streak.current_streak_days}</div>
                <div style={styles.metricLbl}>当前连击</div>
              </div>
              <div style={styles.metricItem}>
                <div style={styles.metricVal}>🏆 {analyticsData.insights.streak.longest_streak_days}</div>
                <div style={styles.metricLbl}>最长连击</div>
              </div>
              <div style={styles.metricItem}>
                <div style={styles.metricVal}>❄️ {analyticsData.insights.streak.freeze_usages_count}</div>
                <div style={styles.metricLbl}>保护卡使用</div>
              </div>
              <div style={styles.metricItem}>
                <div style={styles.metricVal}>🌴 {analyticsData.insights.streak.vacation_days_count}</div>
                <div style={styles.metricLbl}>休假天数</div>
              </div>
            </div>

            <div style={{ marginTop: "0.8rem", paddingTop: "0.8rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
              <span>⭐ 本期获得: <strong style={{ color: "var(--star)" }}>+{formatStars(analyticsData.insights.stars.stars_earned)}</strong></span>
              <span>🛍️ 本期兑换: <strong style={{ color: "var(--text)" }}>-{formatStars(analyticsData.insights.stars.stars_spent)}</strong></span>
              <span>💰 结余: <strong style={{ color: "var(--accent)" }}>{formatStars(analyticsData.insights.stars.current_stars)}</strong></span>
            </div>
          </div>
        </>
      )}

      {/* Vacation Management Modal (iOS 底部抽屉 Sheet) */}
      {showVacationModal && (
        <div className="ios-sheet-overlay" onClick={() => setShowVacationModal(false)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <span className="ios-sheet-header-title">休假模式管理</span>
              <button type="button" onClick={() => setShowVacationModal(false)} className="ios-sheet-close-btn">取消</button>
            </div>

            <div className="ios-sheet-body">
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
                休假模式开启后，所设区间内每天自动豁免，任务未完成不扣减连击天数。
              </p>

              {/* Create Vacation Form */}
              <form onSubmit={handleCreateVacation} style={{ marginBottom: "1.2rem", background: "#FFFFFF", border: "1px solid var(--border)", padding: "14px", borderRadius: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <div>
                    <label style={styles.inputLabel}>开始日期</label>
                    <input
                      type="date"
                      required
                      value={vacationForm.start_date}
                      onChange={(e) => setVacationForm({ ...vacationForm, start_date: e.target.value })}
                      style={styles.modalInput}
                    />
                  </div>
                  <div>
                    <label style={styles.inputLabel}>结束日期</label>
                    <input
                      type="date"
                      required
                      value={vacationForm.end_date}
                      onChange={(e) => setVacationForm({ ...vacationForm, end_date: e.target.value })}
                      style={styles.modalInput}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "0.8rem" }}>
                  <label style={styles.inputLabel}>休假原因 (选填)</label>
                  <input
                    type="text"
                    placeholder="例如：期末出游、生病休养"
                    value={vacationForm.reason}
                    onChange={(e) => setVacationForm({ ...vacationForm, reason: e.target.value })}
                    style={styles.modalInput}
                  />
                </div>
                {vacationError && (
                  <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginBottom: "0.4rem" }}>{vacationError}</p>
                )}
                <button type="submit" className="ios-btn-primary" style={{ width: "100%", padding: "10px" }}>
                  + 登记新休假
                </button>
              </form>

              {/* Vacations List */}
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem" }}>已设置的休假</h4>
              {vacationLoading ? (
                <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>加载中…</p>
              ) : vacations.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "center", padding: "1rem 0" }}>
                  暂无休假记录
                </p>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {vacations.map((v) => (
                  <div key={v.id} style={styles.vacationItem}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 650 }}>
                        {v.start_date} ~ {v.end_date}
                      </div>
                      {v.reason && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{v.reason}</div>}
                    </div>
                    <button onClick={() => handleDeleteVacation(v.id)} style={styles.delBtn}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Streak Freeze Management Modal / Drawer */}
      <StreakFreezeModal
        isOpen={showFreezeModal}
        onClose={() => setShowFreezeModal(false)}
        token={token}
        childId={selectedChildId}
        childName={currentChild?.name}
        onUpdated={loadData}
      />
    </div>
  );
}

const styles = {
  card: {
    background: "var(--card)",
    borderRadius: "var(--radius)",
    padding: "1.1rem",
    marginBottom: "0.9rem",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-card)",
  },
  cardTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--text)",
  },
  vacationBtn: {
    padding: "0.35rem 0.75rem",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.8rem",
    fontWeight: 650,
    color: "#FFFFFF",
    background: "var(--flame)",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(194, 65, 12, 0.2)",
  },
  childTab: {
    padding: "0.3rem 0.8rem",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--muted)",
    background: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  childTabActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)",
  },
  toggleGroup: {
    display: "inline-flex",
    background: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    padding: "2px",
  },
  toggleBtn: {
    padding: "4px 12px",
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "var(--muted)",
    background: "transparent",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  toggleBtnActive: {
    background: "var(--card)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm)",
  },
  freezeChip: {
    fontSize: "0.75rem",
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    background: "var(--protect-bg)",
    color: "var(--protect)",
    border: "1px solid var(--protect-border)",
    fontWeight: 600,
  },
  heatmapWrapper: {
    background: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    padding: "0.8rem",
    borderRadius: "10px",
    marginBottom: "0.7rem",
  },
  selectedDetail: {
    background: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    padding: "0.5rem 0.8rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.6rem",
  },
  legendRow: {
    display: "flex",
    gap: "0.8rem",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingTop: "0.4rem",
    fontSize: "0.72rem",
    color: "var(--muted)",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "2px",
    display: "inline-block",
  },
  progressTrack: {
    height: "8px",
    background: "#E5E5EA",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  insightBox: {
    background: "var(--accent-light)",
    border: "1px solid var(--accent-pill)",
    borderRadius: "12px",
    padding: "0.8rem",
  },
  metricItem: {
    background: "#F5F5F7",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "0.6rem 0.4rem",
    textAlign: "center",
  },
  metricVal: {
    fontSize: "0.95rem",
    fontWeight: 700,
  },
  metricLbl: {
    fontSize: "0.68rem",
    color: "var(--muted)",
    marginTop: "2px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "saturate(180%) blur(16px)",
    WebkitBackdropFilter: "saturate(180%) blur(16px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
    padding: "16px",
  },
  modalContent: {
    background: "var(--card)",
    borderRadius: "var(--radius-lg)",
    padding: "1.4rem",
    maxWidth: "420px",
    width: "100%",
    boxShadow: "var(--shadow-hover)",
    border: "1px solid var(--border)",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    fontSize: "1.1rem",
    color: "var(--muted)",
    cursor: "pointer",
  },
  inputLabel: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: "0.2rem",
  },
  modalInput: {
    width: "100%",
    padding: "0.45rem 0.65rem",
    fontSize: "0.85rem",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    outline: "none",
    background: "var(--card)",
    color: "var(--text)",
  },
  submitBtn: {
    width: "100%",
    padding: "0.6rem",
    background: "var(--accent)",
    color: "#FFFFFF",
    fontWeight: 650,
    fontSize: "0.9rem",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)",
  },
  vacationItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.55rem 0.75rem",
    background: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "10px",
  },
  delBtn: {
    background: "transparent",
    border: "none",
    color: "var(--danger)",
    fontSize: "0.8rem",
    fontWeight: 650,
    cursor: "pointer",
  },
  errorBanner: {
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-border)",
    borderRadius: "10px",
    padding: "0.8rem 1rem",
    marginBottom: "0.8rem",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    color: "var(--danger)",
    fontSize: "0.85rem",
  },
  errorIcon: { fontSize: "1.1rem", fontWeight: 600 },
  errorClose: { marginLeft: "auto", fontSize: "0.9rem", color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 },
};
