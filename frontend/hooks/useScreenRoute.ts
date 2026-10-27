'use client';

import { usePathname } from 'next/navigation';

export function useScreenRoute<T extends string>(base: string, paths: Record<T, string>, fallback: T): [T, (view: T) => void] {
  const pathname = usePathname();
  const view = (Object.keys(paths) as T[]).find(key => `${base}${paths[key]}` === pathname) ?? fallback;
  return [view, next => {
    const url = `${base}${paths[next]}`;
    if (window.location.pathname !== url) window.history.pushState(null, '', url);
  }];
}
