'use client';
import { useEffect, useState, type ReactNode } from 'react';

const paths: Record<string, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75',
  inbox: 'M3 13h5l2 3h4l2-3h5M5.5 5h13L21 13v6H3v-6z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11',
  food: 'M12 7c-2-3-7-2-7 3 0 5 4 10 7 10s7-5 7-10c0-5-5-6-7-3zM12 7c0-2 1-4 3-4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg className="adm-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? ''} /></svg>;
}

export const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

/** Loads one API resource and exposes loading, error and a manual reload. */
export function useAdminData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    load().then(value => { if (active) setData(value); })
      .catch(e => { if (active) setError(errorText(e, 'Could not load this data. Try again.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick(value => value + 1) };
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children?: ReactNode }) {
  return <header className="adm-page-head">
    <div><p className="adm-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="adm-sub">{subtitle}</p></div>
    {children && <div className="adm-page-actions">{children}</div>}
  </header>;
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note: string; tone?: 'accent' | 'cyan' | 'violet' | 'amber' | 'red' }) {
  return <div className={`adm-stat ${tone ? `tone-${tone}` : ''}`}>
    <span className="adm-stat-label">{label}</span>
    <strong className="adm-stat-value">{value}</strong>
    <span className="adm-stat-note">{note}</span>
  </div>;
}

export function Card({ title, eyebrow, action, children, className = '' }: { title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`adm-card ${className}`}>
    {(title || action) && <div className="adm-card-head"><div>{eyebrow && <p className="adm-eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}</div>{action}</div>}
    {children}
  </section>;
}

export function State({ loading, error, empty, onRetry, children }: { loading: boolean; error: string; empty?: boolean | string; onRetry?: () => void; children?: ReactNode }) {
  if (error) return <div className="adm-state adm-state-error" role="alert"><Icon name="alert" /><span>{error}</span>{onRetry && <button type="button" className="adm-btn adm-btn-ghost" onClick={onRetry}>Retry</button>}</div>;
  if (loading) return <div className="adm-state" role="status"><span className="adm-spinner" aria-hidden="true" />Loading…</div>;
  if (empty) return <div className="adm-state">{typeof empty === 'string' ? empty : 'Nothing to show yet.'}</div>;
  return <>{children}</>;
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return <div className="adm-segmented" role="radiogroup" aria-label={label}>
    {options.map(([key, text]) => <button key={key} type="button" role="radio" aria-checked={value === key} className={value === key ? 'is-on' : ''} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return <label className="adm-search"><Icon name="search" size={16} /><span className="adm-sr">{label}</span><input type="search" value={value} maxLength={100} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></label>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? (page - 1) * pageSize + 1 : 0;
  return <nav className="adm-pagination" aria-label="Pagination">
    <span>{first}–{Math.min(total, page * pageSize)} of {total}</span>
    <button type="button" className="adm-btn adm-btn-ghost adm-btn-icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="left" size={16} /></button>
    <span>Page {page} / {last}</span>
    <button type="button" className="adm-btn adm-btn-ghost adm-btn-icon" aria-label="Next page" disabled={page >= last} onClick={() => onPage(page + 1)}><Icon name="right" size={16} /></button>
  </nav>;
}

/** Horizontal bars, each scaled to the largest value in the list. */
export function BarList({ rows, unit, tone = 'accent' }: { rows: { label: string; value: number }[]; unit: string; tone?: string }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return <ol className="adm-barlist">
    {rows.map((row, index) => <li key={`${row.label}-${index}`}>
      <span className="adm-barlist-rank">{String(index + 1).padStart(2, '0')}</span>
      <span className="adm-barlist-label" title={row.label}>{row.label}</span>
      <span className="adm-barlist-track"><span className={`adm-barlist-fill tone-${tone}`} style={{ width: `${(row.value / max) * 100}%` }} /></span>
      <span className="adm-barlist-value">{row.value.toLocaleString()} <small>{unit}</small></span>
    </li>)}
  </ol>;
}

export const formatDate = (value?: string | null, withTime = false) => value ? new Date(value).toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—';
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
export const humanize = (value: string) => value.replaceAll('_', ' ').replaceAll('-', ' ');
