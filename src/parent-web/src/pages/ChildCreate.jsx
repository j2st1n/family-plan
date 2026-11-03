import { useState } from "react";
import api from "../api.js";

const GRADE_OPTIONS = {
  幼儿园: ["小班", "中班", "大班"],
  小学: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
  初中: ["初一", "初二", "初三"],
  高中: ["高一", "高二", "高三"],
};

export default function ChildCreate({ token, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState("");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const gradeLabel = stage && grade ? stage + grade : null;
      await api.createChild(token, name.trim(), gradeLabel);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  const grades = stage ? GRADE_OPTIONS[stage] : [];

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "480px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          height: "44px",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="ios-sheet-nav-btn"
        >
          取消
        </button>
        <span style={{ fontSize: "1.05rem", fontWeight: 650, color: "var(--text)" }}>
          添加孩子档案
        </span>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="ios-sheet-nav-action-btn"
        >
          {loading ? "创建中…" : "完成"}
        </button>
      </div>

      <div className="ios-grouped-card" style={{ marginBottom: "20px" }}>
        {/* Row 1: 姓名 */}
        <div style={{ padding: "12px 16px" }}>
          <input
            placeholder="孩子姓名 (如：Evan)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "1.02rem",
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div className="ios-separator" />

        {/* Row 2: 学段 */}
        <div style={{ padding: "10px 16px" }}>
          <div style={{ fontSize: "0.88rem", color: "var(--muted)", fontWeight: 500, marginBottom: "8px" }}>
            学段
          </div>
          <div className="ios-segmented-control">
            {Object.keys(GRADE_OPTIONS).map((s) => (
              <button
                key={s}
                type="button"
                className={`ios-segmented-item ${stage === s ? "active" : ""}`}
                onClick={() => {
                  setStage(s);
                  const firstGrade = (GRADE_OPTIONS[s] || [])[0] || "";
                  setGrade(firstGrade);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {stage && (
          <>
            <div className="ios-separator" />

            {/* Row 3: 年级 */}
            <div style={{ padding: "10px 16px" }}>
              <div style={{ fontSize: "0.88rem", color: "var(--muted)", fontWeight: 500, marginBottom: "8px" }}>
                年级
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {grades.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`pill-segment-btn ${grade === g ? "active" : ""}`}
                    onClick={() => setGrade(g)}
                    style={{ padding: "6px 12px", fontSize: "0.82rem", borderRadius: "8px", whiteSpace: "nowrap" }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

const styles = {
  label: {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 650,
    color: "var(--muted)",
    marginBottom: "0.25rem",
    marginTop: "0.3rem",
  },
  input: {
    width: "100%",
    padding: "0.7rem 0.8rem",
    fontSize: "1rem",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    background: "var(--card)",
    color: "var(--text)",
    marginBottom: "0.6rem",
    outline: "none",
    display: "block",
  },
  btn: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: 650,
    color: "#FFFFFF",
    background: "var(--accent)",
    border: "none",
    borderRadius: "12px",
    marginTop: "0.6rem",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(67, 106, 84, 0.2)",
  },
};
