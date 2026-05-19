import { useState } from "react";
import api from "../api.js";

export default function ChildCreate({ token, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createChild(token, name.trim(), grade.trim() || null);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "1.2rem" }}>
        <button onClick={onCancel} style={{ color: "#7c6f97", fontSize: "0.95rem" }}>← 返回</button>
      </div>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>添加孩子</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="名字"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          style={styles.input}
        />
        <input
          placeholder="年级（选填）"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={styles.input}
        />
        <button type="submit" disabled={loading || !name.trim()} style={styles.btn}>
          {loading ? "创建中…" : "创建"}
        </button>
      </form>
    </div>
  );
}

const styles = {
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
    background: "#7c6f97",
    borderRadius: "12px",
    marginTop: "0.4rem",
  },
};
