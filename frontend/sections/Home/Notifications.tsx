'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useNotifications } from '../../hooks/useNotifications';
import { Icon } from './icons';
import DeleteConfirmation from '../../components/DeleteConfirmation';

export default function Notifications({ onBack }: { onBack: () => void }) {
  const { items, reminder, loading, error, refresh, markRead, markAllRead, clearNotifications } = useNotifications();
  const [pushMessage, setPushMessage] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const pushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [reminderBusy, setReminderBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState('');
  const [clearSelection, setClearSelection] = useState<{ ids: string[]; hasMore: boolean; pinned: boolean } | null>(null);
  const [clearFailed, setClearFailed] = useState(false);
  useEffect(() => { if (reminder) setReminderTime(`${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`); }, [reminder?.hour, reminder?.minute]);
  useEffect(() => {
    setNative(!!(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView);
    return () => { if (pushTimeout.current) clearTimeout(pushTimeout.current); };
  }, []);
  useEffect(() => {
    const handle = (event: Event) => {
      if (pushTimeout.current) clearTimeout(pushTimeout.current);
      pushTimeout.current = null;
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
    const bridge = (window as unknown as { ReactNativeWebView?: { postMessage(message: string): void } }).ReactNativeWebView;
    if (!bridge) { setPushMessage('Open PhysiqueQuest on your phone to enable phone notifications.'); return; }
    setBusy(true); setPushMessage('');
    pushTimeout.current = setTimeout(() => { setBusy(false); setPushMessage('Phone notifications did not respond. Please try again.'); }, 30000);
    try { bridge.postMessage(JSON.stringify({ type: 'request-push-permission' })); }
    catch { if (pushTimeout.current) clearTimeout(pushTimeout.current); pushTimeout.current = null; setBusy(false); setPushMessage('Could not contact your phone. Please try again.'); }
  };
  const unread = items.filter(item => item.unread).length;
  const saveReminder = async (enabled: boolean) => {
    const [hour, minute] = reminderTime.split(':').map(Number);
    if (enabled && (!/^\d{2}:\d{2}$/.test(reminderTime) || hour > 23 || minute > 59)) { setReminderMessage('Choose a reminder time.'); return; }
    const savedHour = enabled ? hour : reminder?.hour ?? 20;
    const savedMinute = enabled ? minute : reminder?.minute ?? 0;
    setReminderBusy(true); setReminderMessage('');
    try { await api.setNotificationReminder({ enabled, hour: savedHour, minute: savedMinute, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); await refresh(); setReminderMessage(enabled ? 'Daily reminder saved.' : 'Daily reminder turned off.'); }
    catch (err) { setReminderMessage(err instanceof Error ? err.message : 'Could not save reminder.'); }
    finally { setReminderBusy(false); }
  };
  const sorted = [...items].reverse();
  const safety = sorted.find(item => item.icon === 'shield' || /(safety|emergency alert)/i.test(item.title));
  const remaining = sorted.filter(item => item.id !== safety?.id);
  const clearRecent = async () => {
    if (!clearSelection || clearing) return;
    setClearing(true); setClearMessage(''); setClearFailed(false);
    try {
      if (await clearNotifications(clearSelection.ids)) {
        setClearMessage(clearSelection.hasMore ? 'Notifications cleared. More notifications are available to clear.' : 'Notifications cleared.');
        setClearSelection(null);
      } else setClearFailed(true);
    }
    finally { setClearing(false); }
  };
  return <div className="home-notifications">
    <header className="section-page-head home-notifications-head">
      <div className="section-back-title pq-page-heading"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={20}/></button><h2>Notifications</h2></div>
    </header>
    <div className="notification-intro"><div><h3>Your updates</h3><p>Keep track of your activity and safety notices.</p></div><span className="notification-count">{unread ? `${unread} unread` : 'All caught up'}</span></div>
    {(unread > 0 || remaining.length > 0) && <div className="notification-actions" aria-label="Notification actions">
      {unread > 0 && <button type="button" className="mark-all-btn" disabled={clearing} onClick={() => void markAllRead()}><Icon name="check-circle" size={16}/> Mark all read</button>}
      {remaining.length > 0 && <button type="button" className="notification-clear" disabled={clearing} onClick={() => { setClearFailed(false); setClearSelection({ ids: remaining.slice(0, 1000).map(item => item.id), hasMore: remaining.length > 1000, pinned: Boolean(safety) }); }}><Icon name="trash" size={16}/>Clear notifications</button>}
    </div>}
    {clearMessage && <p role="status" className="notification-clear-feedback">{clearMessage}</p>}
    {clearSelection && <DeleteConfirmation title="Clear notifications?" description={`Remove ${clearSelection.ids.length} notification${clearSelection.ids.length === 1 ? '' : 's'}?${clearSelection.pinned ? ' Your pinned safety notice will stay.' : ''}`} confirmLabel="Clear notifications" busyLabel="Clearing…" busy={clearing} error={clearFailed ? 'Could not clear notifications. Please try again.' : undefined} onCancel={() => setClearSelection(null)} onConfirm={() => void clearRecent()}/>}
    {error && !clearFailed && <div role="alert" className="scan-warning notification-error"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {clearFailed && !clearSelection && <p role="alert" className="notification-clear-feedback">Could not clear notifications. Please try again.</p>}
    {loading && !items.length ? <p role="status" className="notifications-state">Loading notifications…</p> : !items.length && !error ? <div className="notification-empty"><span className="notification-empty-icon"><Icon name="bell" size={24}/></span><strong>You’re all caught up</strong><p>New notifications will appear here.</p></div> : <>
      {safety && <section className="safety-alert notification-safety-card" aria-label="Pinned safety notice">
        <span className="alert-icon"><Icon name="shield" size={18}/></span>
        <div className="alert-content"><span className="alert-badge">Safety notice · pinned</span><b className="alert-title">{safety.title}</b><p className="alert-body">{safety.body}</p><span className="notification-safety-date">{safety.createdAt ? new Date(safety.createdAt).toLocaleDateString() : safety.time}</span>{safety.unread && <button type="button" className="alert-action" onClick={() => void markRead(safety.id)}>Mark as read</button>}</div>
      </section>}
      {remaining.length > 0 && <section className="notification-group" aria-label="Your notifications"><h3>Recent activity</h3>{remaining.map(item => <button type="button" className={`notification-item ${item.unread ? 'unread' : ''}`} key={item.id} onClick={() => { if (item.unread) void markRead(item.id); }} aria-label={`${item.title}, ${item.body}${item.unread ? ', unread, mark as read' : ''}`}><span className={`notification-icon ${item.icon}`}><Icon name={item.icon} size={18}/></span><span className="notification-copy"><span className="notification-row-title"><b>{item.title}</b>{item.unread && <span className="notification-unread-label">Unread</span>}</span><small>{item.body}</small><span className="notification-time">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : item.time}</span></span>{item.unread && <i className="unread-dot" aria-hidden="true"/>}</button>)}</section>}
    </>}
    <section className="notification-settings" aria-labelledby="notification-settings-title"><div className="notification-settings-heading"><span className="notification-settings-icon"><Icon name="clock" size={19}/></span><div><h3 id="notification-settings-title">Daily check-in</h3><p>Choose when you’d like a reminder.</p></div><span className="notification-setting-status">{reminder?.enabled ? 'On' : 'Off'}</span></div>
      <div className="notification-reminder"><label htmlFor="reminder-time">Reminder time</label><div className="notification-reminder-controls"><input id="reminder-time" type="time" value={reminderTime} onChange={event => setReminderTime(event.target.value)} disabled={reminderBusy}/><button type="button" className="notification-save" disabled={reminderBusy} onClick={() => void saveReminder(true)}>{reminderBusy ? 'Saving…' : reminder?.enabled ? 'Update reminder' : 'Save reminder'}</button>{reminder?.enabled && <button type="button" className="notification-turn-off" disabled={reminderBusy} onClick={() => void saveReminder(false)}>Turn off</button>}</div><small>Times use your device’s time zone{reminder?.enabled && reminder.timezone ? ` · ${reminder.timezone}` : ''}.</small>{reminderMessage && <p role="status" className="notification-feedback">{reminderMessage}</p>}</div>
      <div className="notification-push"><span className="notification-push-icon"><Icon name="bell" size={18}/></span><div><strong>Phone notifications</strong><p>{native ? 'Enable alerts on this phone to receive reminders when the app is closed.' : 'Open the PhysiqueQuest phone app to enable alerts on your device.'}</p>{pushMessage && <p role="status" className="notification-feedback">{pushMessage}</p>}</div>{native && <button type="button" disabled={busy} onClick={enablePush}>{busy ? 'Enabling…' : 'Enable alerts'}</button>}</div>
    </section>
  </div>;
}
