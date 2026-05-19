import { useState, useEffect } from "react";
import Bind from "./pages/Bind.jsx";
import Today from "./pages/Today.jsx";

export default function App() {
  const [deviceToken, setDeviceToken] = useState(() => localStorage.getItem("device_token"));
  const [child, setChild] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("child_profile"));
    } catch {
      return null;
    }
  });

  function handleBound(token, profile) {
    localStorage.setItem("device_token", token);
    localStorage.setItem("child_profile", JSON.stringify(profile));
    setDeviceToken(token);
    setChild(profile);
  }

  function handleExpired() {
    localStorage.removeItem("device_token");
    localStorage.removeItem("child_profile");
    setDeviceToken(null);
    setChild(null);
  }

  if (!deviceToken) {
    return <Bind onBound={handleBound} />;
  }

  return <Today child={child} onExpired={handleExpired} />;
}
