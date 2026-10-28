'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAppResource } from './useAppResource';
export type AppNotification = { id: string; icon: string; title: string; subtitle: string; body: string; time: string; unread: boolean; group: string; createdAt?: string };
export type NotificationReminder = { enabled: boolean; hour: number; minute: number; timezone: string };
const load = (force?: boolean) => api.getNotifications(force);
export function useNotifications() {
  const { data, loading, error, refresh } = useAppResource<{ items: AppNotification[]; reminder?: NotificationReminder | null }>('notifications', load);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('physiquequest-notification-received', update);
    return () => { window.clearInterval(timer); window.removeEventListener('physiquequest-notification-received', update); };
  }, [refresh]);
  const markRead = useCallback(async (id: string) => { setActionError(''); try { await api.markNotification(id, false); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not update notification.'); } }, []);
  const markAllRead = useCallback(async () => { setActionError(''); try { await api.markAllNotifications(); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not update notifications.'); } }, []);
  return { items: data?.items ?? [], reminder: data?.reminder, loading, error: actionError || error, refresh, markRead, markAllRead };
}
