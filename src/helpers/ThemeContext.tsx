import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

const CYCLE: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };

function resolveEffective(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(
    "dark",
    resolveEffective(theme) === "dark",
  );
}

interface ThemeContextType {
  theme: Theme;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  cycleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  });

  useEffect(() => {
    applyTheme(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [theme]);

  const cycleTheme = useCallback(() => {
    const next = CYCLE[theme];
    localStorage.setItem("theme", next);
    setTheme(next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
