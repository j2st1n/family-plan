import { useState, useEffect, useCallback } from "react";
import { fetchShop, fetchToday, fetchChildFreeze, purchaseChildFreeze, redeemItem, makeWish, editWish } from "../api.js";
import useSseRefresh from "../hooks/useSseRefresh.js";
import useVisibilityRefresh from "../hooks/useVisibilityRefresh.js";
import { formatStars } from "../utils/format.js";
import { childFeedback } from "../components/ChildFeedback.jsx";

function fmtDate(s) { if (!s) return ""; return new Date(s).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }); }

export default function Shop({ onExpired, active }) {
  const [items, setItems] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [redeemed, setRedeemed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stars, setStars] = useState(0);
  const [showWish, setShowWish] = useState(false);
  const [showFulfilledRedemptions, setShowFulfilledRedemptions] = useState(false);
  const [wishForm, setWishForm] = useState({ title: "", desc: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", desc: "" });
  const [freezeInfo, setFreezeInfo] = useState(null);
  const [purchasingFreeze, setPurchasingFreeze] = useState(false);

const load = useCallback(async () => {
  setLoading(true); setError("");
  try {
    const all = await fetchShop(onExpired);
    setItems(all.filter(i => i.status === "active" && !i.redeemed_by_child));
    setWishes(all.filter(i => i.status === "pending"));
    setRedeemed(all.filter(i => i.redeemed_by_child));
    try { const today = await fetchToday(onExpired); setStars(today.rewards?.stars_total ?? 0); } catch (error) { console.warn("Failed to load rewards", error); }
    try { const freeze = await fetchChildFreeze(onExpired); setFreezeInfo(freeze); } catch (error) { console.warn("Failed to load freeze", error); }
  } catch (err) {
    if (err.message === "token_expired") {
      setError("登录已过期，请重新绑定");
      if (onExpired) onExpired();
    } else {
      setError("加载失败");
    }
  }
  finally { setLoading(false); }
}, [onExpired]);

  useEffect(() => { if (active) load(); }, [load, active]);
  useSseRefresh({ enabled: active, topics: ["shop", "tasks", "settings"], onRefresh: load, onExpired });
  useVisibilityRefresh({ enabled: active, onRefresh: load });

async function handleRedeem(item) {
  const cost = item.discounted_star_cost ?? item.star_cost;
  const ok = await childFeedback.confirm({
    title: "兑换商品",
    message: `用 ${formatStars(cost)}⭐ 兑换「${item.title}」？`,
    confirmText: "立即兑换",
    cancelText: "再想想",
    icon: "🎁",
  });
  if (!ok) return;
  try { await redeemItem(item.id, onExpired); load(); } catch (err) {
    if (err.message === "token_expired") {
      setError("登录已过期，请重新绑定");
      if (onExpired) onExpired();
    } else {
      setError(err.message);
    }
  }
}

async function handleWish() {
  if (!wishForm.title.trim()) return;
  try {
    await makeWish(wishForm.title.trim(), wishForm.desc.trim() || null, onExpired);
    setWishForm({ title: "", desc: "" }); setShowWish(false); load();
  } catch (err) {
    if (err.message === "token_expired") {
      setError("登录已过期，请重新绑定");
      if (onExpired) onExpired();
    } else {
      setError(err.message);
    }
  }
}

  function startEdit(w) { setEditingId(w.id); setEditForm({ title: w.title, desc: w.description || "" }); }
async function saveEdit() {
  if (!editForm.title.trim()) return;
  try {
    await editWish(editingId, editForm.title.trim(), editForm.desc.trim() || null, onExpired);
    setEditingId(null); load();
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

  if (loading) return <p style={{ color: "var(--muted)", textAlign: "center", paddingTop: "3rem" }}>加载中…</p>;

  const pendingRedemptions = redeemed.filter(r => r.redemption_status === "pending");
  const fulfilledRedemptions = redeemed.filter(r => r.redemption_status === "fulfilled");

  return (
    <div>
      {error && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "12px", padding: "0.7rem 1rem", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ flex: 1, fontSize: "0.85rem", color: "var(--danger)" }}>{error}</span>
          <button onClick={() => setError("")} style={{ color: "var(--danger)", fontSize: "1rem", fontWeight: 700, padding: "0.1rem 0.3rem" }}>✕</button>
        </div>
      )}
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.015em" }}>星星商城</h2>
        <p style={{ fontSize: "0.9rem", color: "var(--star)", fontWeight: 650, marginTop: "0.2rem" }}>余额 ⭐{formatStars(stars)}</p>
      </div>

      {freezeInfo && (() => {
        const cost = freezeInfo?.star_cost != null ? Number(freezeInfo.star_cost) : 5;
        const maxLimit = freezeInfo?.max_limit != null ? Number(freezeInfo.max_limit) : 2;
        const isLimitReached = (freezeInfo?.available_count ?? 0) >= maxLimit;
        const canBuy = Boolean(freezeInfo?.can_purchase && !isLimitReached && Number(stars) >= cost);

        return (
          <div style={{ ...s.card, background: "var(--protect-bg)", border: "1px solid var(--protect-border)", marginBottom: "0.8rem" }}>
            <span style={{ fontSize: "1.8rem" }}>❄️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 650, fontSize: "0.95rem", color: "var(--protect)" }}>连击保护卡</p>
              <p style={{ fontSize: "0.75rem", color: "var(--protect)", opacity: 0.85, marginTop: "0.1rem" }}>
                当前可用 {freezeInfo.available_count ?? 0} 张 / 上限 {maxLimit} 张 · 遗漏任务自动保活
              </p>
            </div>
            <button
              onClick={handlePurchaseFreeze}
              disabled={purchasingFreeze || !canBuy}
              style={{
                ...s.redeemBtn,
                background: (!canBuy || purchasingFreeze) ? "var(--border)" : "var(--protect)",
                color: (!canBuy || purchasingFreeze) ? "var(--muted)" : "#FFFFFF",
                cursor: (!canBuy || purchasingFreeze) ? "not-allowed" : "pointer",
              }}
            >
              {purchasingFreeze
                ? "购买中…"
                : isLimitReached
                  ? `已达上限 (${freezeInfo.available_count}/${maxLimit})`
                  : `⭐${cost} 购买`}
            </button>
          </div>
        );
      })()}

      {items.map(item => {
        const discounted = item.discounted_star_cost != null && Number(item.discounted_star_cost) < Number(item.star_cost);
        const cost = item.discounted_star_cost ?? item.star_cost;
        return (
          <div key={item.id} style={s.card}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 650, fontSize: "1rem", color: "var(--text)" }}>{item.title}</p>
              {item.stock != null && <p style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.1rem" }}>仅剩 {item.stock} 件</p>}
              {discounted && <p style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "0.15rem" }}>{item.discount_label || `支付 ${item.discount_percent}%`} · 原价 {formatStars(item.star_cost)}⭐</p>}
            </div>
            <button onClick={() => handleRedeem(item)} style={s.redeemBtn}>⭐{formatStars(cost)} 兑换</button>
          </div>
        );
      })}

      {items.length === 0 && <p style={{ color: "var(--muted)", textAlign: "center", padding: "1.5rem 0" }}>暂无商品</p>}

      {redeemed.length > 0 && (
        <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <h3 style={{ fontWeight: 650, color: "var(--text)" }}>我的兑换</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>待兑现 {pendingRedemptions.length} · 已收到 {fulfilledRedemptions.length}</span>
          </div>
          {pendingRedemptions.map(r => (
            <div key={r.id} style={{ ...s.card, background: "var(--card-subtle)", opacity: 0.85 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{r.title}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {redemptionPrice(r)} · 等待兑现 {fmtDate(r.created_at)}
                </p>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--star)", fontWeight: 650 }}>待兑现</span>
            </div>
          ))}
          {fulfilledRedemptions.length > 0 && (
            <button onClick={() => setShowFulfilledRedemptions(v => !v)} style={s.foldBtn}>
              {showFulfilledRedemptions ? "收起已收到记录" : `展开已收到记录 (${fulfilledRedemptions.length})`}
            </button>
          )}
          {showFulfilledRedemptions && fulfilledRedemptions.map(r => (
            <div key={r.id} style={{ ...s.card, background: "var(--card-subtle)", opacity: 0.85 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{r.title}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {redemptionPrice(r)} · 已收到 {fmtDate(r.fulfilled_at)}
                </p>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 650 }}>已收到</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <h3 style={{ fontWeight: 650, color: "var(--text)", marginBottom: "0.4rem" }}>我的许愿</h3>
        {wishes.map(w => (
          <div key={w.id} style={{ ...s.card, background: "var(--card-subtle)" }}>
            {editingId === w.id ? (
              <div style={{ flex: 1 }}>
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.9rem", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "0.3rem", background: "var(--card)", color: "var(--text)" }} autoFocus />
                <input value={editForm.desc} onChange={e => setEditForm({ ...editForm, desc: e.target.value })} placeholder="说明" style={{ width: "100%", padding: "0.4rem 0.6rem", fontSize: "0.9rem", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "0.3rem", background: "var(--card)", color: "var(--text)" }} />
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={saveEdit} style={s.smallBtn}>保存</button>
                  <button onClick={() => setEditingId(null)} style={s.cancelBtn}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{w.title}</p>
                  {w.description && <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{w.description}</p>}
                  <p style={{ fontSize: "0.75rem", color: "var(--star)", fontWeight: 650, marginTop: "0.15rem" }}>审核中</p>
                </div>
                <button onClick={() => startEdit(w)} style={s.smallBtn}>修改</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1rem" }}>
        {!showWish ? (
          <button onClick={() => setShowWish(true)} style={s.addBtn}>+ 许愿</button>
        ) : (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "1rem", boxShadow: "var(--shadow-card)" }}>
            <input placeholder="想要什么" value={wishForm.title} onChange={e => setWishForm({ ...wishForm, title: e.target.value })} style={{ width: "100%", padding: "0.55rem 0.7rem", fontSize: "0.95rem", border: "1px solid var(--border)", borderRadius: "10px", marginBottom: "0.4rem", background: "var(--card)", color: "var(--text)" }} autoFocus />
            <input placeholder="说明（选填）" value={wishForm.desc} onChange={e => setWishForm({ ...wishForm, desc: e.target.value })} style={{ width: "100%", padding: "0.55rem 0.7rem", fontSize: "0.95rem", border: "1px solid var(--border)", borderRadius: "10px", marginBottom: "0.4rem", background: "var(--card)", color: "var(--text)" }} />
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleWish} style={{ flex: 1, padding: "0.5rem", fontSize: "0.9rem", fontWeight: 650, color: "#FFFFFF", background: "var(--accent)", borderRadius: "10px", border: "none", cursor: "pointer" }}>许愿</button>
              <button onClick={() => setShowWish(false)} style={{ flex: 1, padding: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--muted)", background: "#F0ECE4", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer" }}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function redemptionPrice(r) {
  if (r.final_star_cost == null) return `⭐${formatStars(r.star_cost)}`;
  const original = r.original_star_cost ?? r.star_cost;
  const percent = r.redemption_discount_percent ?? 100;
  return `实付 ${formatStars(r.final_star_cost)}⭐ · 原价 ${formatStars(original)}⭐ · ${percent}%`;
}

const s = {
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "0.85rem 1.1rem", marginBottom: "0.6rem", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: "0.5rem" },
  redeemBtn: { padding: "0.4rem 0.9rem", borderRadius: "var(--radius-pill)", background: "var(--accent)", color: "#FFFFFF", fontSize: "0.8rem", fontWeight: 650, border: "none", cursor: "pointer", whiteSpace: "nowrap" },
  addBtn: { width: "100%", padding: "0.7rem", fontSize: "0.95rem", fontWeight: 650, color: "var(--accent)", border: "1.5px dashed var(--accent)", borderRadius: "14px", background: "var(--accent-light)", cursor: "pointer" },
  foldBtn: { width: "100%", padding: "0.5rem", fontSize: "0.82rem", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "12px", background: "transparent", cursor: "pointer", margin: "0.2rem 0 0.5rem" },
  smallBtn: { padding: "0.35rem 0.7rem", borderRadius: "8px", background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent-pill)", fontSize: "0.8rem", fontWeight: 650, cursor: "pointer" },
  cancelBtn: { padding: "0.35rem 0.7rem", borderRadius: "8px", background: "#F0ECE4", border: "1px solid var(--border)", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer" },
};
