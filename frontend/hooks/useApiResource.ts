'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Snapshot<T> = {
  data?: T;
  loading: boolean;
  error: string;
  savedAt: number;
};
const cache = new Map<
  string,
  {
    snapshot: Snapshot<unknown>;
    pending?: Promise<void>;
    listeners: Set<() => void>;
    version: number;
  }
>();
export function accountScope() {
  try {
    const user = JSON.parse(
      localStorage.getItem('physiquequest-auth') || 'null',
    );
    return user?.id && user?.token ? String(user.id) : '';
  } catch {
    return '';
  }
}
export function notifyDataChanged(...topics: string[]) {
  for (const [key, record] of cache)
    if (
      topics.some(
        (topic) => key.endsWith(`:${topic}`) || key.includes(`:${topic}:`),
      )
    ) {
      record.version++;
      record.snapshot.savedAt = 0;
    }
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('physiquequest:data-updated', { detail: topics }),
    );
}
export function useApiResource<T>(topic: string, loader: () => Promise<T>) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    loading: true,
    error: '',
    savedAt: 0,
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const keyRef = useRef('');
  const refresh = useCallback(
    async (force = true) => {
      const scope = accountScope();
      if (!scope) return;
      const key = `${scope}:${topic}`;
      keyRef.current = key;
      let record = cache.get(key);
      if (!record) {
        record = {
          snapshot: { loading: true, error: '', savedAt: 0 },
          listeners: new Set(),
          version: 0,
        };
        cache.set(key, record);
      }
      if (record.pending) return record.pending;
      if (!force && Date.now() - record.snapshot.savedAt < 30_000) {
        setSnapshot(record.snapshot as Snapshot<T>);
        return;
      }
      const current = record,
        version = record.version;
      current.snapshot = { ...current.snapshot, loading: true, error: '' };
      current.listeners.forEach((fn) => fn());
      current.pending = (async () => {
        try {
          const data = await loaderRef.current();
          if (accountScope() === scope && current.version === version)
            current.snapshot = {
              data,
              loading: false,
              error: '',
              savedAt: Date.now(),
            };
        } catch (err) {
          if (current.version === version)
            current.snapshot = {
              ...current.snapshot,
              loading: false,
              error:
                err instanceof Error ? err.message : 'Could not load data.',
            };
        } finally {
          current.pending = undefined;
          current.listeners.forEach((fn) => fn());
          if (current.version !== version && current.listeners.size)
            void refresh();
        }
      })();
      return current.pending;
    },
    [topic],
  );
  useEffect(() => {
    const scope = accountScope(),
      key = `${scope}:${topic}`;
    keyRef.current = key;
    if (!scope) {
      setSnapshot({
        loading: false,
        error: 'Sign in to continue.',
        savedAt: 0,
      });
      return;
    }
    if (!cache.has(key))
      cache.set(key, {
        snapshot: { loading: true, error: '', savedAt: 0 },
        listeners: new Set(),
        version: 0,
      });
    const record = cache.get(key)!;
    const update = () => {
      if (accountScope() === scope)
        setSnapshot({ ...record.snapshot } as Snapshot<T>);
    };
    record.listeners.add(update);
    update();
    void refresh(false);
    const changed = (event: Event) => {
      if (
        (event as CustomEvent<string[]>).detail?.some(
          (value) => value === topic || topic.startsWith(`${value}:`),
        )
      )
        void refresh();
    };
    const active = () => {
      if (!document.hidden) void refresh(false);
    };
    const clear = () => {
      cache.clear();
      setSnapshot({
        loading: false,
        error: 'Sign in to continue.',
        savedAt: 0,
      });
    };
    window.addEventListener('physiquequest:data-updated', changed);
    window.addEventListener('focus', active);
    window.addEventListener('pageshow', active);
    window.addEventListener('physiquequest:session-cleared', clear);
    return () => {
      record.listeners.delete(update);
      window.removeEventListener('physiquequest:data-updated', changed);
      window.removeEventListener('focus', active);
      window.removeEventListener('pageshow', active);
      window.removeEventListener('physiquequest:session-cleared', clear);
    };
  }, [topic, refresh]);
  return { ...snapshot, refresh: () => refresh(true) };
}
