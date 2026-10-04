'use client';

import { useNotifications, type AppNotification } from '../../hooks/useNotifications';
import { Icon } from './icons';

export default function Notifications({ onBack }: { onBack: () => void }) {
  const { items, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const groups = [...new Set(items.map(item => item.group || 'Earlier'))];
  const unread = items.filter(item => item.unread).length;

  return <>
    <header className="section-page-head">
      <div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Notifications</h2></div>
      {unread > 0 && <button className="mark-all-btn" onClick={() => void markAllRead()}>Mark all read</button>}
    </header>
    {error && <div role="alert" className="scan-warning"><p>{error}</p><button onClick={() => void refresh()}>Try again</button></div>}
    {loading ? <p role="status">Loading notifications…</p> : items.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : groups.map(group => (
      <section className="notification-group" key={group}>
        <h3>{group}</h3>
        {items.filter(item => (item.group || 'Earlier') === group).map(item => <NotificationItem key={item.id} item={item} onRead={() => item.unread && void markRead(item.id)}/>)}
      </section>
    ))}
  </>;
}

function NotificationItem({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  return <button className={`notification-item ${item.unread ? 'unread' : ''}`} onClick={onRead} aria-label={`${item.title}${item.unread ? ', unread' : ''}`}>
    <span className={`notification-icon ${item.icon}`}><Icon name={item.icon} size={16}/></span>
    <span className="notification-copy"><b>{item.title} {item.subtitle && <span className="subtitle-badge">{item.subtitle}</span>}</b><small>{item.body}</small></span>
    <span className="notification-time">{item.time}{item.unread && <i className="unread-dot"/>}</span>
  </button>;
}
