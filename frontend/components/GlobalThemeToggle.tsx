'use client';

import ThemeToggle from '../sections/Home/ThemeToggle';
import { useTheme } from '../sections/Home/useTheme';
import { useEffect, useState } from 'react';

export default function GlobalThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <ThemeToggle theme={theme} onToggle={toggleTheme} />;
}
