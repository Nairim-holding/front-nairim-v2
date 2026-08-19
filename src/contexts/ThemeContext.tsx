"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = `nairim.theme`;

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readThemeFromBody(): Theme {
  if (typeof document === "undefined") return "light";
  return document.body.classList.contains("dark") ? "dark" : "light";
}

function applyThemeToBody(theme: Theme) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("dark", theme === "dark");
}

function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors (private mode / blocked storage)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // O tema real vive na classe do <body>, escrita pelo script de bootstrap do
  // RootLayout antes da hidratação. Ler essa classe no initializer quebraria a
  // hidratação: no servidor não existe `document`, então o HTML do servidor
  // sairia sempre como "light" enquanto o cliente já leria "dark".
  // Começamos sempre em "light" (igual ao servidor) e sincronizamos no efeito,
  // depois que o React casou as duas árvores.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const bootstrapped = readThemeFromBody();
    if (bootstrapped !== "light") {
      setThemeState(bootstrapped);
    }
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyThemeToBody(nextTheme);
    persistTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
