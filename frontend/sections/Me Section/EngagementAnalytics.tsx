'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';

type Range = '7 days' | '30 days' | '90 days';

const rangeData: Record<Range, { users: string; change: string; sessions: string; form: string; missions: string; bars: number[] }> = {
  '7 days': { users: '428', change: '+3.4%', sessions: '86', form: '82%', missions: '63%', bars: [48, 54, 52, 66, 70, 77, 75, 88] },
  '30 days': { users: '1,284', change: '+8.2%', sessions: '312', form: '84%', missions: '67%', bars: [52, 60, 57, 68, 74, 82, 79, 94] },
  '90 days': { users: '3,691', change: '+12.6%', sessions: '946', form: '86%', missions: '71%', bars: [46, 55, 61, 59, 72, 77, 85, 96] },
};

const emergencyEvents = [
  { title: 'Triggered alarms', detail: 'Last 30 days', value: '14' },
  { title: 'Cancelled in countdown', detail: 'False positives', value: '9' },
  { title: 'Contact notified', detail: 'Alert delivered', value: '5' },
];

export default function EngagementAnalytics({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<Range>('30 days');
  const metrics = rangeData[range];

  function exportEvents() {
    const rows = [['Event', 'Detail', 'Count'], ...emergencyEvents.map((event) => [event.title, event.detail, event.value])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `physiquequest-sample-emergency-events-${range.replace(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="me-section admin-tools-screen" aria-label="Admin engagement analytics">
      <header className="admin-tools-header">
        <button className="coach-back" onClick={onBack} aria-label="Back to account settings"><Icon name="arrow" size={24} /></button>
        <h2>Admin · Engagement</h2>
      </header>

      <div className="admin-tools-scroll engagement-scroll">
        <div className="engagement-ranges" role="group" aria-label="Analytics date range">
          {(['7 days', '30 days', '90 days'] as Range[]).map((option) => (
            <button key={option} className={range === option ? 'active' : ''} aria-pressed={range === option} onClick={() => setRange(option)}>{option}</button>
          ))}
        </div>

        <section className="engagement-active-users">
          <small>Active users <span>Sample data</span></small>
          <strong>{metrics.users}</strong>
          <p><Icon name="trend" size={13} /> {metrics.change} vs previous {range}</p>
        </section>

        <div className="engagement-stat-grid">
          <div><b>{metrics.sessions}</b><small>Sessions today</small></div>
          <div><b>{metrics.form}</b><small>Avg form score</small></div>
          <div><b>{metrics.missions}</b><small>Mission completion</small></div>
        </div>

        <section className="engagement-retention">
          <div className="engagement-section-head"><h3>Weekly retention</h3><small>% returning</small></div>
          <div className="retention-chart" role="img" aria-label={`Weekly retention, ${range}: ${metrics.bars.map((value) => `${value}%`).join(', ')}`}>
            {metrics.bars.map((value, index) => (
              <div className="retention-bar-column" key={`${range}-${index}`}>
                <i className={index === metrics.bars.length - 1 ? 'latest' : ''} style={{ height: `${value}%` }} />
                <small>{index === 0 ? 'W1' : index === metrics.bars.length - 1 ? `W${range === '7 days' ? '1' : range === '30 days' ? '8' : '12'}` : ''}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="engagement-emergency">
          <div className="engagement-section-head">
            <h3>Emergency events</h3>
            <button onClick={exportEvents}><Icon name="download" size={14} /> Export</button>
          </div>
          <div className="emergency-event-list">
            {emergencyEvents.map((event) => (
              <div className="emergency-event-row" key={event.title}>
                <span><b>{event.title}</b><small>{event.detail}</small></span>
                <strong>{event.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
