import { useState, useEffect, useCallback } from "react";
import api from "../api.js";

function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hr = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${m}-${day} ${hr}:${min}`;
  } catch {
    return isoStr;
  }
}

export default function StreakFreezeModal({
  isOpen,
  onClose,
  token,
  childId,
  childName,
  onUpdated,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Settings form state
  const [starCost, setStarCost] = useState("5.00");
  const [maxLimit, setMaxLimit] = useState(2);
  const [monthlyGrant, setMonthlyGrant] = useState(1);
  const [savingSettings, setSavingSettings] = useState(false);

  // Manual adjust state
  const [adjusting, setAdjusting] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(null); // 'grant' | 'deduct' | null
  const [adjustReason, setAdjustReason] = useState("");

  const loadData = useCallback(async () => {
    if (!token || !childId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.fetchChildFreeze(token, childId);
      setData(res);
      setStarCost(res.star_cost ? String(Number(res.star_cost)) : "5");
      setMaxLimit(res.max_limit ?? 2);
      setMonthlyGrant(res.monthly_grant ?? 1);
    } catch (err) {
      setError("获取保护卡信息失败: " + (err.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }, [token, childId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setActionSuccess("");
      setShowAdjustDialog(null);
      setAdjustReason("");
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setError("");
    setActionSuccess("");
    try {
      const updated = await api.updateFreezeSettings(token, childId, {
        star_cost: Number(starCost),
        max_limit: Number(maxLimit),
        monthly_grant: Number(monthlyGrant),
      });
      setData(updated);
      setActionSuccess("✅ 保护卡规则设置已保存！");
      if (onUpdated) onUpdated();
    } catch (err) {
      setError("保存规则失败: " + (err.message || "未知错误"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmAdjust = async () => {
    if (!showAdjustDialog) return;
    const delta = showAdjustDialog === "grant" ? 1 : -1;
    setAdjusting(true);
    setError("");
    setActionSuccess("");
    try {
      const defaultReason = delta > 0 ? "生病特许免打卡" : "家长手动调减";
      const reasonText = adjustReason.trim() || defaultReason;
      const updated = await api.adjustChildFreeze(token, childId, delta, reasonText);
      setData(updated);
      setActionSuccess(delta > 0 ? "🎁 成功奖励 1 张保护卡！" : "⚠️ 成功扣除 1 张保护卡！");
      setShowAdjustDialog(null);
      setAdjustReason("");
      if (onUpdated) onUpdated();
    } catch (err) {
      setError("操作失败: " + (err.message || "未知错误"));
    } finally {
      setAdjusting(false);
    }
  };

  const availableCount = data?.available_count ?? 0;
  const currentMaxLimit = data?.max_limit ?? 2;
  const isFull = availableCount >= currentMaxLimit;

  return (
    <div className="ios-sheet-overlay" onClick={onClose}>
      <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle-bar" />
        {/* Header */}
        <div className="ios-sheet-header">
          <div style={{ width: 44 }} />
          <span className="ios-sheet-header-title">连击保护卡 · {childName || "孩子"}</span>
          <button type="button" onClick={onClose} className="ios-sheet-nav-action-btn">
            完成
          </button>
        </div>

        {/* Banners */}
        {error && (
          <div style={styles.errorBanner}>
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} style={styles.bannerClose}>✕</button>
          </div>
        )}
        {actionSuccess && (
          <div style={styles.successBanner}>
            <span>{actionSuccess}</span>
            <button type="button" onClick={() => setActionSuccess("")} style={styles.bannerClose}>✕</button>
          </div>
        )}

        {loading && !data ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "2rem 0" }}>加载保护卡数据中…</p>
        ) : (
          <div className="ios-sheet-body">
            {/* Section 1: 当前持有与手动奖惩 */}
            <div style={styles.sectionCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={styles.sectionHeaderTitle}>📦 孩子当前拥有</span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    background: isFull ? "var(--protect-bg)" : availableCount > 0 ? "var(--accent-light)" : "var(--danger-bg)",
                    color: isFull ? "var(--protect)" : availableCount > 0 ? "var(--accent)" : "var(--danger)",
                    fontWeight: 700,
                    border: `1px solid ${isFull ? "var(--protect-border)" : availableCount > 0 ? "var(--accent-pill)" : "var(--danger-border)"}`,
                  }}
                >
                  {isFull ? "● 已达持有上限" : availableCount > 0 ? "● 余量充足" : "● 无可用卡"}
                </span>
              </div>

              <div style={styles.stockDisplayRow}>
                <span style={{ fontSize: "2.2rem" }}>❄️</span>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)" }}>
                      {availableCount}
                    </span>
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 600 }}>
                      / 上限 {currentMaxLimit} 张
                    </span>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    遗漏打卡日将自动抵扣保活连续坚持
                  </p>
                </div>
              </div>

              {/* Adjust Actions */}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  disabled={availableCount <= 0 || adjusting}
                  onClick={() => {
                    setShowAdjustDialog("deduct");
                    setAdjustReason("");
                  }}
                  style={{
                    ...styles.actionBtn,
                    background: availableCount <= 0 ? "var(--border-subtle)" : "var(--danger-bg)",
                    color: availableCount <= 0 ? "var(--muted)" : "var(--danger)",
                    borderColor: availableCount <= 0 ? "var(--border)" : "var(--danger-border)",
                    cursor: availableCount <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  - 扣除 1 张 (手动调减)
                </button>
                <button
                  type="button"
                  disabled={adjusting}
                  onClick={() => {
                    setShowAdjustDialog("grant");
                    setAdjustReason("");
                  }}
                  style={{
                    ...styles.actionBtn,
                    background: "var(--protect-bg)",
                    color: "var(--protect)",
                    borderColor: "var(--protect-border)",
                  }}
                >
                  + 奖励 1 张 (生病/特别表现)
                </button>
              </div>

              {/* Inline Adjust Dialog */}
              {showAdjustDialog && (
                <div style={styles.adjustBox}>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                    {showAdjustDialog === "grant" ? "🎁 确认奖励 1 张保护卡" : "⚠️ 确认调减 1 张保护卡"}
                  </p>
                  {showAdjustDialog === "grant" && isFull && (
                    <p style={{ fontSize: "0.75rem", color: "var(--flame)", marginBottom: "6px" }}>
                      *提示：当前已达持有上限({currentMaxLimit}张)，发放将作为特殊特许突破上限。
                    </p>
                  )}
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder={showAdjustDialog === "grant" ? "请输入奖励理由，如：发烧生病特许免打卡" : "请输入调减理由，如：误发撤回"}
                    style={styles.input}
                    maxLength={100}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setShowAdjustDialog(null)}
                      style={styles.cancelSmallBtn}
                      disabled={adjusting}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAdjust}
                      disabled={adjusting}
                      style={{
                        ...styles.confirmSmallBtn,
                        background: showAdjustDialog === "grant" ? "var(--protect)" : "var(--danger)",
                      }}
                    >
                      {adjusting ? "处理中…" : "确认"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: 规则设置 */}
            <div style={styles.sectionCard}>
              <span style={styles.sectionHeaderTitle}>规则设置</span>

              <form onSubmit={handleSaveSettings} style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* 星星兑换单价 */}
                <div>
                  <label style={styles.label}>
                    星星商城兑换单价 (1 ~ 50 星):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setStarCost((c) => String(Math.max(1, Number(c) - 1)))}
                      style={styles.stepperBtn}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      step="1"
                      value={starCost}
                      onChange={(e) => setStarCost(e.target.value)}
                      style={{ ...styles.input, textAlign: "center", width: "90px" }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setStarCost((c) => String(Math.min(50, Number(c) + 1)))}
                      style={styles.stepperBtn}
                    >
                      +
                    </button>
                    <span style={{ fontSize: "0.85rem", color: "var(--star)", fontWeight: 700 }}>
                      ⭐ 颗星星 / 张
                    </span>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "3px" }}>
                    孩子在 iPad 星星商城兑换 1 张保护卡所消耗的星星
                  </p>
                </div>

                {/* 最大持有上限 */}
                <div>
                  <label style={styles.label}>
                    最大持有上限 (防过度囤积):
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[1, 2, 3, 5].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setMaxLimit(lim)}
                        style={{
                          ...styles.optionPill,
                          ...(maxLimit === lim ? styles.optionPillActive : {}),
                        }}
                      >
                        {lim} 张 {lim === 2 ? "(推荐)" : ""}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "3px" }}>
                    达到上限后孩子将无法继续在商城购买，避免逃避打卡
                  </p>
                </div>

                {/* 每月初自动赠送 */}
                <div>
                  <label style={styles.label}>
                    每月初自动保底赠送:
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[
                      { val: 0, label: "不赠送 (0张)" },
                      { val: 1, label: "每月1日赠送 1 张 (推荐)" },
                      { val: 2, label: "每月1日赠送 2 张" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setMonthlyGrant(opt.val)}
                        style={{
                          ...styles.optionPill,
                          ...(monthlyGrant === opt.val ? styles.optionPillActive : {}),
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="btn-primary"
                    style={{ padding: "6px 14px", fontSize: "0.85rem", borderRadius: "var(--radius-pill)" }}
                  >
                    {savingSettings ? "保存中…" : "保存规则修改"}
                  </button>
                </div>
              </form>
            </div>

            {/* Section 3: 抵扣与流转历史明细 */}
            <div style={styles.sectionCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={styles.sectionHeaderTitle}>📜 卡片变动记录</span>
                <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                  共 {data?.history?.length ?? data?.usages?.length ?? 0} 条明细
                </span>
              </div>

              {(!data?.history || data.history.length === 0) && (!data?.usages || data.usages.length === 0) ? (
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", textAlign: "center", padding: "1.2rem 0" }}>
                  暂无连击保护卡使用与变动记录
                </p>
              ) : (
                <div style={styles.historyList}>
                  {data?.history && data.history.length > 0 ? (
                    data.history.map((item) => {
                      const isGrant = item.delta > 0;
                      let typeLabel = "变动";
                      let icon = "❄️";
                      if (item.event_type === "manual_grant") {
                        typeLabel = "家长手动奖励";
                        icon = "🎁";
                      } else if (item.event_type === "manual_deduct") {
                        typeLabel = "家长手动扣除";
                        icon = "⚠️";
                      } else if (item.event_type === "auto_deduct") {
                        typeLabel = "遗漏自动保活";
                        icon = "🤖";
                      } else if (item.event_type === "shop_purchase") {
                        typeLabel = "商城星星兑换";
                        icon = "⭐";
                      } else if (item.event_type === "monthly_grant") {
                        typeLabel = "每月例行赠送";
                        icon = "📅";
                      }

                      return (
                        <div key={item.id} style={styles.historyItem}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong style={{ fontSize: "0.82rem", color: "var(--text)" }}>{typeLabel}</strong>
                                <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                                  {formatDate(item.created_at)}
                                </span>
                              </div>
                              <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "1px" }}>
                                {item.reason || (item.target_date ? `抵扣日期: ${item.target_date}` : "系统操作")}
                              </p>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 800,
                                color: isGrant ? "var(--accent)" : "var(--flame)",
                              }}
                            >
                              {isGrant ? `+${item.delta}` : item.delta} 张
                            </span>
                            <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                              余 {item.balance_after} 张
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    data?.usages?.map((u) => (
                      <div key={u.id} style={styles.historyItem}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "1.1rem" }}>🤖</span>
                          <div>
                            <strong style={{ fontSize: "0.82rem", color: "var(--text)" }}>遗漏自动抵扣</strong>
                            <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                              抵扣日期: {u.used_date} ({u.reason || "自动保活"})
                            </p>
                          </div>
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--flame)" }}>
                          -1 张
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(35, 45, 40, 0.48)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modal: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-hover)",
    width: "100%",
    maxWidth: "480px",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "var(--card-subtle)",
  },
  title: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "var(--text)",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--muted)",
    cursor: "pointer",
    padding: "4px 8px",
  },
  content: {
    padding: "14px 18px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionCard: {
    backgroundColor: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-sm)",
    padding: "12px 14px",
  },
  sectionHeaderTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--text)",
  },
  stockDisplayRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "6px 0",
  },
  actionBtn: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.8rem",
    fontWeight: 700,
    border: "1px solid",
    cursor: "pointer",
    transition: "transform 0.1s ease",
  },
  adjustBox: {
    marginTop: "10px",
    padding: "10px",
    backgroundColor: "var(--card)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
  },
  label: {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: 650,
    color: "var(--text)",
    marginBottom: "4px",
  },
  input: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--text)",
    fontSize: "0.82rem",
    boxSizing: "border-box",
    width: "100%",
  },
  stepperBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--text)",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  optionPill: {
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.75rem",
    fontWeight: 600,
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--muted)",
    cursor: "pointer",
    transition: "all 0.12s ease",
  },
  optionPillActive: {
    backgroundColor: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#FFFFFF",
    boxShadow: "0 1px 4px rgba(67, 106, 84, 0.2)",
  },
  cancelSmallBtn: {
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  confirmSmallBtn: {
    padding: "4px 12px",
    borderRadius: "6px",
    border: "none",
    color: "#FFFFFF",
    fontSize: "0.75rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxHeight: "180px",
    overflowY: "auto",
  },
  historyItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 8px",
    borderRadius: "6px",
    backgroundColor: "var(--card)",
    border: "1px solid var(--border-subtle)",
  },
  errorBanner: {
    margin: "10px 18px 0 18px",
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "var(--danger-bg)",
    border: "1px solid var(--danger-border)",
    color: "var(--danger)",
    fontSize: "0.8rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successBanner: {
    margin: "10px 18px 0 18px",
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "var(--accent-light)",
    border: "1px solid var(--accent-pill)",
    color: "var(--accent)",
    fontSize: "0.8rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerClose: {
    background: "transparent",
    border: "none",
    color: "inherit",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.9rem",
  },
};
