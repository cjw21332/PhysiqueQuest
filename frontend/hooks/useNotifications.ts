'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
export type AppNotification = { id: string; icon: string; title: string; subtitle: string; body: string; time: string; unread: boolean; group: string };
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { const result = await api.getNotifications(); setItems(result.items ?? []); } catch (err) { setError(err instanceof Error ? err.message : 'Could not load notifications.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const markRead = useCallback(async (id: string) => { const result = await api.markNotification(id, false); setItems(result.items ?? []); }, []);
  const markAllRead = useCallback(async () => { const result = await api.markAllNotifications(); setItems(result.items ?? []); }, []);
  return { items, loading, error, refresh, markRead, markAllRead };
}
