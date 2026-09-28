'use client';

import { useState } from 'react';
import { Icon } from './icons';
const initial = [
  { icon: 'target', title: '2 missions left (unread)', body: 'Finish before midnight to keep your day streak', time: '2h', unread: true },
  { icon: 'meal', title: 'Post-workout report ready (unread)', body: 'Upper Body — Push · 88% form score', time: '5h', unread: true },
  { icon: 'trend', title: 'You moved up to rank 14 (unread)', body: 'Weekly leaderboard · friends', time: '8h', unread: true },
  { icon: 'fire', title: 'Streak penalty applied', body: '−50 points · 1 strike for a missed day', time: '2d', unread: false },
  { icon: 'medal', title: 'New badge unlocked', body: 'Form focused · 10 sessions tracked', time: '3d', unread: false },
];
export default function Notifications({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState(initial);
  const unread = items.filter(item => item.unread).length;
  return <><header className="section-page-head"><h2>Notifications</h2><button className="quiet-link" onClick={() => setItems(current => current.map(item => ({ ...item, unread: false })))}>{unread ? 'Mark all read' : 'All read'}</button></header><button className="safety-alert" onClick={onBack}><span className="safety-icon"><Icon name="shield"/></span><div><small>Safety notice · pinned</small><b>Emergency alert sent — Nov 14, 7:42 PM</b><p>Maria Dela Cruz was notified. Review the flagged session.</p><span className="review-pill">Review session</span></div></button><section className="notification-group"><h3>Today</h3>{items.slice(0,3).map(item => <NotificationItem key={item.title} item={item} onRead={() => setItems(current => current.map(entry => entry.title === item.title ? { ...entry, unread: false } : entry))}/>)}</section><section className="notification-group"><h3>Earlier</h3>{items.slice(3).map(item => <NotificationItem key={item.title} item={item} onRead={() => setItems(current => current.map(entry => entry.title === item.title ? { ...entry, unread: false } : entry))}/>)}</section></>;
}
function NotificationItem({ item, onRead }: { item: typeof initial[number]; onRead: () => void }) { return <button className="notification-item" onClick={onRead}><span className={`notification-icon ${item.unread?'unread':''}`}><Icon name={item.icon} size={16}/></span><span className="notification-copy"><b>{item.title}</b><small>{item.body}</small></span><span className="notification-time">{item.time}{item.unread && <i/>}</span></button>; }
