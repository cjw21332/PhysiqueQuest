'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useNotifications } from '../../hooks/useNotifications';
import { Icon } from './icons';

export default function Notifications({ onBack }: { onBack: () => void }) {
  const { items, reminder, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [pushMessage, setPushMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [reminderBusy, setReminderBusy] = useState(false);
  useEffect(() => { if (reminder) setReminderTime(`${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`); }, [reminder?.hour, reminder?.minute]);
  const native = typeof window !== 'undefined' && !!(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string; error?: string }>).detail;
      if (!detail?.token) { setPushMessage(detail?.error || 'Could not enable phone notifications.'); setBusy(false); return; }
      let id: string;
      try {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        id = localStorage.getItem('physiquequest-push-device') || Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('physiquequest-push-device', id);
      } catch { setPushMessage('Device storage is unavailable. Enable storage and try again.'); setBusy(false); return; }
      void api.registerPushDevice(id, detail.token).then(result => {
        setPushMessage(result.mode === 'expo' ? 'Phone notifications enabled.' : 'Device registered, but push delivery is not enabled on the server.');
      }).catch(err => setPushMessage(err instanceof Error ? err.message : 'Could not register this phone.')).finally(() => setBusy(false));
    };
    window.addEventListener('physiquequest-push-registration', handle);
    return () => window.removeEventListener('physiquequest-push-registration', handle);
  }, []);
  const enablePush = () => {
    setBusy(true); setPushMessage('');
    (window as unknown as { ReactNativeWebView: { postMessage(message: string): void } }).ReactNativeWebView.postMessage(JSON.stringify({ type: 'request-push-permission' }));
  };
  const unread = items.filter(item => item.unread).length;
  const saveReminder = async (enabled: boolean) => {
    const [hour, minute] = reminderTime.split(':').map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) { setPushMessage('Choose a reminder time.'); return; }
    setReminderBusy(true); setPushMessage('');
    try { await api.setNotificationReminder({ enabled, hour, minute, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); setPushMessage(enabled ? 'Daily reminder saved.' : 'Daily reminder turned off.'); }
    catch (err) { setPushMessage(err instanceof Error ? err.message : 'Could not save reminder.'); }
    finally { setReminderBusy(false); }
  };
  const sorted = [...items].reverse();
  const safety = sorted.find(item => item.icon === 'shield' || /(safety|emergency alert)/i.test(item.title));
  return <div className="home-notifications">
    <header className="section-page-head home-notifications-head"><div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Notifications</h2></div>{unread > 0 && <button type="button" className="mark-all-btn" onClick={() => void markAllRead()}>Mark all read</button>}</header>
    {native && <div className="notification-preview-note"><button type="button" disabled={busy} onClick={enablePush}>{busy ? 'Enabling…' : 'Enable phone notifications'}</button><p>Receive system notifications on this phone when the app is closed.</p></div>}
    <div className="notification-reminder"><label htmlFor="reminder-time">Daily check-in reminder</label><div><input id="reminder-time" type="time" value={reminderTime} onChange={event => setReminderTime(event.target.value)}/><button type="button" disabled={reminderBusy} onClick={() => void saveReminder(true)}>Save reminder</button>{reminder?.enabled && <button type="button" disabled={reminderBusy} onClick={() => void saveReminder(false)}>Turn off</button>}</div><small>{reminder?.enabled ? `On · ${reminder.timezone}` : 'Off until you enable it'} · Times use your device timezone.</small></div>
    {pushMessage && <p role="status" className="notification-preview-note">{pushMessage}</p>}
    {error && <div role="alert" className="scan-warning"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {loading ? <p role="status" className="notifications-state">Loading notifications…</p> : !items.length && !error ? <p className="notifications-state">You’re all caught up. New notifications will appear here.</p> : <>{safety && <section className="safety-alert notification-safety-card" aria-label="Pinned safety notice"><span className="alert-icon"><Icon name="shield" size={18}/></span><div className="alert-content"><span className="alert-badge">Safety notice · pinned</span><b className="alert-title">{safety.title}</b><p className="alert-body">{safety.body}</p>{safety.unread && <button type="button" className="alert-action" onClick={() => void markRead(safety.id)}>Mark as read</button>}</div><span className="notification-time">{safety.createdAt ? new Date(safety.createdAt).toLocaleDateString() : safety.time}{safety.unread && <i className="unread-dot"/>}</span></section>}<section className="notification-group" aria-label="Your notifications">{sorted.filter(item => item.id !== safety?.id).map(item => <button type="button" className={`notification-item ${item.unread ? 'unread' : ''}`} key={item.id} onClick={() => { if (item.unread) void markRead(item.id); }} aria-label={`${item.title}${item.unread ? ', unread' : ''}`}><span className={`notification-icon ${item.icon}`}><Icon name={item.icon} size={16}/></span><span className="notification-copy"><b>{item.title}{item.unread && <span className="notification-unread-label"> (unread)</span>}</b><small>{item.body}</small></span><span className="notification-time">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : item.time}{item.unread && <i className="unread-dot"/>}</span></button>)}</section></>}
  </div>;
}
