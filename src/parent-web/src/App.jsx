import { useState, useEffect } from "react";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("parent_token"));

  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("parent_token");
        setToken(null);
      }
    } catch {
      localStorage.removeItem("parent_token");
      setToken(null);
    }
  }, [token]);

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return <Home token={token} onLogout={() => { localStorage.removeItem("parent_token"); setToken(null); }} />;
}
