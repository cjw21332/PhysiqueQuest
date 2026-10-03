'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'physiquequest-theme';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  // app/layout.tsx already applied the stored theme before paint, so read it
  // back on mount instead of re-resolving it (keeps server and client in sync)
  useEffect(() => setTheme(currentTheme()), []);

  const toggleTheme = useCallback(() => {
    setTheme(previous => {
      const next: Theme = previous === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
