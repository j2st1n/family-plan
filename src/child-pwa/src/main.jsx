import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ChildFeedbackProvider } from "./components/ChildFeedback.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <ChildFeedbackProvider>
        <App />
      </ChildFeedbackProvider>
    </ThemeProvider>
  </StrictMode>
);
