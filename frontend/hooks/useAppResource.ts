'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import { deviceCache } from '../lib/api';
import type { CachedResource, CacheState } from '../lib/deviceCache.mjs';
import { AUTH_STORAGE_KEY } from '../lib/session';

export function useAppResource<T>(key: CachedResource, load: (force?: boolean) => Promise<T>) {
  const [state, setState] = useState<CacheState<T>>({ data: undefined, refreshing: true, error: '' });
  const refresh = useCallback(() => load(true).catch(() => undefined), [load]);
  useLayoutEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      const next = deviceCache.get<T>(key);
      setState(next);
      if (next.data === undefined && !next.refreshing && !next.error) void load().catch(() => undefined);
    };
    const reload = () => { if (document.visibilityState === 'visible') void refresh(); };
    const unsubscribe = deviceCache.subscribe(update);
    update();
    void load().catch(() => undefined);
    const onStorage = (event: StorageEvent) => {
      // Snapshot writes in another tab must not cause reciprocal forced refreshes.
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY && event.key !== 'physiquequest-runtime-api-url') return;
      update();
      void refresh();
    };
    const onSessionEnded = () => update();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', reload);
    window.addEventListener('pageshow', reload);
    window.addEventListener('physiquequest:session-ended', onSessionEnded);
    document.addEventListener('visibilitychange', reload);
    // Re-check daily missions and today's water after midnight, including an idle open tab.
    const rollover = window.setInterval(update, 60_000);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(rollover);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', reload);
      window.removeEventListener('pageshow', reload);
      window.removeEventListener('physiquequest:session-ended', onSessionEnded);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [key, load, refresh]);
  return { ...state, error: state.data === undefined ? state.error : '', refreshError: state.error, loading: state.data === undefined && !state.error, refresh };
}
