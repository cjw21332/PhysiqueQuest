'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AdminAnalyticsRecord } from '../../lib/api';
import { Icon } from '../Home/icons';

type Range = 7 | 30 | 90;
export default function EngagementAnalytics({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AdminAnalyticsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api.getAdminAnalytics(range)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load analytics.'); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { void refresh(); }, [refresh]);
  const exportEvents = () => {
    if (!data) return;
    const rows = [['Event', 'Count'], ['Total alerts', String(data.emergencyEvents.total)], ['Delivered', String(data.emergencyEvents.delivered)], ['Failed', String(data.emergencyEvents.failed)], ['Pending', String(data.emergencyEvents.pending)]];
    const csv = rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `physiquequest-emergency-events-${range}-days.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const unavailable = <span>Unavailable</span>;

  return <section className="me-section admin-tools-screen" aria-label="Admin engagement analytics">
    <header className="admin-tools-header"><button className="coach-back" onClick={onBack} aria-label="Back to account settings"><Icon name="arrow" size={24}/></button><h2>Admin · Engagement</h2></header>
    <div className="admin-tools-scroll engagement-scroll">
      <div className="engagement-ranges" role="group" aria-label="Analytics date range">{([7, 30, 90] as Range[]).map(days => <button key={days} className={range === days ? 'active' : ''} aria-pressed={range === days} onClick={() => setRange(days)}>{days} days</button>)}</div>
      {error && <div role="alert" className="scan-warning">{error}<button onClick={() => void refresh()}>Try again</button></div>}
      {loading ? <p role="status">Loading analytics…</p> : data && <>
        <section className="engagement-active-users"><small>Registered accounts</small><strong>{data.usersTotal}</strong><p>Active-user history is unavailable because sign-in events are not stored.</p></section>
        <div className="engagement-stat-grid"><div><b>{data.completedSessions}</b><small>Completed workouts in range</small></div><div><b>{data.formScore ?? unavailable}</b><small>Average form score</small></div><div><b>{data.missionCompletion ?? unavailable}</b><small>Mission completion</small></div></div>
        <section className="engagement-retention"><div className="engagement-section-head"><h3>Weekly retention</h3><small>{data.weeklyRetention ? 'From saved activity' : 'Unavailable'}</small></div>{data.weeklyRetention ? <div className="retention-chart" role="img" aria-label={`Weekly retention: ${data.weeklyRetention.join(', ')}`}>{data.weeklyRetention.map((value, index) => <div className="retention-bar-column" key={index}><i style={{ height: `${value}%` }}/><small>{value}%</small></div>)}</div> : <p>Retention analytics are unavailable until sign-in history is collected.</p>}</section>
        <section className="engagement-emergency"><div className="engagement-section-head"><h3>Safety alert events</h3><button onClick={exportEvents} disabled={!data}><Icon name="download" size={14}/> Export returned data</button></div><div className="emergency-event-list">{[['Total alerts', data.emergencyEvents.total], ['Provider confirmed', data.emergencyEvents.delivered], ['Not delivered', data.emergencyEvents.failed], ['Pending', data.emergencyEvents.pending]].map(([label, count]) => <div className="emergency-event-row" key={label}><span><b>{label}</b><small>Last {range} days</small></span><strong>{count}</strong></div>)}</div></section>
        <small>Updated {new Date(data.generatedAt).toLocaleString()}</small>
      </>}
    </div>
  </section>;
}
