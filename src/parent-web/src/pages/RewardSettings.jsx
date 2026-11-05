import { useEffect, useState } from "react";
import api from "../api.js";

const MIN_TIER_COUNT = 3;

export default function RewardSettings({ token, child, onBack, embedded = false, onSaved }) {
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

  function updateTier(index, field, value) {
    setForm(prev => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => i === index ? { ...t, [field]: value } : t),
    }));
  }

  function addTier() {
    setForm(prev => {
      const tiers = prev.tiers;
      const lastTier = tiers[tiers.length - 1];
      const nextDays = lastTier.days + 7;
      const nextPercent = lastTier.discount_percent;
      return { ...prev, tiers: [...tiers, { days: nextDays, discount_percent: nextPercent }] };
    });
  }

  function removeTier(index) {
    setForm(prev => {
      if (prev.tiers.length <= MIN_TIER_COUNT) return prev;
      return { ...prev, tiers: prev.tiers.filter((_, i) => i !== index) };
    });
  }

  function validationError() {
    const threshold = Number(form.threshold);
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) return "打卡完成率需要是 1-100 的整数";

    const tiers = form.tiers;
    if (tiers.length === 0) return "至少需要一个连续打卡档位";

    for (let i = 0; i < tiers.length; i++) {
      const days = Number(tiers[i].days);
      if (!Number.isInteger(days) || days < 7 || days % 7 !== 0) {
        return "连续天数需要是 7 的倍数且不小于 7";
      }
      const p = Number(tiers[i].discount_percent);
      if (!Number.isInteger(p) || p < 1 || p > 100) return "支付比例需要是 1-100 的整数";
    }

    for (let i = 1; i < tiers.length; i++) {
      if (Number(tiers[i].days) <= Number(tiers[i - 1].days)) {
        return "连续天数需要依次递增且不重复";
      }
    }

    for (let i = 1; i < tiers.length; i++) {
      if (Number(tiers[i].discount_percent) > Number(tiers[i - 1].discount_percent)) {
        return "连续天数越长，支付比例应该不高于前一档";
      }
    }

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
        streak_discount_tiers: form.tiers.map(t => ({ days: Number(t.days), discount_percent: Number(t.discount_percent) })),
      });
      setForm(toForm(updated));
      setMessage("奖励设置已保存");
      onSaved?.();
    } catch (err) {
      setError("保存失败: " + (err.message || "未知错误"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", textAlign: "center", paddingTop: "2rem" }}>加载中…</p>;
  if (!form) return <div><button onClick={onBack} style={s.back}>← 返回</button><p style={s.error}>{error || "无法加载设置"}</p></div>;

  return (
    <div>
      {!embedded && <button onClick={onBack} style={s.back}>← 返回</button>}
      {!embedded && <div style={s.hero}>
        <p style={s.kicker}>奖励设置</p>
        <h2 style={s.title}>{child.name}</h2>
        <p style={s.desc}>设置连续打卡怎么算，以及连续打卡后在星星商城支付多少比例。</p>
      </div>}
      {error && <div style={s.error}>{error}</div>}
      {message && <div style={s.success}>{message}</div>}
      <section style={s.card}>
        <h3 style={s.sectionTitle}>连续打卡怎么算？</h3>
        <label style={s.label}>当天完成任务比例达到</label>
        <div style={s.percentRow}>
          <input aria-label="连胜达标完成率" type="number" min="1" max="100" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} style={s.percentInput} />
          <span style={s.percentSign}>%</span>
        </div>
        <p style={s.hint}>达到这个比例，当天会计入连续打卡。修改后只影响之后的计算。</p>
      </section>
      <section style={s.card}>
        <div style={s.switchRow}>
          <div>
            <h3 style={s.sectionTitle}>连续打卡商城折扣</h3>
            <p style={s.hint}>每一档的支付比例由家长设置，可按每 7 天添加新档位。</p>
          </div>
          <button type="button" role="switch" aria-label="连续打卡商城折扣" aria-checked={form.enabled}
            className={`ios-switch ${form.enabled ? "on" : ""}`}
            onClick={() => setForm({ ...form, enabled: !form.enabled })}
          >
            <div className="ios-switch-thumb" />
          </button>
        </div>
        {form.tiers.map((tier, i) => {
          return (
            <div key={tier.days} style={s.tierRow}>
              <span style={s.tierDays}>连续 {tier.days} 天</span>
              <span style={s.tierText}>支付</span>
              <input aria-label={`连续${tier.days}天支付比例`} type="number" min="1" max="100" value={tier.discount_percent} onChange={e => updateTier(i, "discount_percent", e.target.value)} style={s.tierInput} />
              <span style={s.tierText}>%</span>
              {i >= MIN_TIER_COUNT && (
                <button onClick={() => removeTier(i)} style={s.removeBtn} title="移除此档位">✕</button>
              )}
            </div>
          );
        })}
        <button onClick={addTier} style={s.addBtn}>+ 添加下一档（+7 天）</button>
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
  back: { color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.8rem", background: "none", border: "none", cursor: "pointer", fontWeight: 650 },
  hero: { background: "var(--card-subtle)", borderRadius: "18px", padding: "1.2rem", marginBottom: "0.85rem", border: "1px solid var(--border-subtle)" },
  kicker: { color: "var(--accent)", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em" },
  title: { fontSize: "1.35rem", fontWeight: 750, marginTop: "0.15rem", color: "var(--text)" },
  desc: { color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.3rem", lineHeight: 1.5 },
  card: { background: "var(--card)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "0.85rem", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, marginBottom: "0.45rem", color: "var(--text)" },
  label: { color: "var(--muted)", fontSize: "0.82rem", fontWeight: 650 },
  percentRow: { display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.35rem" },
  percentInput: { width: "6rem", padding: "0.45rem 0.6rem", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "1rem", fontWeight: 700, background: "var(--card)", color: "var(--text)", fontVariantNumeric: "tabular-nums" },
  percentSign: { fontWeight: 700, color: "var(--accent)" },
  hint: { color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5, marginTop: "0.35rem" },
  switchRow: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" },
  switch: { color: "#FFFFFF", borderRadius: "var(--radius-pill)", padding: "0.35rem 0.75rem", fontSize: "0.82rem", fontWeight: 700, border: "none", cursor: "pointer" },
  tierRow: { display: "grid", gridTemplateColumns: "1fr auto 4.8rem auto auto", alignItems: "center", gap: "0.4rem", background: "var(--card-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.55rem 0.65rem", marginTop: "0.45rem" },
  tierDays: { fontWeight: 700, color: "var(--text)", fontSize: "0.9rem" },
  tierText: { color: "var(--muted)", fontSize: "0.82rem" },
  tierInput: { padding: "0.35rem", border: "1px solid var(--border)", borderRadius: "8px", textAlign: "center", fontWeight: 700, background: "var(--card)", color: "var(--text)", fontVariantNumeric: "tabular-nums" },
  removeBtn: { background: "none", border: "none", color: "var(--danger)", fontSize: "0.9rem", cursor: "pointer", padding: "0.2rem 0.3rem", lineHeight: 1 },
  addBtn: { display: "block", width: "100%", marginTop: "0.6rem", padding: "0.65rem", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--card-subtle)", color: "var(--accent)", fontSize: "0.85rem", fontWeight: 650, cursor: "pointer", textAlign: "center" },
  example: { marginTop: "0.6rem", color: "var(--star)", fontSize: "0.78rem", fontWeight: 600 },
  save: { width: "100%", padding: "0.75rem", borderRadius: "12px", background: "var(--accent)", color: "#FFFFFF", fontWeight: 700, fontSize: "0.95rem", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(67, 106, 84, 0.2)" },
  error: { background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "12px", padding: "0.7rem 0.9rem", marginBottom: "0.7rem", fontSize: "0.84rem", border: "1px solid var(--danger-border)" },
  success: { background: "var(--accent-light)", color: "var(--accent)", borderRadius: "12px", padding: "0.7rem 0.9rem", marginBottom: "0.7rem", fontSize: "0.84rem", fontWeight: 650, border: "1px solid var(--accent-pill)" },
};
