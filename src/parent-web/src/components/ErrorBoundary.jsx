import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text)" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "12px" }}>⚠️</span>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>
            页面渲染遇到了一点问题
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--danger)", marginBottom: "16px", wordBreak: "break-all" }}>
            {this.state.error?.message || "未知渲染异常"}
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            刷新重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
