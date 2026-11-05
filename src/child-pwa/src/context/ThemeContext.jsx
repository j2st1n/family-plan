import { createContext, useContext } from "react";
import { useThemeState } from "../utils/theme.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const theme = useThemeState();
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
