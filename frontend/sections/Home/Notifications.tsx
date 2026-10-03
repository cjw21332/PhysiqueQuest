'use client';

import { Icon } from './icons';
import { useNotifications, type AppNotification } from '../../hooks/useNotifications';

export default function Notifications({ onBack }: { onBack: () => void }) {
  const { items, loading, error, markRead, markAllRead } = useNotifications();
  const unread = items.filter(item => item.unread).length;
  return <>
    <header className="section-page-head"><div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Notifications</h2></div><button className="mark-all-btn" disabled={!unread} onClick={() => void markAllRead()}>Mark all read</button></header>
    {loading && <p className="hint">Loading notifications…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!loading && !error && items.length === 0 && <p className="hint">You’re all caught up. New activity will appear here.</p>}
    {['Today', 'Earlier'].map(group => <section className="notification-group" key={group}><h3>{group}</h3>{items.filter(item => item.group === group).map(item => <NotificationItem key={item.id} item={item} onRead={() => void markRead(item.id)} />)}</section>)}
  </>;
}

function NotificationItem({ item, onRead }: { item: AppNotification; onRead: () => void }) {
  return <button className={`notification-item ${item.unread ? 'unread' : ''}`} onClick={onRead}><span className={`notification-icon ${item.icon}`}><Icon name={item.icon} size={16}/></span><span className="notification-copy"><b>{item.title} {item.subtitle && <span className="subtitle-badge">{item.subtitle}</span>}</b><small>{item.body}</small></span><span className="notification-time">{item.time}{item.unread && <i className="unread-dot"/>}</span></button>;
}
