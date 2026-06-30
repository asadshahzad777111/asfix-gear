import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'asfix-theme';
const MODES = ['light', 'dark', 'auto'];

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode) {
  return mode === 'auto' ? getSystemTheme() : mode;
}

function applyTheme(mode) {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.add('theme-transitioning');
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-mode', mode);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#f2f2f7' : '#0c0c12');
  }

  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning');
  }, 480);
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    if (typeof window === 'undefined') return 'auto';
    return localStorage.getItem(STORAGE_KEY) || 'auto';
  });

  const setMode = useCallback((next) => {
    const value = MODES.includes(next) ? next : 'auto';
    setModeState(value);
    localStorage.setItem(STORAGE_KEY, value);
    applyTheme(value);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const idx = MODES.indexOf(current);
      const next = MODES[(idx + 1) % MODES.length];
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'auto') return undefined;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const resolved = resolveTheme(mode);

  const value = useMemo(
    () => ({ mode, resolved, setMode, cycleMode }),
    [mode, resolved, setMode, cycleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
