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
  return <div className="hm-page hm-notifications">
    <header className="hm-pagehead pq-page-heading">
      <button type="button" className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={20}/></button>
      <h2>Notifications</h2>
      <span className={`hm-pill${unread ? ' hm-tone-green' : ''}`}>{unread ? `${unread} unread` : 'All caught up'}</span>
    </header>
    <p className="hm-lede">Your activity updates and safety notices, in one place.</p>
    {(unread > 0 || remaining.length > 0) && <div className="hm-toolbar" aria-label="Notification actions">
      {unread > 0 && <button type="button" className="hm-btn hm-btn-soft hm-btn-sm" disabled={clearing} onClick={() => void markAllRead()}><Icon name="check-circle" size={16}/> Mark all read</button>}
      {remaining.length > 0 && <button type="button" className="hm-btn hm-btn-danger hm-btn-sm" disabled={clearing} onClick={() => { setClearFailed(false); setClearSelection({ ids: remaining.slice(0, 1000).map(item => item.id), hasMore: remaining.length > 1000, pinned: Boolean(safety) }); }}><Icon name="trash" size={16}/>Clear notifications</button>}
    </div>}
    {clearMessage && <p role="status" className="hm-state">{clearMessage}</p>}
    {clearSelection && <DeleteConfirmation title="Clear notifications?" description={`Remove ${clearSelection.ids.length} notification${clearSelection.ids.length === 1 ? '' : 's'}?${clearSelection.pinned ? ' Your pinned safety notice will stay.' : ''}`} confirmLabel="Clear notifications" busyLabel="Clearing…" busy={clearing} error={clearFailed ? 'Could not clear notifications. Please try again.' : undefined} onCancel={() => setClearSelection(null)} onConfirm={() => void clearRecent()}/>}
    {error && !clearFailed && <div role="alert" className="hm-state hm-state-error"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {clearFailed && !clearSelection && <p role="alert" className="hm-state hm-state-error">Could not clear notifications. Please try again.</p>}
    {loading && !items.length ? <p role="status" className="hm-state">Loading notifications…</p> : !items.length && !error ? <div className="hm-empty"><span className="hm-empty-icon"><Icon name="bell" size={26}/></span><strong>You’re all caught up</strong><p>New notifications will appear here.</p></div> : <>
      {safety && <section className="hm-safety" aria-label="Pinned safety notice">
        <span className="hm-safety-icon"><Icon name="shield" size={20}/></span>
        <div><span className="hm-eyebrow">Safety notice · pinned</span><b>{safety.title}</b><p>{safety.body}</p><span className="hm-meta">{safety.createdAt ? new Date(safety.createdAt).toLocaleDateString() : safety.time}</span>{safety.unread && <button type="button" className="hm-btn hm-btn-soft hm-btn-sm" onClick={() => void markRead(safety.id)}>Mark as read</button>}</div>
      </section>}
      {remaining.length > 0 && <section className="hm-block" aria-label="Your notifications"><div className="hm-block-head"><h3>Recent activity</h3></div><div className="hm-card hm-list">{remaining.map(item => <button type="button" className={`hm-note-row${item.unread ? ' is-unread' : ''}`} key={item.id} onClick={() => { if (item.unread) void markRead(item.id); }} aria-label={`${item.title}, ${item.body}${item.unread ? ', unread, mark as read' : ''}`}><span className={`hm-note-icon hm-kind-${item.icon}`}><Icon name={item.icon} size={18}/></span><span className="hm-note-copy"><span className="hm-note-title"><b>{item.title}</b>{item.unread && <span className="notification-unread-label hm-pill hm-tone-green">Unread</span>}</span><small>{item.body}</small><span className="hm-meta">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : item.time}</span></span></button>)}</div></section>}
    </>}
    <section className="hm-block" aria-labelledby="notification-settings-title">
      <div className="hm-block-head"><h3 id="notification-settings-title">Daily check-in</h3><span className={`hm-pill${reminder?.enabled ? ' hm-tone-green' : ''}`}>{reminder?.enabled ? 'On' : 'Off'}</span></div>
      <div className="hm-card hm-setting">
        <div className="hm-setting-head"><span className="hm-tile-icon hm-tone-violet"><Icon name="clock" size={19}/></span><p>Choose when you’d like a reminder.</p></div>
        <label htmlFor="reminder-time" className="hm-field-label">Reminder time</label>
        <div className="hm-inline-form"><input id="reminder-time" className="hm-input" type="time" value={reminderTime} onChange={event => setReminderTime(event.target.value)} disabled={reminderBusy}/><button type="button" className="hm-btn hm-btn-primary" disabled={reminderBusy} onClick={() => void saveReminder(true)}>{reminderBusy ? 'Saving…' : reminder?.enabled ? 'Update reminder' : 'Save reminder'}</button></div>
        <small className="hm-meta">Times use your device’s time zone{reminder?.enabled && reminder.timezone ? ` · ${reminder.timezone}` : ''}.</small>
        {reminder?.enabled && <button type="button" className="hm-btn hm-btn-ghost hm-btn-sm" disabled={reminderBusy} onClick={() => void saveReminder(false)}>Turn off</button>}
        {reminderMessage && <p role="status" className="hm-feedback">{reminderMessage}</p>}
      </div>
      <div className="hm-card hm-setting hm-push">
        <div className="hm-setting-head"><span className="hm-tile-icon hm-tone-sky"><Icon name="bell" size={18}/></span><div><strong>Phone notifications</strong><p>{native ? 'Enable alerts on this phone to receive reminders when the app is closed.' : 'Open the PhysiqueQuest phone app to enable alerts on your device.'}</p></div></div>
        {pushMessage && <p role="status" className="hm-feedback">{pushMessage}</p>}
        {native && <button type="button" className="hm-btn hm-btn-soft" disabled={busy} onClick={enablePush}>{busy ? 'Enabling…' : 'Enable alerts'}</button>}
      </div>
    </section>
  </div>;
}
