'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type AdminAnalyticsRecord } from '../../lib/api';
import { Card, Icon, PageHeader, Segmented, Stat, State, formatDate, useAdminData } from './ui';

// Old dashboard links used ?view=; send them to the matching page.
const legacyViews: Record<string, string> = { users: '/admin/users', feedback: '/admin/feedback', exercises: '/admin/exercises', foods: '/admin/food', pose: '/admin/pose-tracker', audit: '/admin/audit' };
const series = [['activeUsers', 'Active users', 'cyan'], ['newUsers', 'New users', 'accent'], ['workouts', 'Workouts', 'violet']] as const;

export default function Overview() {
  const router = useRouter();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, error, loading, reload } = useAdminData(() => api.getAdminAnalytics(Number(days) as 7 | 30 | 90), [days]);
  useEffect(() => { const view = new URLSearchParams(window.location.search).get('view'); if (view && legacyViews[view]) router.replace(legacyViews[view]); }, [router]);
  const feedback = data?.appFeedback;
  const alerts = data?.emergencyEvents;

  return <main className="adm-page">
    <PageHeader eyebrow="Monitor" title="Overview" subtitle="Community size, activity and what needs your attention.">
      <Segmented label="Period" value={days} onChange={setDays} options={[['7', '7 days'], ['30', '30 days'], ['90', '90 days']]} />
      <button type="button" className="adm-btn adm-btn-ghost" onClick={reload} disabled={loading}><Icon name="refresh" size={16} />Refresh</button>
    </PageHeader>
    <State loading={loading && !data} error={error} onRetry={reload}>
      {data && <>
        <div className="adm-stats">
          <Stat label="Total users" value={data.usersTotal.toLocaleString()} note="Active accounts, all time" />
          <Stat label="New users" value={(data.newUsers ?? 0).toLocaleString()} note={`Joined in the last ${days} days`} tone="accent" />
          <Stat label="Active users" value={data.activeUsers?.toLocaleString() ?? '—'} note="Signed in during the period" tone="cyan" />
          <Stat label="Completed workouts" value={data.completedSessions.toLocaleString()} note="Finished sessions in the period" tone="violet" />
          <Stat label="App feedback" value={feedback ? feedback.count.toLocaleString() : '—'} note={feedback ? `${feedback.pending ?? 0} open · avg ${feedback.averageRating ?? '—'}/5` : 'Unavailable'} tone="amber" />
        </div>

        <div className="adm-grid adm-grid-main">
          <Card eyebrow="Activity" title="Daily trend" className="adm-span-2" action={<ul className="adm-legend">{series.map(([key, label, tone]) => <li key={key}><i className={`tone-${tone}`} />{label}</li>)}</ul>}>
            {data.trend?.length ? <TrendChart trend={data.trend} /> : <div className="adm-state">Daily trend becomes available after the latest API update is deployed.</div>}
          </Card>
          <Card eyebrow="Retention" title="Week-over-week return">
            <Retention values={data.weeklyRetention} />
            <p className="adm-footnote">Share of users active in one week who signed in again the next week.</p>
          </Card>
        </div>

        <div className="adm-grid adm-grid-main">
          <Card eyebrow="Community" title="Latest feedback" className="adm-span-2" action={<Link className="adm-link" href="/admin/feedback">Open inbox <Icon name="arrow" size={14} /></Link>}>
            {feedback?.recent.length ? <ul className="adm-feed">
              {feedback.recent.slice(0, 5).map((row, index) => <li key={index}>
                <span className={`adm-chip cat-${row.category}`}>{row.category}</span>
                <p>{row.message}</p>
                <span className="adm-feed-meta"><span aria-label={`${row.rating} out of 5`}>{'★'.repeat(row.rating)}<span className="adm-dim">{'★'.repeat(Math.max(0, 5 - row.rating))}</span></span> · {row.platform ?? 'unknown'} · {formatDate(row.createdAt)}</span>
              </li>)}
            </ul> : <div className="adm-state">No feedback in this period.</div>}
          </Card>
          <Card eyebrow="Needs attention" title="Action items">
            <ul className="adm-actions">
              <ActionItem href="/admin/feedback" icon="inbox" label="Open feedback reports" value={feedback?.pending ?? '—'} />
              <ActionItem href="/admin/audit" icon="alert" label="Safety alerts failed or pending" value={alerts ? alerts.failed + alerts.pending : '—'} />
              <ActionItem href="/admin/pose-tracker/references" icon="target" label="Review exercise references" value="Open" />
            </ul>
            {alerts && <p className="adm-footnote">{alerts.total} safety alerts in the period · {alerts.delivered} delivered.</p>}
          </Card>
        </div>
        <p className="adm-footnote">Active users are distinct recorded sign-ins; offline use counts only after it syncs. Days use UTC. Updated {formatDate(data.generatedAt, true)}.</p>
      </>}
    </State>
  </main>;
}

function ActionItem({ href, icon, label, value }: { href: string; icon: string; label: string; value: number | string }) {
  return <li><Link href={href}><span className="adm-actions-icon"><Icon name={icon} /></span><span>{label}</span><strong>{value}</strong></Link></li>;
}

function TrendChart({ trend }: { trend: NonNullable<AdminAnalyticsRecord['trend']> }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720, height = 220, pad = 28;
  const max = Math.max(1, ...trend.flatMap(day => series.map(([key]) => day[key])));
  const x = (index: number) => pad + (index * (width - pad * 2)) / Math.max(1, trend.length - 1);
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const slot = (width - pad * 2) / trend.length;
  const point = hover === null ? null : trend[hover];
  const totals = series.map(([key, label]) => `${trend.reduce((sum, day) => sum + day[key], 0)} ${label.toLowerCase()}`).join(', ');
  return <div className="adm-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily trend from ${trend[0].date} to ${trend[trend.length - 1].date}: ${totals}.`} onPointerLeave={event => { if (event.pointerType === 'mouse') setHover(null); }}>
      {[0, 0.5, 1].map(step => <g key={step}><line x1={pad} x2={width - pad} y1={y(max * step)} y2={y(max * step)} className="adm-chart-grid" /><text x={pad - 8} y={y(max * step) + 4} className="adm-chart-axis" textAnchor="end">{Math.round(max * step)}</text></g>)}
      {series.map(([key, , tone]) => <polyline key={key} className={`adm-chart-line tone-${tone}`} points={trend.map((day, index) => `${x(index)},${y(day[key])}`).join(' ')} />)}
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad} y2={height - pad} className="adm-chart-cursor" />}
      {trend.map((day, index) => <rect key={day.date} x={x(index) - slot / 2} y={pad} width={slot} height={height - pad * 2} fill="transparent" onPointerEnter={() => setHover(index)} onPointerDown={() => setHover(index)} />)}
      {[...new Set([0, Math.floor((trend.length - 1) / 2), trend.length - 1])].map(index => <text key={index} x={x(index)} y={height - 6} className="adm-chart-axis" textAnchor="middle">{trend[index].date.slice(5)}</text>)}
    </svg>
    {point && hover !== null && <div className="adm-chart-tip" style={{ left: `${(x(hover) / width) * 100}%` }}><strong>{point.date}</strong>{series.map(([key, label, tone]) => <span key={key}><i className={`tone-${tone}`} />{label}: {point[key]}</span>)}</div>}
  </div>;
}

function Retention({ values }: { values: number[] | null }) {
  if (!values?.length) return <div className="adm-state">Needs at least two weeks of sign-ins. Pick 30 or 90 days.</div>;
  return <div className="adm-retention" role="img" aria-label={`Weekly return rates: ${values.map(v => `${v}%`).join(', ')}`}>
    {values.map((value, index) => <div key={index} className="adm-retention-col"><span className="adm-retention-value">{value}%</span><span className="adm-retention-bar"><span style={{ height: `${Math.max(2, value)}%` }} /></span><span className="adm-retention-label">W{index + 2}</span></div>)}
  </div>;
}
