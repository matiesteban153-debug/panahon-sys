import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  isDark: false,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(t: Theme): boolean {
  return t === "dark" || (t === "system" && getSystemDark());
}

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("panahon-theme") as Theme | null;
      return stored ?? "system";
    } catch {
      return "system";
    }
  });

  const [isDark, setIsDark] = useState(() => resolveIsDark(theme));

  // Apply on every theme change
  useEffect(() => {
    const dark = resolveIsDark(theme);
    applyDarkClass(dark);
    setIsDark(dark);
  }, [theme]);

  // Sync with system preference when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const dark = mq.matches;
      applyDarkClass(dark);
      setIsDark(dark);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem("panahon-theme", t);
    } catch {
      // ignore storage errors
    }
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
