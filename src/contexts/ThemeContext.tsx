import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

export type ThemeMode = 'dark';

interface ThemeContextValue {
  mode: 'dark';
  isDark: true;
}

const STORAGE_KEY = 'app-theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ mode: 'dark' as const, isDark: true as const }), []);

  useEffect(() => {
    // Force the cinematic dark palette on every launch, including devices that
    // still have "light" saved from an older version of B1O TV.
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#08090b');
    try {
      window.localStorage.setItem(STORAGE_KEY, 'dark');
    } catch {
      // The fixed dark theme remains active for this session if storage is blocked.
    }
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
