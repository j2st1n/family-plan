import { useState, useEffect, useCallback } from "react";

export const THEME_STORAGE_KEY = "family_plan_theme";

/**
 * 获取当前系统偏好 (dark | light)
 */
export function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (e) {
    return "light";
  }
}

/**
 * 获取持久化的主题偏好 ('auto' | 'light' | 'dark')
 */
export function getSavedThemePreference() {
  if (typeof window === "undefined") {
    return "auto";
  }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "auto") {
      return saved;
    }
  } catch (e) {
    // localStorage may be unavailable in some restricted environments
  }
  return "auto";
}

/**
 * 根据偏好计算当前实际生效的主题 ('dark' | 'light')
 */
export function resolveEffectiveTheme(preference) {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return getSystemTheme();
}

/**
 * 将主题属性注入到 <html> 根节点
 */
export function applyTheme(preference) {
  const effective = resolveEffectiveTheme(preference);
  if (typeof document !== "undefined" && document.documentElement) {
    const root = document.documentElement;
    root.setAttribute("data-theme", effective);
    root.setAttribute("data-theme-preference", preference);
    if (root.style) {
      root.style.colorScheme = effective;
    }
  }
  return effective;
}

/**
 * 保存主题偏好到 localStorage 并立即生效
 */
export function saveThemePreference(preference) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
      localStorage.setItem("theme", preference);
    }
  } catch (e) {}
  return applyTheme(preference);
}

/**
 * React 状态 Hook：支持跟随系统、手动切换、系统广播监听与多标签页同态同步
 */
export function useThemeState() {
  const [preference, setPreference] = useState(() => getSavedThemePreference());
  const [effectiveTheme, setEffectiveTheme] = useState(() => resolveEffectiveTheme(getSavedThemePreference()));

  useEffect(() => {
    // 首次挂载时确保持久化与 DOM 状态对齐
    const currentEffective = applyTheme(preference);
    setEffectiveTheme(currentEffective);

    if (typeof window === "undefined" || !window.matchMedia) return;

    // 系统级暗色模式变更监听
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const currentPref = getSavedThemePreference();
      if (currentPref === "auto") {
        const eff = applyTheme("auto");
        setEffectiveTheme(eff);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleMediaChange);
    }

    // 跨标签页同步
    const handleStorageChange = (e) => {
      if (e.key === THEME_STORAGE_KEY || e.key === "theme") {
        const nextPref = getSavedThemePreference();
        setPreference(nextPref);
        const eff = applyTheme(nextPref);
        setEffectiveTheme(eff);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleMediaChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleMediaChange);
      }
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [preference]);

  const setTheme = useCallback((newPref) => {
    if (newPref !== "auto" && newPref !== "light" && newPref !== "dark") return;
    setPreference(newPref);
    const eff = saveThemePreference(newPref);
    setEffectiveTheme(eff);
  }, []);

  const toggleTheme = useCallback(() => {
    // 切换：深色与浅色互切
    setTheme(effectiveTheme === "dark" ? "light" : "dark");
  }, [effectiveTheme, setTheme]);

  const cycleTheme = useCallback(() => {
    // 三态轮转：auto -> light -> dark -> auto
    const cycleMap = { auto: "light", light: "dark", dark: "auto" };
    setTheme(cycleMap[preference] || "light");
  }, [preference, setTheme]);

  return {
    preference,
    effectiveTheme,
    isDark: effectiveTheme === "dark",
    setTheme,
    toggleTheme,
    cycleTheme,
  };
}
