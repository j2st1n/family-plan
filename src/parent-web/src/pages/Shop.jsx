import { useState, useEffect, useCallback } from "react";
import api from "../api.js";

export default function Shop({ token }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", stars: "", stock: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", stars: "", stock: "" });
  const [approveStars, setApproveStars] = useState({});
  const [redemptions, setRedemptions] = useState([]);
  const [showFulfilledRedemptions, setShowFulfilledRedemptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { const list = await api.fetchShop(token); setItems(list); } catch (err) { setError("加载商品列表失败: " + (err.message || "未知错误")); }
    try { const reds = await api.fetchRedemptions(token); setRedemptions(reds); } catch (err) { setError("加载兑换记录失败: " + (err.message || "未知错误")); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.title.trim() || !form.stars || parseInt(form.stars) < 1) return;
    const stock = form.stock ? parseInt(form.stock) : null;
    try {
      await api.createShopItem(token, { title: form.title.trim(), star_cost: parseInt(form.stars), stock });
      setForm({ title: "", stars: "", stock: "" }); setShowAdd(false); load();
    } catch (err) {
      setError("添加商品失败: " + (err.message || "未知错误"));
    }
  }

  function startEdit(item) { setEditingId(item.id); setEditForm({ title: item.title, stars: item.star_cost.toString(), stock: item.stock?.toString() || "" }); }
  async function saveEdit() {
    if (!editForm.title.trim() || !editForm.stars || parseInt(editForm.stars) < 1) return;
    const stock = editForm.stock ? parseInt(editForm.stock) : null;
    try {
      await api.updateShopItem(token, editingId, { title: editForm.title.trim(), star_cost: parseInt(editForm.stars), stock });
      setEditingId(null); load();
    } catch (err) {
      setError("保存商品失败: " + (err.message || "未知错误"));
    }
  }

  async function handleDelete(id) { 
  if (!window.confirm("下架此商品？")) return; 
  try {
    await api.deleteShopItem(token, id);
    load();
  } catch (err) {
    setError("删除商品失败: " + (err.message || "未知错误"));
  }
}
  async function handleFulfill(id) { 
  try {
    await api.fulfillItem(token, id);
    load();
  } catch (err) {
    setError("兑现商品失败: " + (err.message || "未知错误"));
  }
}

  async function handleApprove(id) {
    const stars = approveStars[id] || 10;
    try {
      await api.approveWish(token, id, parseInt(stars));
      setApproveStars(p => { const n = { ...p }; delete n[id]; return n; }); load();
    } catch (err) {
      setError("审核许愿失败: " + (err.message || "未知错误"));
    }
  }

  const wishes = items.filter(i => i.status === "pending");
  const active = items.filter(i => i.status === "active");
  const pendingRedemptions = redemptions.filter(r => r.redemption_status === "pending");
  const fulfilledRedemptions = redemptions.filter(r => r.redemption_status === "fulfilled");

  if (loading) return <p style={{ color: "#73706b", textAlign: "center", paddingTop: "2rem" }}>加载中…</p>;

  return (
    <div>
      {error && (
        <div style={s.errorBanner}>
          <span style={s.errorIcon}>⚠</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={s.errorClose}>✕</button>
        </div>
      )}
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", fontFamily: "\"Noto Sans SC\", \"PingFang SC\", -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: "-0.01em" }}>星星商城</h2>

      <div style={s.section}>
        <div style={s.sectionHd}><h3 style={s.sh}>货架商品</h3><span style={{ fontSize: "0.8rem", color: "#73706b" }}>{active.length} 件</span></div>
        {active.length === 0 && <p style={s.empty}>还没有上架商品</p>}
        {active.map(item => (
          <div key={item.id} style={s.row}>
            {editingId === item.id ? (
              <div style={{ flex: 1 }}>
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="名称" style={s.ei} autoFocus />
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  <input type="number" value={editForm.stars} onChange={e => setEditForm({ ...editForm, stars: e.target.value })} placeholder="⭐" style={{ ...s.ei, flex: 1 }} />
                  <input type="number" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} placeholder="库存" style={{ ...s.ei, flex: 1 }} />
                </div>
                <button onClick={saveEdit} style={s.act}>保存</button><button onClick={() => setEditingId(null)} style={s.del}>取消</button>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.title}</p>
                  {item.stock != null && <p style={{ fontSize: "0.72rem", color: "#c97070", marginTop: 2 }}>库存 {item.stock}</p>}
                </div>
                <span style={{ fontSize: "0.8rem", color: "#c4912a", whiteSpace: "nowrap" }}>⭐{item.star_cost}</span>
                <button onClick={() => startEdit(item)} style={s.ib}>✎</button>
                <button onClick={() => handleDelete(item.id)} style={s.ib}>✕</button>
              </>
            )}
          </div>
        ))}
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} style={s.addBtn}>+ 上架商品</button>
        ) : (
          <div style={s.formBox}>
            <input placeholder="名称" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={s.ei} autoFocus />
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <input type="number" placeholder="⭐" value={form.stars} onChange={e => setForm({ ...form, stars: e.target.value })} style={{ ...s.ei, flex: 1 }} />
              <input type="number" placeholder="库存(选填)" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={{ ...s.ei, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={handleAdd} style={s.act}>上架</button>
              <button onClick={() => setShowAdd(false)} style={s.del}>取消</button>
            </div>
          </div>
        )}
      </div>

      {wishes.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHd}><h3 style={s.sh}>许愿审核</h3><span style={{ fontSize: "0.8rem", color: "#c97070" }}>{wishes.length} 条待审</span></div>
          {wishes.map(w => (
            <div key={w.id} style={s.row}>
              <div style={{ flex: 1 }}><p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{w.title}</p></div>
              <input type="number" placeholder="星星" value={approveStars[w.id] || ""} onChange={e => setApproveStars({ ...approveStars, [w.id]: e.target.value })} style={{ width: "3.5rem", padding: "0.25rem", fontSize: "0.85rem", border: "1px solid #e8e4df", borderRadius: "8px", textAlign: "center" }} />
              <button onClick={() => handleApprove(w.id)} style={s.act}>✓</button>
              <button onClick={() => handleDelete(w.id)} style={s.del}>✕</button>
            </div>
          ))}
        </div>
      )}

      {redemptions.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHd}>
            <h3 style={s.sh}>已兑换</h3>
            <span style={{ fontSize: "0.8rem", color: "#73706b" }}>待兑现 {pendingRedemptions.length} · 已兑现 {fulfilledRedemptions.length}</span>
          </div>
          {pendingRedemptions.map(r => (
            <div key={r.id} style={{ ...s.row }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.title}</p>
                <p style={{ fontSize: "0.75rem", color: "#73706b" }}>⭐{r.star_cost}{r.child_id ? " · 孩子兑换" : ""}</p>
              </div>
              <button onClick={() => handleFulfill(r.redemption_id)} style={s.act}>兑现</button>
            </div>
          ))}
          {fulfilledRedemptions.length > 0 && (
            <button onClick={() => setShowFulfilledRedemptions(v => !v)} style={s.foldBtn}>
              {showFulfilledRedemptions ? "收起已兑现记录" : `展开已兑现记录 (${fulfilledRedemptions.length})`}
            </button>
          )}
          {showFulfilledRedemptions && fulfilledRedemptions.map(r => (
            <div key={r.id} style={{ ...s.row, background: "#fafafa" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.title}</p>
                <p style={{ fontSize: "0.75rem", color: "#73706b" }}>⭐{r.star_cost}{r.child_id ? " · 孩子兑换" : ""}</p>
              </div>
              <span style={{ fontSize: "0.78rem", color: "#4b9c64", fontWeight: 600 }}>已兑现</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  section: { background: "#fff", borderRadius: "14px", padding: "1rem", marginBottom: "0.8rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  sectionHd: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" },
  sh: { fontSize: "0.95rem", fontWeight: 700 },
  empty: { color: "#73706b", textAlign: "center", padding: "1rem 0", fontSize: "0.88rem" },
  row: { display: "flex", alignItems: "center", gap: "0.4rem", background: "#f8f8fb", borderRadius: "10px", padding: "0.5rem 0.7rem", marginBottom: "0.3rem" },
  ib: { width: "1.4rem", height: "1.4rem", borderRadius: "50%", fontSize: "0.7rem", fontWeight: 600, color: "#73706b", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  ei: { padding: "0.3rem 0.4rem", fontSize: "0.85rem", border: "1px solid #e8e4df", borderRadius: "8px", outline: "none", background: "#fff", marginBottom: "0.3rem", display: "block", width: "100%" },
  act: { padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, color: "#fff", background: "#3d9e6b", border: "none", cursor: "pointer" },
  del: { padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, color: "#c97070", background: "#fef0f0", border: "none", cursor: "pointer" },
  addBtn: { width: "100%", padding: "0.5rem", fontSize: "0.9rem", color: "#3d9e6b", border: "1px dashed #3d9e6b", borderRadius: "10px", background: "transparent", cursor: "pointer", marginTop: "0.4rem" },
  foldBtn: { width: "100%", padding: "0.45rem", fontSize: "0.82rem", color: "#73706b", border: "1px dashed #d6d0c8", borderRadius: "10px", background: "transparent", cursor: "pointer", margin: "0.2rem 0 0.4rem" },
  formBox: { background: "#f8f8fb", borderRadius: "10px", padding: "0.5rem", marginTop: "0.4rem" },
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
  errorIcon: {
    fontSize: "1.1rem",
    fontWeight: 600,
  },
  errorClose: {
    marginLeft: "auto",
    fontSize: "0.9rem",
    color: "#c97070",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
};
