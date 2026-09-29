import type { ReactNode } from 'react';

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    bell: <><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><circle cx="19" cy="5" r="3" className="icon-alert-dot"/></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/></>,
    coach: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></>,
    scan: <><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M7 12h10"/></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v2a4 4 0 004 4M17 6h3v2a4 4 0 01-4 4"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0114 0"/></>,
    fire: <><path d="M12 22a7 7 0 007-7c0-4-3-6-4-10-2 2-2 4-2 5-2-2-3-4-3-7-4 4-5 8-5 12a7 7 0 007 7z"/><path d="M12 22a3 3 0 003-3c0-2-2-3-3-5-1 2-3 3-3 5a3 3 0 003 3z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    dumbbell: <><path d="M6.5 8v8M4 9.5v5M17.5 8v8M20 9.5v5M6.5 12h11"/></>,
    meal: <><path d="M4 4v7M7 4v7M4 8h3M5.5 11v9M14 4v16M14 4c4 3 4 7 0 9"/></>,
    water: <><path d="M12 3s7 8 7 12a7 7 0 01-14 0c0-4 7-12 7-12z"/><path d="M9 16a3 3 0 003 3"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    trend: <><path d="m4 16 6-6 4 4 6-7"/><path d="M14 7h6v6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    arrow: <><path d="m9 18 6-6-6-6"/></>,
    medal: <><circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    phone: <><path d="M7 3h3l2 5-2.2 1.8a14 14 0 004.4 4.4L16 12l5 2v3c0 1.1-.9 2-2 2C10.2 19 5 13.8 5 5c0-1.1.9-2 2-2z"/></>,
    health: <><path d="M20.4 8.8c0 4-8.4 10-8.4 10s-8.4-6-8.4-10a4.6 4.6 0 018.4-2.1 4.6 4.6 0 018.4 2.1z"/><path d="M6.7 11.5h3l1.5-2.7 2.2 5 1.4-2.6h2.7"/></>,
    crown: <><path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7z"/><path d="M6 22h12"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3m-4 5v2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.target}</svg>;
}
