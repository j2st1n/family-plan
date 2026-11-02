import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";

const STATUS_CONFIG = {
  perfect: { label: "满分达标", color: "#2da44e", bg: "#2da44e", icon: "🌲" },
  qualified: { label: "达标完成", color: "#66c282", bg: "#85e89d", icon: "🟩" },
  missed: { label: "未达标", color: "#cf222e", bg: "#fdaeb7", icon: "🟥" },
  rest: { label: "休息日", color: "#6e7781", bg: "#ebedf0", icon: "⬜" },
  vacation: { label: "休假中", color: "#d97706", bg: "#fde68a", icon: "🌴" },
  frozen: { label: "保护卡抵扣", color: "#0891b2", bg: "#a5f3fc", icon: "❄️" },
};

const CATEGORY_ICONS = {
  学习思考: "📚",
  体育运动: "🏃",
  生活自理: "🪥",
  家务协助: "🧹",
};

export default function Analytics({ token, isActive, onExpired }) {
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
    if (!window.confirm("确定删除这条休假记录吗？")) return;
    try {
      await api.deleteVacation(token, selectedChildId, vacationId);
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
          <div style={styles.freezeChip} title="每月初自动赠送1张，未达标日期自动抵扣">
            ❄️ 连击保护卡 <strong>{freezeInfo.available_count}</strong> 张
          </div>
        )}
      </div>

      {loading && !analyticsData && (
        <p style={{ textAlign: "center", color: "var(--muted)", padding: "2rem 0" }}>加载统计中…</p>
      )}

      {analyticsData && (
        <>
          {/* Heatmap Card */}
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <h2 style={styles.cardTitle}>📅 每日习惯达成热力图 ({days}天)</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {analyticsData.start_date} ~ {analyticsData.end_date}
              </span>
            </div>

            {/* Heatmap Grid */}
            <div style={styles.heatmapWrapper}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${days === 90 ? 13 : 7}, 1fr)`,
                  gap: "6px",
                }}
              >
                {analyticsData.heatmap.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.rest;
                  const isSelected = selectedCell?.date === item.date;
                  return (
                    <div
                      key={item.date}
                      onClick={() => setSelectedCell(item)}
                      title={`${item.date}: ${cfg.label} (${item.completed_tasks}/${item.total_tasks})`}
                      style={{
                        aspectRatio: "1",
                        borderRadius: "5px",
                        backgroundColor: cfg.bg,
                        border: isSelected ? "2px solid #2d2b28" : "1px solid rgba(0,0,0,0.06)",
                        cursor: "pointer",
                        transition: "transform 0.12s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.65rem",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
                    >
                      {item.status === "frozen" && "❄️"}
                      {item.status === "vacation" && "🌴"}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Cell Detail Info */}
            {selectedCell && (
              <div style={styles.selectedDetail}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "1rem" }}>
                    {STATUS_CONFIG[selectedCell.status]?.icon || "⬜"}
                  </span>
                  <strong style={{ fontSize: "0.9rem" }}>{selectedCell.date}</strong>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: STATUS_CONFIG[selectedCell.status]?.bg || "#eee",
                      color: STATUS_CONFIG[selectedCell.status]?.color || "#333",
                      fontWeight: 600,
                    }}
                  >
                    {STATUS_CONFIG[selectedCell.status]?.label}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {selectedCell.total_tasks > 0
                    ? `完成 ${selectedCell.completed_tasks}/${selectedCell.total_tasks} 项 (达成率 ${selectedCell.completion_rate}%)`
                    : "无安排任务 (休息日)"}
                </div>
              </div>
            )}

            {/* Heatmap Legend */}
            <div style={styles.legendRow}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: cfg.bg }} />
                  <span>{cfg.label}</span>
                </div>
              ))}
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
                        backgroundColor: cat.completion_rate >= 80 ? "#2da44e" : "#5b8fb9",
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
                <div style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 700, marginBottom: "4px" }}>
                  🌟 最易坚持习惯
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#166534" }}>
                  {analyticsData.insights.best_habit?.title || "暂无足够数据"}
                </div>
                {analyticsData.insights.best_habit && (
                  <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "4px" }}>
                    完成 {analyticsData.insights.best_habit.completed_count}/
                    {analyticsData.insights.best_habit.total_count} 次 ({analyticsData.insights.best_habit.completion_rate}%)
                  </div>
                )}
              </div>

              {/* Attention needed */}
              <div style={{ ...styles.insightBox, background: "#fef2f2", borderColor: "#fecaca" }}>
                <div style={{ fontSize: "0.75rem", color: "#b91c1c", fontWeight: 700, marginBottom: "4px" }}>
                  🎯 最需关注任务
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#991b1b" }}>
                  {analyticsData.insights.attention_needed?.title || "保持优秀，无"}
                </div>
                {analyticsData.insights.attention_needed && (
                  <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "4px" }}>
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

            <div style={{ marginTop: "0.8rem", paddingTop: "0.8rem", borderTop: "1px solid #f0ece6", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
              <span>⭐ 本期获得: <strong>+{formatStars(analyticsData.insights.stars.stars_earned)}</strong></span>
              <span>🛍️ 本期兑换: <strong>-{formatStars(analyticsData.insights.stars.stars_spent)}</strong></span>
              <span>💰 结余: <strong>{formatStars(analyticsData.insights.stars.current_stars)}</strong></span>
            </div>
          </div>
        </>
      )}

      {/* Vacation Management Modal */}
      {showVacationModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>🌴 休假模式管理</h3>
              <button onClick={() => setShowVacationModal(false)} style={styles.closeBtn}>✕</button>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
              休假模式开启后，所设区间内每天自动豁免，任务未完成不扣减连击天数。
            </p>

            {/* Create Vacation Form */}
            <form onSubmit={handleCreateVacation} style={{ marginBottom: "1.2rem", background: "#fbfaf8", padding: "0.8rem", borderRadius: "10px" }}>
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
              <div style={{ marginBottom: "0.6rem" }}>
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
                <p style={{ color: "#c97070", fontSize: "0.8rem", marginBottom: "0.4rem" }}>{vacationError}</p>
              )}
              <button type="submit" style={styles.submitBtn}>
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
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--card)",
    borderRadius: "var(--radius)",
    padding: "1rem",
    marginBottom: "0.9rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  cardTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--text)",
  },
  vacationBtn: {
    padding: "0.35rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 650,
    color: "#fff",
    background: "#d97706",
    border: "none",
    cursor: "pointer",
  },
  childTab: {
    padding: "0.3rem 0.8rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--muted)",
    background: "#eee",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  childTabActive: {
    background: "var(--accent)",
    color: "#fff",
  },
  toggleGroup: {
    display: "inline-flex",
    background: "#e8e4df",
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
    background: "#fff",
    color: "var(--text)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  },
  freezeChip: {
    fontSize: "0.75rem",
    padding: "4px 10px",
    borderRadius: "999px",
    background: "#ecfeff",
    color: "#0891b2",
    border: "1px solid #cffafe",
    fontWeight: 600,
  },
  heatmapWrapper: {
    background: "#fafaf9",
    padding: "0.8rem",
    borderRadius: "10px",
    marginBottom: "0.7rem",
  },
  selectedDetail: {
    background: "#f4f3f0",
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
    background: "#edebe8",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.4s ease",
  },
  insightBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "0.7rem",
  },
  metricItem: {
    background: "#f7f7f6",
    borderRadius: "8px",
    padding: "0.5rem 0.3rem",
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
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
    padding: "16px",
  },
  modalContent: {
    background: "#fff",
    borderRadius: "16px",
    padding: "1.2rem",
    maxWidth: "420px",
    width: "100%",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
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
    padding: "0.4rem 0.6rem",
    fontSize: "0.85rem",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    outline: "none",
  },
  submitBtn: {
    width: "100%",
    padding: "0.5rem",
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 650,
    fontSize: "0.85rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
  },
  vacationItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem 0.6rem",
    background: "#f7f7f6",
    borderRadius: "8px",
  },
  delBtn: {
    background: "transparent",
    border: "none",
    color: "#c97070",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBanner: {
    background: "#fef0f0",
    border: "1px solid #f8d0d0",
    borderRadius: "10px",
    padding: "0.8rem 1rem",
    marginBottom: "0.8rem",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    color: "#c97070",
    fontSize: "0.85rem",
  },
  errorIcon: { fontSize: "1.1rem", fontWeight: 600 },
  errorClose: { marginLeft: "auto", fontSize: "0.9rem", color: "#c97070", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 },
};
