import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { FeedbackProvider } from "./components/FeedbackContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
