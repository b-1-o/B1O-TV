import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'app-theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      mode === 'dark' ? '#08090b' : '#edf0f4',
    );

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Theme switching still works for this session when storage is unavailable.
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((previous) => (previous === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(
    () => ({ mode, isDark: mode === 'dark', toggleTheme, setMode }),
    [mode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
