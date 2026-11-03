import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { useFeedback } from "../components/FeedbackContext.jsx";
import WarmEmptyState from "../components/WarmEmptyState.jsx";

export default function Shop({ token, isActive, onExpired }) {
  const { toast, confirm } = useFeedback();

  const [items, setItems] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [showFulfilledRedemptions, setShowFulfilledRedemptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal dialog for Add / Edit Goods (keeping shelf list steady and solid)
  const [itemModal, setItemModal] = useState({ isOpen: false, mode: "create", itemId: null });
  const [modalForm, setModalForm] = useState({ title: "", stars: "", stock: "" });
  const [savingItem, setSavingItem] = useState(false);

  // Wishes approve stars state
  const [approveStars, setApproveStars] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.fetchShop(token);
      setItems(list);
    } catch (err) {
      setError("加载商品列表失败: " + (err.message || "未知错误"));
    }
    try {
      const reds = await api.fetchRedemptions(token);
      setRedemptions(reds);
    } catch (err) {
      setError("加载兑换记录失败: " + (err.message || "未知错误"));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useSseRefresh({ token, enabled: isActive, topics: ["shop"], onRefresh: load, onExpired });
  useVisibilityRefresh({ enabled: isActive, onRefresh: load });

  // Open Add Modal
  const openAddModal = () => {
    setModalForm({ title: "", stars: "", stock: "" });
    setItemModal({ isOpen: true, mode: "create", itemId: null });
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    setModalForm({
      title: item.title,
      stars: item.star_cost ? item.star_cost.toString() : "",
      stock: item.stock != null ? item.stock.toString() : "",
    });
    setItemModal({ isOpen: true, mode: "edit", itemId: item.id });
  };

  const closeItemModal = () => {
    setItemModal({ isOpen: false, mode: "create", itemId: null });
    setModalForm({ title: "", stars: "", stock: "" });
  };

  // Save Add or Edit
  const handleSaveModal = async () => {
    if (!modalForm.title.trim() || !modalForm.stars || Number(modalForm.stars) < 0.01) {
      toast.error("请填写正确的商品名称与所需星数");
      return;
    }
    const stock = modalForm.stock ? parseInt(modalForm.stock) : null;
    setSavingItem(true);
    try {
      if (itemModal.mode === "create") {
        await api.createShopItem(token, {
          title: modalForm.title.trim(),
          star_cost: Number(modalForm.stars),
          stock,
        });
        toast.success("商品上架成功！");
      } else {
        await api.updateShopItem(token, itemModal.itemId, {
          title: modalForm.title.trim(),
          star_cost: Number(modalForm.stars),
          stock,
        });
        toast.success("商品修改已保存！");
      }
      closeItemModal();
      load();
    } catch (err) {
      toast.error((itemModal.mode === "create" ? "上架失败: " : "保存失败: ") + (err.message || "未知错误"));
    } finally {
      setSavingItem(false);
    }
  };

  async function handleDelete(id) {
    const ok = await confirm({
      title: "下架商品",
      message: "确定要下架此商品吗？下架后儿童端将无法继续兑换。",
      confirmText: "下架",
      cancelText: "取消",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteShopItem(token, id);
      toast.success("商品已下架");
      load();
    } catch (err) {
      toast.error("删除商品失败: " + (err.message || "未知错误"));
    }
  }

  async function handleFulfill(id) {
    try {
      await api.fulfillItem(token, id);
      toast.success("已标记兑现！");
      load();
    } catch (err) {
      toast.error("兑现商品失败: " + (err.message || "未知错误"));
    }
  }

  async function handleApproveWish(id) {
    const stars = approveStars[id] || 10;
    try {
      await api.approveWish(token, id, Number(stars));
      setApproveStars((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      toast.success("已通过心愿上架！");
      load();
    } catch (err) {
      toast.error("审核许愿失败: " + (err.message || "未知错误"));
    }
  }

  async function handleRejectWish(id) {
    const ok = await confirm({
      title: "退回心愿",
      message: "确定要退回孩子提交的这个心愿吗？",
      confirmText: "退回",
      cancelText: "保留",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteShopItem(token, id);
      toast.success("已退回心愿");
      load();
    } catch (err) {
      toast.error("退回失败: " + (err.message || "未知错误"));
    }
  }

  const wishes = items.filter((i) => i.status === "pending");
  const active = items.filter((i) => i.status === "active");
  const pendingRedemptions = redemptions.filter((r) => r.redemption_status === "pending");
  const fulfilledRedemptions = redemptions.filter((r) => r.redemption_status === "fulfilled");

  if (loading && items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 16px", color: "var(--muted)" }}>
        <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>正在加载星星商城…</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div style={s.errorBanner}>
          <span style={s.errorIcon}>⚠</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={s.errorClose}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
            星星商城
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "2px" }}>
            商品货架管理、孩子心愿审核与星星兑换记录
          </p>
        </div>
        <button
          type="button"
          className="capsule-btn capsule-accent"
          onClick={openAddModal}
          style={{ padding: "6px 14px", fontSize: "0.82rem" }}
        >
          + 上架商品
        </button>
      </div>

      {/* Section 1: 货架商品 (整洁稳固，弹窗增改) */}
      <div style={s.section}>
        <div style={s.sectionHd}>
          <h3 style={s.sh}>货架商品</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{active.length} 件在售</span>
        </div>

        {active.length === 0 ? (
          <WarmEmptyState
            icon="box"
            title="货架空空如也"
            description="上架孩子心仪的奖励物品或体验，激发好习惯坚持动力！"
            actionText="+ 上架第一件商品"
            onAction={openAddModal}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {active.map((item) => (
              <div key={item.id} style={s.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 650, fontSize: "0.92rem", color: "var(--text)" }}>{item.title}</p>
                  {item.stock != null && (
                    <p style={{ fontSize: "0.74rem", color: "var(--danger)", marginTop: 2 }}>
                      库存剩余 {item.stock} 件
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.86rem", color: "var(--star)", fontWeight: 700, whiteSpace: "nowrap" }}>
                    ⭐ {formatStars(item.star_cost)}
                  </span>
                  {/* 雅致的胶囊微按钮：替换原本单字符 ✎ 和 ✕ */}
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="capsule-btn capsule-muted"
                  >编辑</button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="capsule-btn capsule-danger"
                  >下架</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: 心愿审核 */}
      {wishes.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHd}>
            <h3 style={s.sh}>孩子许愿审核</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--flame)", fontWeight: 700 }}>
              {wishes.length} 条待审核
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {wishes.map((w) => (
              <div key={w.id} style={s.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 650, fontSize: "0.92rem", color: "var(--text)" }}>{w.title}</p>
                  {w.description && (
                    <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>{w.description}</p>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>定价</span>
                    <input
                      type="number"
                      placeholder="10"
                      value={approveStars[w.id] || ""}
                      onChange={(e) => setApproveStars({ ...approveStars, [w.id]: e.target.value })}
                      className="form-input-journal"
                      style={{
                        width: "56px",
                        padding: "4px 6px",
                        fontSize: "0.82rem",
                        textAlign: "center",
                      }}
                    />
                    <span style={{ fontSize: "0.76rem", color: "var(--star)" }}>⭐</span>
                  </div>

                  {/* 雅致的胶囊微按钮：替换裸露的 ✓ 与 ✕ */}
                  <button
                    type="button"
                    onClick={() => handleApprove(w.id)}
                    className="capsule-btn capsule-accent"
                  >通过</button>
                  <button
                    type="button"
                    onClick={() => handleDelete(w.id)}
                    className="capsule-btn capsule-danger"
                  >退回</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: 已兑换 */}
      {redemptions.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHd}>
            <h3 style={s.sh}>兑换记录</h3>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              待兑现 {pendingRedemptions.length} · 已兑现 {fulfilledRedemptions.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingRedemptions.map((r) => (
              <div key={r.id} style={s.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 650, fontSize: "0.9rem", color: "var(--text)" }}>{r.title}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                    {redemptionPrice(r)}
                    {r.child_id ? " · 孩子发起" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFulfill(r.redemption_id)}
                  className="capsule-btn capsule-accent"
                >
                  兑现
                </button>
              </div>
            ))}
          </div>

          {fulfilledRedemptions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFulfilledRedemptions((v) => !v)}
              style={s.foldBtn}
            >
              {showFulfilledRedemptions ? "收起已兑现记录" : `展开已兑现记录 (${fulfilledRedemptions.length})`}
            </button>
          )}

          {showFulfilledRedemptions && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
              {fulfilledRedemptions.map((r) => (
                <div key={r.id} style={{ ...s.row, opacity: 0.85 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 650, fontSize: "0.9rem", color: "var(--text)" }}>{r.title}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                      {redemptionPrice(r)}
                      {r.child_id ? " · 孩子发起" : ""}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "var(--accent)", fontWeight: 650 }}>
                    已兑现
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          iOS 标准底部抽屉 Sheet：上架与编辑商品
          ========================================================================= */}
      {itemModal.isOpen && (
        <div className="ios-sheet-overlay" onClick={closeItemModal}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            <div className="ios-sheet-header">
              <span className="ios-sheet-header-title">
                {itemModal.mode === "create" ? "上架新商品" : "编辑商品"}
              </span>
              <button
                type="button"
                className="ios-sheet-close-btn"
                onClick={closeItemModal}
              >
                取消
              </button>
            </div>

            <div className="ios-sheet-body">
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                  商品名称 *
                </label>
                <input
                  type="text"
                  className="form-input-journal"
                  placeholder="如：游乐园门票、看动画片30分钟、乐高积木..."
                  value={modalForm.title}
                  onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                    所需星星 (⭐) *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    className="form-input-journal"
                    placeholder="如：10"
                    value={modalForm.stars}
                    onChange={(e) => setModalForm({ ...modalForm, stars: e.target.value })}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 650, color: "var(--muted)", marginBottom: "4px" }}>
                    库存数量 (选填)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input-journal"
                    placeholder="留空为不限"
                    value={modalForm.stock}
                    onChange={(e) => setModalForm({ ...modalForm, stock: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="button"
                className="ios-btn-primary"
                disabled={savingItem || !modalForm.title.trim()}
                onClick={handleSaveModal}
                style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}
              >
                {savingItem ? "保存中…" : itemModal.mode === "create" ? "确认上架" : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function redemptionPrice(r) {
  if (r.final_star_cost == null) return `⭐ ${formatStars(r.star_cost)}`;
  return `原价 ${formatStars(r.original_star_cost ?? r.star_cost)}⭐ · 支付 ${r.redemption_discount_percent ?? 100}% · 实付 ${formatStars(r.final_star_cost)}⭐`;
}

const s = {
  section: {
    background: "var(--card)",
    borderRadius: "var(--radius)",
    padding: "1.1rem",
    marginBottom: "0.85rem",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-card)",
  },
  sectionHd: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.8rem",
  },
  sh: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--text)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "var(--card-subtle)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "10px",
    padding: "0.65rem 0.85rem",
  },
  foldBtn: {
    width: "100%",
    padding: "0.45rem",
    fontSize: "0.82rem",
    color: "var(--muted)",
    border: "1px dashed var(--border)",
    borderRadius: "10px",
    background: "transparent",
    cursor: "pointer",
    margin: "0.5rem 0 0.2rem",
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
  errorIcon: {
    fontSize: "1.1rem",
    fontWeight: 600,
  },
  errorClose: {
    marginLeft: "auto",
    fontSize: "0.9rem",
    color: "var(--danger)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};
