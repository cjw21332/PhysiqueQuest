import type { ReactNode } from 'react';

/**
 * Header for the five main tabs (Home, Coach, Scan, Quests, Me): small eyebrow, large title and optional
 * actions on the right. Styled by `.pq-tab-header` in globals.css; sub-pages use `.pq-page-heading` instead.
 */
export default function TabHeader({ eyebrow, title, as: Heading = 'h2', className = '', children }: { eyebrow?: ReactNode; title: ReactNode; as?: 'h1' | 'h2'; className?: string; children?: ReactNode }) {
  return <header className={`pq-tab-header ${className}`.trim()}>
    <div className="pq-tab-copy">{eyebrow && <p className="pq-tab-eyebrow">{eyebrow}</p>}<Heading className="pq-tab-title">{title}</Heading></div>
    {children && <div className="pq-tab-actions">{children}</div>}
  </header>;
}
