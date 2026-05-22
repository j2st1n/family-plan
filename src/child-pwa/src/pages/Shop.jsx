import { useState, useEffect, useCallback } from "react";
import { fetchShop, fetchToday, redeemItem, makeWish, editWish } from "../api.js";

function fmtDate(s) { if (!s) return ""; return new Date(s).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }); }

export default function Shop({ active }) {
  const [items, setItems] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [redeemed, setRedeemed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stars, setStars] = useState(0);
  const [showWish, setShowWish] = useState(false);
  const [wishForm, setWishForm] = useState({ title: "", desc: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", desc: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchShop();
      setItems(all.filter(i => i.status === "active" && !i.redeemed_by_child));
      setWishes(all.filter(i => i.status === "pending"));
      setRedeemed(all.filter(i => i.redeemed_by_child));
      try { const today = await fetchToday(); setStars(today.rewards?.stars_total ?? 0); } catch {}
    } catch { setError("加载失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (active) load(); }, [load, active]);

  async function handleRedeem(item) {
    if (!window.confirm(`用 ${item.star_cost}⭐ 兑换「${item.title}」？`)) return;
    try { await redeemItem(item.id); load(); } catch { setError("兑换失败"); }
  }

  async function handleWish() {
    if (!wishForm.title.trim()) return;
    await makeWish(wishForm.title.trim(), wishForm.desc.trim() || null);
    setWishForm({ title: "", desc: "" }); setShowWish(false); load();
  }

  function startEdit(w) { setEditingId(w.id); setEditForm({ title: w.title, desc: w.description || "" }); }
  async function saveEdit() {
    if (!editForm.title.trim()) return;
    await editWish(editingId, editForm.title.trim(), editForm.desc.trim() || null);
    setEditingId(null); load();
  }

  if (loading) return <p style={{ color: "#73706b", textAlign: "center", paddingTop: "3rem" }}>加载中…</p>;
  if (error) return <p style={{ color: "#c97070", textAlign: "center", paddingTop: "3rem" }}>{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#3d9e6b" }}>星星商城</h2>
        <p style={{ fontSize: "0.9rem", color: "#c4912a", marginTop: "0.2rem" }}>余额 ⭐{stars}</p>
      </div>

      {items.map(item => (
        <div key={item.id} style={s.card}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: "1rem" }}>{item.title}</p>
            {item.stock != null && <p style={{ fontSize: "0.75rem", color: "#c97070" }}>仅剩 {item.stock} 件</p>}
          </div>
          <button onClick={() => handleRedeem(item)} style={s.redeemBtn}>⭐{item.star_cost} 兑换</button>
        </div>
      ))}

      {items.length === 0 && <p style={{ color: "#73706b", textAlign: "center" }}>暂无商品</p>}

      {redeemed.length > 0 && (
        <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e8e4df", paddingTop: "1rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.4rem" }}>已兑换</h3>
          {redeemed.map(r => (
            <div key={r.id} style={{ ...s.card, background: "#fafafa", opacity: 0.7 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>{r.title}</p>
                <p style={{ fontSize: "0.75rem", color: "#73706b" }}>
                  ⭐{r.star_cost} · {r.redemption_status === "fulfilled" ? `已兑现 ${fmtDate(r.fulfilled_at)}` : `待兑现 ${fmtDate(r.created_at)}`}
                </p>
              </div>
              <span style={{ fontSize: "0.75rem", color: r.redemption_status === "fulfilled" ? "#4b9c64" : "#c4912a" }}>
                {r.redemption_status === "fulfilled" ? "已兑现" : "待兑现"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e8e4df", paddingTop: "1rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "0.4rem" }}>我的许愿</h3>
        {wishes.map(w => (
          <div key={w.id} style={{ ...s.card, background: "#fafafa" }}>
            {editingId === w.id ? (
              <div style={{ flex: 1 }}>
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={{ width: "100%", padding: "0.3rem 0.5rem", fontSize: "0.9rem", border: "1px solid #e8e4df", borderRadius: "8px", marginBottom: "0.3rem" }} autoFocus />
                <input value={editForm.desc} onChange={e => setEditForm({ ...editForm, desc: e.target.value })} placeholder="说明" style={{ width: "100%", padding: "0.3rem 0.5rem", fontSize: "0.9rem", border: "1px solid #e8e4df", borderRadius: "8px", marginBottom: "0.3rem" }} />
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={saveEdit} style={s.smallBtn}>保存</button>
                  <button onClick={() => setEditingId(null)} style={s.cancelBtn}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>{w.title}</p>
                  {w.description && <p style={{ fontSize: "0.8rem", color: "#73706b" }}>{w.description}</p>}
                  <p style={{ fontSize: "0.75rem", color: "#c97070", marginTop: "0.15rem" }}>审核中</p>
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
          <div style={{ background: "#fff", borderRadius: "14px", padding: "0.8rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <input placeholder="想要什么" value={wishForm.title} onChange={e => setWishForm({ ...wishForm, title: e.target.value })} style={{ width: "100%", padding: "0.5rem", fontSize: "0.95rem", border: "1px solid #e8e4df", borderRadius: "10px", marginBottom: "0.4rem" }} autoFocus />
            <input placeholder="说明（选填）" value={wishForm.desc} onChange={e => setWishForm({ ...wishForm, desc: e.target.value })} style={{ width: "100%", padding: "0.5rem", fontSize: "0.95rem", border: "1px solid #e8e4df", borderRadius: "10px", marginBottom: "0.4rem" }} />
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleWish} style={{ flex: 1, padding: "0.45rem", fontSize: "0.9rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", borderRadius: "10px" }}>许愿</button>
              <button onClick={() => setShowWish(false)} style={{ flex: 1, padding: "0.45rem", fontSize: "0.9rem", fontWeight: 600, color: "#73706b", background: "#efece8", borderRadius: "10px" }}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  card: { background: "#fff", borderRadius: "14px", padding: "0.8rem 1rem", marginBottom: "0.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "0.5rem" },
  redeemBtn: { padding: "0.4rem 0.8rem", borderRadius: "999px", background: "#3d9e6b", color: "#fff", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" },
  addBtn: { width: "100%", padding: "0.6rem", fontSize: "0.95rem", color: "#3d9e6b", border: "1px dashed #3d9e6b", borderRadius: "14px", background: "transparent" },
  smallBtn: { padding: "0.3rem 0.6rem", borderRadius: "8px", background: "#3d9e6b", color: "#fff", fontSize: "0.8rem", fontWeight: 600 },
  cancelBtn: { padding: "0.3rem 0.6rem", borderRadius: "8px", background: "#efece8", color: "#73706b", fontSize: "0.8rem" },
};
