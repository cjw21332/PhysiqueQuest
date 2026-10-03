'use client';

import { Icon } from './icons';
import type { Theme } from './useTheme';

export default function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return <button type="button" className="theme-toggle" onClick={onToggle} role="switch" aria-checked={dark} aria-label={label} title={label}>
    <Icon name={dark ? 'sun' : 'moon'} size={15}/>
  </button>;
}
