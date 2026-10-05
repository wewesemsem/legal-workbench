"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  THEME_COOKIE,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/modules/theme/config";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleNightMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistPreference(preference: ThemePreference) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=${maxAge}; samesite=lax`;
}

function applyResolved(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({
  initialPreference,
  initialResolved,
  children,
}: {
  initialPreference: ThemePreference;
  initialResolved: ResolvedTheme;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    parseThemePreference(initialPreference),
  );
  const [systemDark, setSystemDark] = useState(
    () => initialResolved === "dark" && initialPreference === "system",
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(initialResolved);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function syncSystem() {
      setSystemDark(media.matches);
    }
    syncSystem();
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);

  useEffect(() => {
    const next = resolveTheme(preference, systemDark);
    setResolved(next);
    applyResolved(next);
  }, [preference, systemDark]);

  const setPreference = useCallback((next: ThemePreference) => {
    const value = parseThemePreference(next);
    setPreferenceState(value);
    persistPreference(value);
  }, []);

  const toggleNightMode = useCallback(() => {
    setPreferenceState((current) => {
      const currentlyDark = resolveTheme(current, systemDark) === "dark";
      const next: ThemePreference = currentlyDark ? "light" : "dark";
      persistPreference(next);
      return next;
    });
  }, [systemDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference,
      toggleNightMode,
    }),
    [preference, resolved, setPreference, toggleNightMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
