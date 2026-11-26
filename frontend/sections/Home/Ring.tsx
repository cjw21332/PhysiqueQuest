import type { ReactNode } from 'react';

// Circular progress used across Home; the caller supplies the accessible label.
export default function Ring({ percent, size = 56, stroke = 6, tone = 'green', children }: { percent: number; size?: number; stroke?: number; tone?: string; children?: ReactNode }) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return <span className={`hm-ring hm-tone-${tone}`} style={{ width: size, height: size }}>
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="hm-ring-track"/>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="hm-ring-fill" strokeDasharray={length} strokeDashoffset={length * (1 - clamped / 100)}/>
    </svg>
    {children !== undefined && <span className="hm-ring-label">{children}</span>}
  </span>;
}
