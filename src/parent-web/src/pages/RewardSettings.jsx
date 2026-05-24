import { useEffect, useState } from "react";
import api from "../api.js";

const DAYS = [7, 14, 21];

export default function RewardSettings({ token, child, onBack }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const settings = await api.fetchRewardSettings(token, child.id);
        if (!cancelled) setForm(toForm(settings));
      } catch (err) {
        if (!cancelled) setError("加载奖励设置失败: " + (err.message || "未知错误"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, child.id]);

  function updateTier(days, value) {
    setForm(prev => ({
      ...prev,
      tiers: prev.tiers.map(t => t.days === days ? { ...t, discount_percent: value } : t),
    }));
  }

  function validationError() {
    const threshold = Number(form.threshold);
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) return "打卡完成率需要是 1-100 的整数";
    const percents = form.tiers.map(t => Number(t.discount_percent));
    if (percents.some(p => !Number.isInteger(p) || p < 1 || p > 100)) return "支付比例需要是 1-100 的整数";
    if (percents[0] < percents[1] || percents[1] < percents[2]) return "连续天数越长，支付比例应该不高于前一档";
    return "";
  }

  async function save() {
    const invalid = validationError();
    if (invalid) { setError(invalid); setMessage(""); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const updated = await api.updateRewardSettings(token, child.id, {
        streak_threshold: Number(form.threshold),
        streak_discount_enabled: form.enabled,
        streak_discount_tiers: form.tiers.map(t => ({ days: t.days, discount_percent: Number(t.discount_percent) })),
      });
      setForm(toForm(updated));
      setMessage("奖励设置已保存");
    } catch (err) {
      setError("保存失败: " + (err.message || "未知错误"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "#73706b", textAlign: "center", paddingTop: "2rem" }}>加载中…</p>;
  if (!form) return <div><button onClick={onBack} style={s.back}>← 返回</button><p style={s.error}>{error || "无法加载设置"}</p></div>;

  return (
    <div>
      <button onClick={onBack} style={s.back}>← 返回</button>
      <div style={s.hero}>
        <p style={s.kicker}>奖励设置</p>
        <h2 style={s.title}>{child.name}</h2>
        <p style={s.desc}>设置连续打卡怎么算，以及连续打卡后在星星商城支付多少比例。</p>
      </div>
      {error && <div style={s.error}>{error}</div>}
      {message && <div style={s.success}>{message}</div>}
      <section style={s.card}>
        <h3 style={s.sectionTitle}>连续打卡怎么算？</h3>
        <label style={s.label}>当天完成任务比例达到</label>
        <div style={s.percentRow}>
          <input type="number" min="1" max="100" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} style={s.percentInput} />
          <span style={s.percentSign}>%</span>
        </div>
        <p style={s.hint}>达到这个比例，当天会计入连续打卡。修改后只影响之后的计算。</p>
      </section>
      <section style={s.card}>
        <div style={s.switchRow}>
          <div>
            <h3 style={s.sectionTitle}>连续打卡商城折扣</h3>
            <p style={s.hint}>天数固定，家长只需要填写支付比例。</p>
          </div>
          <button onClick={() => setForm({ ...form, enabled: !form.enabled })} style={{ ...s.switch, background: form.enabled ? "#3d9e6b" : "#d8d2cb" }}>{form.enabled ? "开" : "关"}</button>
        </div>
        {DAYS.map(days => {
          const tier = form.tiers.find(t => t.days === days);
          return (
            <div key={days} style={s.tierRow}>
              <span style={s.tierDays}>连续 {days} 天</span>
              <span style={s.tierText}>支付</span>
              <input type="number" min="1" max="100" value={tier?.discount_percent ?? ""} onChange={e => updateTier(days, e.target.value)} style={s.tierInput} />
              <span style={s.tierText}>%</span>
            </div>
          );
        })}
        <p style={s.example}>例如商品 10⭐，支付 85% 时，实际扣除 8.5⭐。</p>
      </section>
      <button onClick={save} disabled={saving} style={{ ...s.save, opacity: saving ? 0.7 : 1 }}>{saving ? "保存中…" : "保存奖励设置"}</button>
    </div>
  );
}

function toForm(settings) {
  return {
    threshold: String(settings.streak_threshold ?? 80),
    enabled: settings.streak_discount_enabled ?? true,
    tiers: (settings.streak_discount_tiers || []).map(t => ({ days: t.days, discount_percent: String(t.discount_percent) })),
  };
}

const s = {
  back: { color: "#73706b", fontSize: "0.9rem", marginBottom: "0.8rem" },
  hero: { background: "linear-gradient(135deg, #e8f3ec, #fff8e8)", borderRadius: "18px", padding: "1rem", marginBottom: "0.8rem", border: "1px solid #e4eadf" },
  kicker: { color: "#3d9e6b", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em" },
  title: { fontSize: "1.35rem", fontWeight: 750, marginTop: "0.15rem" },
  desc: { color: "#73706b", fontSize: "0.88rem", marginTop: "0.3rem", lineHeight: 1.5 },
  card: { background: "#fff", borderRadius: "16px", padding: "1rem", marginBottom: "0.8rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, marginBottom: "0.45rem" },
  label: { color: "#4a4540", fontSize: "0.82rem", fontWeight: 600 },
  percentRow: { display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.35rem" },
  percentInput: { width: "6rem", padding: "0.45rem 0.6rem", border: "1px solid #d6d0c8", borderRadius: "10px", fontSize: "1rem", fontWeight: 700 },
  percentSign: { fontWeight: 700, color: "#3d9e6b" },
  hint: { color: "#73706b", fontSize: "0.78rem", lineHeight: 1.5, marginTop: "0.35rem" },
  switchRow: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" },
  switch: { color: "#fff", borderRadius: "999px", padding: "0.35rem 0.75rem", fontSize: "0.82rem", fontWeight: 700 },
  tierRow: { display: "grid", gridTemplateColumns: "1fr auto 4.8rem auto", alignItems: "center", gap: "0.4rem", background: "#f8f8fb", borderRadius: "12px", padding: "0.55rem 0.65rem", marginTop: "0.45rem" },
  tierDays: { fontWeight: 700, color: "#2d2b28", fontSize: "0.9rem" },
  tierText: { color: "#73706b", fontSize: "0.82rem" },
  tierInput: { padding: "0.35rem", border: "1px solid #d6d0c8", borderRadius: "8px", textAlign: "center", fontWeight: 700 },
  example: { marginTop: "0.6rem", color: "#c4912a", fontSize: "0.78rem" },
  save: { width: "100%", padding: "0.7rem", borderRadius: "14px", background: "#3d9e6b", color: "#fff", fontWeight: 700, fontSize: "0.95rem" },
  error: { background: "#fef0f0", color: "#c97070", borderRadius: "12px", padding: "0.7rem 0.9rem", marginBottom: "0.7rem", fontSize: "0.84rem" },
  success: { background: "#e8f3ec", color: "#3d9e6b", borderRadius: "12px", padding: "0.7rem 0.9rem", marginBottom: "0.7rem", fontSize: "0.84rem", fontWeight: 650 },
};
