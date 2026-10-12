'use client';

import { useState } from 'react';
import { useNotifications, type AppNotification } from '../../hooks/useNotifications';
import { Icon } from './icons';

const sampleNotifications: AppNotification[] = [
  {
    id: 'sample-safety-alert',
    icon: 'shield',
    title: 'Emergency alert sent — Nov 14, 7:42 PM',
    subtitle: '',
    body: 'Maria Dela Cruz was notified. Review the flagged session.',
    time: 'now',
    unread: true,
    group: 'Earlier',
  },
  {
    id: 'sample-missions',
    icon: 'target',
    title: '2 missions left',
    subtitle: '',
    body: 'Finish before midnight to keep your 12-day streak',
    time: '2h',
    unread: true,
    group: 'Today',
  },
  {
    id: 'sample-workout-report',
    icon: 'clipboard',
    title: 'Post-workout report ready',
    subtitle: '',
    body: 'Upper Body — Push · 88% form score',
    time: '5h',
    unread: true,
    group: 'Today',
  },
  {
    id: 'sample-streak-penalty',
    icon: 'minus-circle',
    title: 'Streak penalty applied',
    subtitle: '',
    body: '−50 points · 1 strike for a missed day',
    time: '2d',
    unread: false,
    group: 'Earlier',
  },
  {
    id: 'sample-new-badge',
    icon: 'medal',
    title: 'New badge unlocked',
    subtitle: '',
    body: 'A new badge is waiting in your collection.',
    time: '3d',
    unread: false,
    group: 'Earlier',
  },
];

export default function Notifications({ onBack }: { onBack: () => void }) {
  const { items, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [sampleItems, setSampleItems] = useState(sampleNotifications);
  const [sampleReviewMessage, setSampleReviewMessage] = useState('');
  const showingSamples = !loading && !error && items.length === 0;
  const displayedItems = showingSamples ? sampleItems : items;
  const pinnedSafety = displayedItems.find(item =>
    item.icon === 'shield' || /(safety|emergency alert)/i.test(item.title),
  );
  const visibleItems = displayedItems.filter(item => item.id !== pinnedSafety?.id);
  const groups = [...new Set(visibleItems.map(item => item.group || 'Earlier'))];
  const orderedGroups = [
    ...['Today'].filter(group => groups.includes(group)),
    ...groups.filter(group => group !== 'Today' && group !== 'Earlier'),
    ...['Earlier'].filter(group => groups.includes(group)),
  ];
  const unread = displayedItems.filter(item => item.unread).length;
  const markItemRead = (item: AppNotification) => {
    if (!item.unread) return;
    if (showingSamples) {
      setSampleItems(current => current.map(sample =>
        sample.id === item.id ? { ...sample, unread: false } : sample,
      ));
      return;
    }
    void markRead(item.id);
  };
  const markAllItemsRead = () => {
    if (showingSamples) {
      setSampleItems(current => current.map(sample => ({ ...sample, unread: false })));
      return;
    }
    void markAllRead();
  };

  return <div className="home-notifications">
    <header className="section-page-head home-notifications-head">
      <div className="section-back-title"><button className="coach-back" onClick={onBack} aria-label="Back to Home"><Icon name="arrow" size={24}/></button><h2>Notifications</h2></div>
      {unread > 0 && <button type="button" className="mark-all-btn" onClick={markAllItemsRead}>Mark all read</button>}
    </header>
    {error && <div role="alert" className="scan-warning"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {loading ? <p role="status" className="notifications-state">Loading notifications…</p> : <>
      {showingSamples && <p className="notification-preview-note">Sample notifications · live notifications will replace this preview.</p>}
      {pinnedSafety && <SafetyNotification
        item={pinnedSafety}
        isSample={showingSamples}
        reviewMessage={sampleReviewMessage}
        onReviewSample={() => setSampleReviewMessage('This sample alert is not linked to a real session.')}
        onRead={() => markItemRead(pinnedSafety)}
      />}
      {orderedGroups.map(group => (
        <section className="notification-group" key={group} aria-label={`${group} notifications`}>
          <h3>{group}</h3>
          {visibleItems.filter(item => (item.group || 'Earlier') === group).map(item => <NotificationItem key={item.id} item={item} onRead={() => markItemRead(item)}/>)}
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

function SafetyNotification({
  item,
  isSample,
  reviewMessage,
  onReviewSample,
  onRead,
}: {
  item: AppNotification;
  isSample: boolean;
  reviewMessage: string;
  onReviewSample: () => void;
  onRead: () => void;
}) {
  return <section className="safety-alert notification-safety-card" aria-label="Pinned safety notice">
    <span className="alert-icon"><Icon name="shield" size={18}/></span>
    <div className="alert-content">
      <span className="alert-badge">Safety notice · pinned</span>
      <b className="alert-title">{item.title}</b>
      <p className="alert-body">{item.body}</p>
      {isSample
        ? <button type="button" className="alert-action" onClick={onReviewSample}>Review session</button>
        : item.unread && <button type="button" className="alert-action" onClick={onRead}>Mark as read</button>}
      {reviewMessage && <p className="notification-sample-message" role="status">{reviewMessage}</p>}
    </div>
    <span className="notification-time">{item.time}{item.unread && <i className="unread-dot"/>}</span>
  </section>;
}
