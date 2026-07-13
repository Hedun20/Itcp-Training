import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_STORAGE_KEY } from './tokens';

const ThemeContext = createContext(null);

function resolveInitialTheme() {
  let saved;
  try {
    saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    saved = null;
  }
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  const setTheme = useCallback((nextTheme) => {
    const resolved = nextTheme === 'light' ? 'light' : 'dark';
    setThemeState(resolved);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch {
      // Theme changes still apply when browser storage is unavailable.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#050507' : '#fff8fc',
    );
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [setTheme, theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
