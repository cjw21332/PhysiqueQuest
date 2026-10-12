'use client';

import { useNotifications, type AppNotification } from '../../hooks/useNotifications';
import { Icon } from './icons';

export default function Notifications({ onBack }: { onBack: () => void }) {
  const { items, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const pinnedSafety = items.find(item =>
    item.icon === 'shield' || /(safety|emergency alert)/i.test(item.title),
  );
  const visibleItems = items.filter(item => item.id !== pinnedSafety?.id);
  const groups = [...new Set(visibleItems.map(item => item.group || 'Earlier'))];
  const orderedGroups = [
    ...['Today'].filter(group => groups.includes(group)),
    ...groups.filter(group => group !== 'Today' && group !== 'Earlier'),
    ...['Earlier'].filter(group => groups.includes(group)),
  ];
  const unread = items.filter(item => item.unread).length;

  return <div className="home-notifications">
    <header className="section-page-head home-notifications-head">
      <div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Notifications</h2></div>
      {unread > 0 && <button type="button" className="mark-all-btn" onClick={() => void markAllRead()}>Mark all read</button>}
    </header>
    {error && <div role="alert" className="scan-warning"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {loading ? <p role="status" className="notifications-state">Loading notifications…</p> : items.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : <>
      {pinnedSafety && <SafetyNotification item={pinnedSafety} onRead={() => pinnedSafety.unread && void markRead(pinnedSafety.id)}/>}
      {orderedGroups.map(group => (
        <section className="notification-group" key={group} aria-label={`${group} notifications`}>
          <h3>{group}</h3>
          {visibleItems.filter(item => (item.group || 'Earlier') === group).map(item => <NotificationItem key={item.id} item={item} onRead={() => item.unread && void markRead(item.id)}/>)}
        </section>
      ))}
    </>}
  </div>;
}

function NotificationItem({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  return <button type="button" className={`notification-item ${item.unread ? 'unread' : ''}`} onClick={onRead} aria-label={`${item.title}${item.unread ? ', unread' : ''}`}>
    <span className={`notification-icon ${item.icon}`}><Icon name={item.icon} size={16}/></span>
    <span className="notification-copy"><b>{item.title}{item.unread && <span className="notification-unread-label"> (unread)</span>} {item.subtitle && <span className="subtitle-badge">{item.subtitle}</span>}</b><small>{item.body}</small></span>
    <span className="notification-time">{item.time}{item.unread && <i className="unread-dot"/>}</span>
  </button>;
}

function SafetyNotification({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  return <section className="safety-alert notification-safety-card" aria-label="Pinned safety notice">
    <span className="alert-icon"><Icon name="shield" size={18}/></span>
    <div className="alert-content">
      <span className="alert-badge">Safety notice · pinned</span>
      <b className="alert-title">{item.title}</b>
      <p className="alert-body">{item.body}</p>
      {item.unread && <button type="button" className="alert-action" onClick={onRead}>Mark as read</button>}
    </div>
    <span className="notification-time">{item.time}{item.unread && <i className="unread-dot"/>}</span>
  </section>;
}
