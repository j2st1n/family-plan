import {affordability} from "../../../shared-web/affordability.js";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchShop, fetchToday, fetchChildFreeze, purchaseChildFreeze, redeemItem, makeWish, editWish } from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { childFeedback } from "../components/ChildFeedback.jsx";
import { SunIcon, MoonIcon } from "../components/Icons.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

function fmtDate(s) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export default function Shop({ onExpired, active }) {
  const [items, setItems] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [redeemed, setRedeemed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stars, setStars] = useState(null);
  const [redeemingId,setRedeemingId]=useState(null);
  const redeemingRef=useRef(false);
  const [showWish, setShowWish] = useState(false);
  const [showFulfilledRedemptions, setShowFulfilledRedemptions] = useState(false);
  const [wishForm, setWishForm] = useState({ title: "", desc: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", desc: "" });
  const [freezeInfo, setFreezeInfo] = useState(null);
  const [purchasingFreeze, setPurchasingFreeze] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (forceLoading = false) => {
    if (forceLoading || !hasLoadedRef.current) {
      setLoading(true);
    }
    setError("");
    try {
      const [all, today, freeze] = await Promise.all([
        fetchShop(onExpired),
        fetchToday(onExpired).catch((err) => { console.warn("Failed to load rewards", err); return null; }),
        fetchChildFreeze(onExpired).catch((err) => { console.warn("Failed to load freeze", err); return null; }),
      ]);
      if (all) {
        setItems(all.filter((i) => i.status === "active" && !i.redeemed_by_child));
        setWishes(all.filter((i) => i.status === "pending"));
        setRedeemed(all.filter((i) => i.redeemed_by_child));
      }
      if (today?.rewards) {
        setStars(today.rewards.stars_total ?? 0);
      }
      if (freeze) {
        setFreezeInfo(freeze);
      }
      hasLoadedRef.current = true;
    } catch (err) {
      if (err.message === "token_expired") {
        setError("登录已过期，请重新绑定");
        if (onExpired) onExpired();
      } else {
        setError("加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [onExpired]);

  useEffect(() => {
    if (active) load();
  }, [load, active]);

  useSseRefresh({ enabled: active, topics: ["shop", "tasks", "settings"], onRefresh: load, onExpired });
  useVisibilityRefresh({ enabled: active, onRefresh: load });

  async function handleRedeem(item) {
    const cost=item.discounted_star_cost ?? item.star_cost;
    if(redeemingRef.current || !affordability(stars,cost).canAfford || item.stock===0)return;
    redeemingRef.current=true;setRedeemingId(item.id);
    try {
      const ok=await childFeedback.confirm({title:"兑换商品",message:`用 ${formatStars(cost)}⭐ 兑换「${item.title}」？`,confirmText:"立即兑换",cancelText:"再想想",icon:"🎁"});
      if(!ok)return;
      const [today,goods]=await Promise.all([fetchToday(onExpired),fetchShop(onExpired)]);
      const current=goods.find(g=>g.id===item.id);
      const currentCost=current?.discounted_star_cost ?? current?.star_cost;
      if(!current || current.stock===0 || !affordability(today.rewards.stars_total,currentCost).canAfford){childFeedback.toast("余额或库存已变化，请重新选择");await load();return;}
      if(Number(currentCost)!==Number(cost)){childFeedback.toast("兑换价格已变化，请重新确认");await load();return;}
      await redeemItem(item.id,onExpired);await load();
    } catch(err){if(err.message==="token_expired")onExpired?.();else setError(err.message);}
    finally{redeemingRef.current=false;setRedeemingId(null);}
  }

  async function handleWish() {
    if (!wishForm.title.trim()) return;
    try {
      await makeWish(wishForm.title.trim(), wishForm.desc.trim() || null, onExpired);
      setWishForm({ title: "", desc: "" });
      setShowWish(false);
      load();
    } catch (err) {
      if (err.message === "token_expired") {
        setError("登录已过期，请重新绑定");
        if (onExpired) onExpired();
      } else {
        setError(err.message);
      }
    }
  }

  function startEdit(w) {
    setEditingId(w.id);
    setEditForm({ title: w.title, desc: w.description || "" });
  }

  async function saveEdit() {
    if (!editForm.title.trim()) return;
    try {
      await editWish(editingId, editForm.title.trim(), editForm.desc.trim() || null, onExpired);
      setEditingId(null);
      load();
    } catch (err) {
      if (err.message === "token_expired") {
        setError("登录已过期，请重新绑定");
        if (onExpired) onExpired();
      } else {
        setError(err.message);
      }
    }
  }

  async function handlePurchaseFreeze() {
    if (purchasingFreeze) return;
    const cost = freezeInfo?.star_cost != null ? Number(freezeInfo.star_cost) : 5;
    const ok = await childFeedback.confirm({
      title: "购买连击保护卡",
      message: `用 ${cost}⭐ 购买 1 张连击保护卡？`,
      confirmText: "立即购买",
      cancelText: "再想想",
      icon: "❄️",
    });
    if (!ok) return;
    setPurchasingFreeze(true);
    try {
      const updated = await purchaseChildFreeze(onExpired);
      setFreezeInfo(updated);
      await load();
    } catch (err) {
      if (err.message === "token_expired") {
        setError("登录已过期，请重新绑定");
        if (onExpired) onExpired();
      } else {
        setError(err.message || "购买失败");
      }
    } finally {
      setPurchasingFreeze(false);
    }
  }

  if (loading && !hasLoadedRef.current) {
    return <p style={{ color: "var(--muted)", textAlign: "center", paddingTop: "3rem" }}>加载中…</p>;
  }

  const pendingRedemptions = redeemed.filter((r) => r.redemption_status === "pending");
  const fulfilledRedemptions = redeemed.filter((r) => r.redemption_status === "fulfilled");

  return (
    <div>
      {error && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "12px", padding: "10px 14px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ flex: 1, fontSize: "0.85rem", color: "var(--danger)" }}>{error}</span>
          <button onClick={() => setError("")} style={{ color: "var(--danger)", fontSize: "1rem", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* iOS Large Title Header */}
      <div style={{ marginBottom: "16px" }}>
        <h1 className="ios-large-title">星星商城</h1>
        <p className="ios-page-subtitle">当前可用余额 ⭐ {formatStars(stars)} 星</p>
      </div>

      {/* 连击保护卡 (Apple iOS Inset Feature Card) */}
      {freezeInfo && (() => {
        const cost = freezeInfo?.star_cost != null ? Number(freezeInfo.star_cost) : 5;
        const maxLimit = freezeInfo?.max_limit != null ? Number(freezeInfo.max_limit) : 2;
        const isLimitReached = (freezeInfo?.available_count ?? 0) >= maxLimit;
        const canBuy = Boolean(freezeInfo?.can_purchase && !isLimitReached && Number(stars) >= cost);

        return (
          <div
            className="ios-grouped-card"
            style={{
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--protect-bg)",
                  border: "1px solid var(--protect-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0,
                }}
              >
                ❄️
              </div>
              <div>
                <div style={{ fontWeight: 650, fontSize: "0.98rem", color: "var(--text)" }}>连击保护卡</div>
                <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "2px" }}>
                  拥有 {freezeInfo.available_count ?? 0} / 上限 {maxLimit} 张 · 防断签护航
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePurchaseFreeze}
              disabled={purchasingFreeze || !canBuy}
              className="btn-primary"
              style={{
                borderRadius: "999px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                flexShrink: 0,
                backgroundColor: !canBuy ? "rgba(118, 118, 128, 0.12)" : "var(--accent)",
                color: !canBuy ? "var(--muted)" : "#FFFFFF",
                boxShadow: !canBuy ? "none" : "0 2px 6px rgba(0, 113, 227, 0.25)",
              }}
            >
              {purchasingFreeze
                ? "购买中…"
                : isLimitReached
                ? `已达上限`
                : `⭐ ${cost} 兑换`}
            </button>
          </div>
        );
      })()}

      {/* 可兑换商品列表 (iOS Inset Grouped Table) */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", marginBottom: "8px", paddingLeft: "4px" }}>
          心愿商品 ({items.length})
        </div>

        {items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px",
              background: "#FFFFFF",
              borderRadius: "14px",
              boxShadow: "var(--shadow-sm)",
              color: "var(--muted)",
            }}
          >
            <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)", marginBottom: "4px" }}>暂无可兑换商品</p>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>轻点下方“+ 许愿新愿望”提交给家长吧！</p>
          </div>
        ) : (
          <div className="ios-grouped-card">
            {items.map((item) => {
              const discounted = item.discounted_star_cost != null && Number(item.discounted_star_cost) < Number(item.star_cost);
              const cost = item.discounted_star_cost ?? item.star_cost;
              const funds=affordability(stars,cost);
              const unavailable=!funds.canAfford || item.stock===0 || !!redeemingId;
              return (
                <div key={item.id} className="reminders-task-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{item.title}</span>
                      {item.stock != null && (
                        <span style={{ fontSize: "0.72rem", color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", padding: "1px 6px", borderRadius: "999px", fontWeight: 600 }}>
                          仅剩 {item.stock} 件
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "3px" }}>
                      {discounted ? `${item.discount_label || `支付 ${item.discount_percent}%`} · 原价 ${formatStars(item.star_cost)}⭐` : "日常达成奖励"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRedeem(item)}
                    disabled={unavailable}
                    aria-label={item.stock===0?"已兑完":!funds.known?"余额加载中":!funds.canAfford?`还差${formatStars(funds.shortfall)}星`:`兑换${item.title}`}
                    className="btn-primary"
                    style={{ borderRadius: "999px", padding: "6px 14px", fontSize: "0.82rem", flexShrink: 0, ...(unavailable?{background:"var(--card-subtle)",color:"var(--muted)",boxShadow:"none",cursor:"not-allowed"}:{}) }}
                  >
                    {item.stock===0?"已兑完":!funds.known?"余额加载中":!funds.canAfford?`还差${formatStars(funds.shortfall)}星`:redeemingId===item.id?"兑换中…":`⭐ ${formatStars(cost)} 兑换`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 我的兑换记录 */}
      {redeemed.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px", padding: "0 4px" }}>
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)" }}>我的兑换记录</span>
            <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
              待兑现 {pendingRedemptions.length} · 已收到 {fulfilledRedemptions.length}
            </span>
          </div>
          <div className="ios-grouped-card">
            {pendingRedemptions.map((r) => (
              <div key={r.id} className="reminders-task-row">
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text)" }}>{r.title}</span>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px", whiteSpace: "nowrap" }}>
                    {redemptionPrice(r)} · 申请时间 {fmtDate(r.created_at)}
                  </p>
                </div>
                <span style={{ fontSize: "0.76rem", color: "var(--star)", fontWeight: 650, background: "var(--star-bg)", padding: "2px 8px", borderRadius: "999px" }}>
                  待兑现
                </span>
              </div>
            ))}
            {showFulfilledRedemptions && fulfilledRedemptions.map((r) => (
              <div key={r.id} className="reminders-task-row">
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text)" }}>{r.title}</span>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px", whiteSpace: "nowrap" }}>
                    {redemptionPrice(r)} · 已收到 {fmtDate(r.fulfilled_at)}
                  </p>
                </div>
                <span style={{ fontSize: "0.76rem", color: "#34C759", fontWeight: 650, background: "rgba(52, 199, 89, 0.12)", padding: "2px 8px", borderRadius: "999px" }}>
                  已收到
                </span>
              </div>
            ))}
          </div>
          {fulfilledRedemptions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFulfilledRedemptions((v) => !v)}
              className="btn-secondary"
              style={{ width: "100%", padding: "10px", borderRadius: "12px", fontSize: "0.85rem", marginTop: "8px" }}
            >
              {showFulfilledRedemptions ? "收起已收到记录" : `展开已收到记录 (${fulfilledRedemptions.length})`}
            </button>
          )}
        </div>
      )}

      {/* 我的心愿列表 */}
      {wishes.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", marginBottom: "8px", paddingLeft: "4px" }}>
            审核中的心愿 ({wishes.length})
          </div>
          <div className="ios-grouped-card">
            {wishes.map((w) => (
              <div key={w.id} className="reminders-task-row">
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text)" }}>{w.title}</span>
                  {w.description && <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "2px" }}>{w.description}</p>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--star)", background: "var(--star-bg)", padding: "2px 8px", borderRadius: "999px", fontWeight: 600 }}>
                    等待家长审核
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(w)}
                    className="btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "0.76rem", borderRadius: "999px" }}
                  >
                    修改
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部新增许愿入口 (iOS 全宽卡片按钮) */}
      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={() => setShowWish(true)}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--accent)",
            borderRadius: "14px",
            background: "#FFFFFF",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>+ 许愿新愿望</span>
        </button>
      </div>

      {/* 许愿抽屉 (iOS Sheet Drawer) */}
      {showWish && (
        <div className="ios-sheet-overlay" onClick={() => setShowWish(false)}>
          <div className="ios-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle-bar" />
            
            {/* Apple iOS Canonical Modal Header */}
            <div className="ios-sheet-header">
              <button
                type="button"
                className="ios-sheet-nav-btn"
                onClick={() => setShowWish(false)}
              >
                取消
              </button>
              <span className="ios-sheet-header-title">向家长许愿</span>
              <button
                type="button"
                className="ios-sheet-nav-action-btn"
                onClick={handleWish}
                disabled={!wishForm.title.trim()}
              >
                许愿
              </button>
            </div>

            <div className="ios-sheet-body">
              <div className="ios-grouped-card" style={{ marginBottom: "20px" }}>
                <div style={{ padding: "12px 16px" }}>
                  <input
                    placeholder="想要什么愿望？告诉爸爸妈妈吧"
                    value={wishForm.title}
                    onChange={(e) => setWishForm({ ...wishForm, title: e.target.value })}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: "1.02rem",
                      color: "var(--text)",
                      fontFamily: "inherit",
                    }}
                    autoFocus
                  />
                </div>

                <div className="ios-separator" />

                <div style={{ padding: "12px 16px" }}>
                  <input
                    placeholder="说明或理由 (选填，告诉爸爸妈妈为什么想要)"
                    value={wishForm.desc}
                    onChange={(e) => setWishForm({ ...wishForm, desc: e.target.value })}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: "0.92rem",
                      color: "var(--text)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function redemptionPrice(r) {
  if (r.final_star_cost == null) return `⭐ ${formatStars(r.star_cost)}`;
  const original = r.original_star_cost ?? r.star_cost;
  const percent = r.redemption_discount_percent ?? 100;
  return `实付 ${formatStars(r.final_star_cost)}⭐ · 原价 ${formatStars(original)}⭐ (${percent}%)`;
}
