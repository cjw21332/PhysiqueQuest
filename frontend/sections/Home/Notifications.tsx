'use client';

import { useState } from 'react';
import { Icon } from './icons';

const initial = [
  { icon: 'target', title: '2 missions left', subtitle: '(unread)', body: 'Finish before midnight to keep your 12-day streak', time: '2h', unread: true, group: 'Today' },
  { icon: 'meal', title: 'Post-workout report ready', subtitle: '(unread)', body: 'Upper Body — Push · 88% form score', time: '5h', unread: true, group: 'Today' },
  { icon: 'trend', title: 'You moved up to rank 14', subtitle: '(unread)', body: 'Weekly leaderboard · friends', time: '8h', unread: true, group: 'Today' },
  { icon: 'fire', title: 'Streak penalty applied', subtitle: '', body: '−50 points · 1 strike for a missed day', time: '2d', unread: false, group: 'Earlier' },
  { icon: 'medal', title: 'New badge unlocked', subtitle: '', body: 'Form focused · 10 sessions tracked', time: '3d', unread: false, group: 'Earlier' },
];

export default function Notifications({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState(initial);
  const unread = items.filter(item => item.unread).length;

  return (
    <>
      <header className="section-page-head">
        <div className="section-back-title">
          <button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button>
          <h2>Notifications</h2>
        </div>
        <button
          className="mark-all-btn"
          onClick={() => setItems(current => current.map(item => ({ ...item, unread: false })))}
        >
          Mark all read
        </button>
      </header>

      {/* Safety Alert - Pinned */}
      <button className="safety-alert" onClick={onBack}>
        <span className="alert-icon">
          <Icon name="shield" size={20}/>
        </span>
        <div className="alert-content">
          <div className="alert-header">
            <small className="alert-badge">Safety notice · pinned</small>
          </div>
          <b className="alert-title">Emergency alert sent — Nov 14, 7:42 PM</b>
          <p className="alert-body">Maria Dela Cruz was notified. Review the flagged session.</p>
          <span className="alert-action">Review session</span>
        </div>
      </button>

      {/* Today */}
      <section className="notification-group">
        <h3>Today</h3>
        {items.filter(item => item.group === 'Today').map(item => (
          <NotificationItem
            key={item.title}
            item={item}
            onRead={() => setItems(current => current.map(entry =>
              entry.title === item.title ? { ...entry, unread: false } : entry
            ))}
          />
        ))}
      </section>

      {/* Earlier */}
      <section className="notification-group">
        <h3>Earlier</h3>
        {items.filter(item => item.group === 'Earlier').map(item => (
          <NotificationItem
            key={item.title}
            item={item}
            onRead={() => setItems(current => current.map(entry =>
              entry.title === item.title ? { ...entry, unread: false } : entry
            ))}
          />
        ))}
      </section>
    </>
  );
}

function NotificationItem({ item, onRead }: { item: typeof initial[number]; onRead: () => void }) {
  return (
    <button className={`notification-item ${item.unread ? 'unread' : ''}`} onClick={onRead}>
      <span className={`notification-icon ${item.icon}`}>
        <Icon name={item.icon} size={16}/>
      </span>
      <span className="notification-copy">
        <b>
          {item.title} {item.subtitle && <span className="subtitle-badge">{item.subtitle}</span>}
        </b>
        <small>{item.body}</small>
      </span>
      <span className="notification-time">
        {item.time}
        {item.unread && <i className="unread-dot"/>}
      </span>
    </button>
  );
}
