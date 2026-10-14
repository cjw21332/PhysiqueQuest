'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AdminAnalyticsRecord } from '../../lib/api';
import { Icon } from '../Home/icons';
import { analyticsPreview, analyticsCsv } from './adminPreview';

type Range = 7 | 30 | 90;
export default function EngagementAnalytics({ onBack, preview = false }: { onBack: () => void; preview?: boolean }) {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AdminAnalyticsRecord | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (preview) return;
    setLoading(true); setError('');
    try { setData(await api.getAdminAnalytics(range)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load analytics.'); }
    finally { setLoading(false); }
  }, [range, preview]);
  useEffect(() => { void refresh(); }, [refresh]);
  const sample = preview ? analyticsPreview(range) : null;
  const shown = sample ?? data;
  const eventRows: [string, string, number][] = sample ? [['Triggered alarms', `Last ${range} days`, sample.emergencyEvents.total], ['Cancelled in countdown', 'False positives', sample.cancelled], ['Contact notified', 'Alert delivered', sample.emergencyEvents.delivered]] : data ? [['Triggered alarms', `Last ${range} days`, data.emergencyEvents.total], ['Contact notified', 'Provider confirmed', data.emergencyEvents.delivered], ['Not delivered', `Last ${range} days`, data.emergencyEvents.failed], ['Pending', `Last ${range} days`, data.emergencyEvents.pending]] : [];
  const exportEvents = () => {
    if (!shown) return;
    const csv = analyticsCsv([['Event', 'Count'], ...eventRows.map(([label, , count]) => [label, count])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `physiquequest-${preview ? 'sample-' : ''}emergency-events-${range}-days.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="me-section admin-tools-screen admin-reference" aria-label="Admin engagement analytics">
    <header className="admin-tools-header"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to account settings"><Icon name="arrow" size={20}/></button><h2>Admin · Engagement</h2></header>
    <div className="admin-tools-scroll engagement-scroll">
      <div className="engagement-ranges" role="group" aria-label="Analytics date range">{([7, 30, 90] as Range[]).map(days => <button type="button" key={days} className={range === days ? 'active' : ''} aria-pressed={range === days} onClick={() => setRange(days)}>{days} days</button>)}</div>
      {error && <div role="alert" className="error">{error}<button type="button" className="scan-retry" onClick={() => void refresh()}>Try again</button></div>}
      {loading ? <p role="status">Loading analytics…</p> : shown && <>
        <section className="engagement-active-users"><small>Active users {preview && <span>· sample data</span>}</small><strong>{shown.activeUsers?.toLocaleString() ?? 'Unavailable'}</strong>{sample && <p><Icon name="trend" size={14}/> +{sample.growth}% vs previous {range} days</p>}</section>
        <div className="engagement-stat-grid"><div><b>{sample ? sample.sessionsToday : shown.completedSessions}</b><small>{sample ? 'Sessions today' : 'Completed sessions'}</small></div><div><b>{shown.formScore === null ? 'Unavailable' : `${shown.formScore}%`}</b><small>Avg form score</small></div><div><b>{shown.missionCompletion === null ? 'Unavailable' : `${shown.missionCompletion}%`}</b><small>Mission completion</small></div></div>
        <section className="engagement-retention"><div className="engagement-section-head"><h3>Weekly retention</h3><small>% returning</small></div>{shown.weeklyRetention ? <><div className="retention-chart" role="img" aria-label={`Weekly retention: ${shown.weeklyRetention.join(', ')} percent`}>{shown.weeklyRetention.map((value, index) => <div className="retention-bar-column" key={index}><i className={index === shown.weeklyRetention!.length - 1 ? 'latest' : ''} style={{ height: `${Math.min(100, Math.max(0, value))}%` }}/></div>)}</div><div className="retention-axis"><small>W1</small><small>W{shown.weeklyRetention.length}</small></div></> : <p>Retention data is unavailable.</p>}</section>
        <section className="engagement-emergency"><div className="engagement-section-head"><h3>Emergency events</h3><button type="button" onClick={exportEvents}><Icon name="download" size={15}/> Export</button></div><div className="emergency-event-list">{eventRows.map(([label, detail, count]) => <div className="emergency-event-row" key={label}><span><b>{label}</b><small>{detail}</small></span><strong>{count}</strong></div>)}</div></section>
      </>}
    </div>
  </section>;
}
