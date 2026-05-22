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
    <div>
      <div style={{ marginBottom: "1.2rem" }}>
        <button onClick={onCancel} style={{ color: "#3d9e6b", fontSize: "0.95rem" }}>← 返回</button>
      </div>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>添加孩子</h2>
      <form onSubmit={handleSubmit}>
        <label style={styles.label}>名字</label>
        <input
          placeholder="如：Evan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          style={styles.input}
        />
        <label style={styles.label}>学段</label>
        <select
          value={stage}
          onChange={(e) => { setStage(e.target.value); setGrade(""); }}
          style={styles.input}
        >
          <option value="">不填</option>
          {Object.keys(GRADE_OPTIONS).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {stage && (
          <>
            <label style={styles.label}>年级</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={styles.input}
            >
              <option value="">请选择</option>
              {grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </>
        )}
        <button type="submit" disabled={loading || !name.trim()} style={styles.btn}>
          {loading ? "创建中…" : "创建"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  label: {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#4a4540",
    marginBottom: "0.25rem",
    marginTop: "0.3rem",
  },
  input: {
    width: "100%",
    padding: "0.7rem 0.8rem",
    fontSize: "1rem",
    border: "1px solid #e8e4df",
    borderRadius: "10px",
    marginBottom: "0.6rem",
    outline: "none",
    display: "block",
  },
  btn: {
    width: "100%",
    padding: "0.7rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
    background: "#3d9e6b",
    borderRadius: "12px",
    marginTop: "0.4rem",
  },
};
