'use client';

import { useEffect, useState } from 'react';
import { api, type AdminAlertRow } from '../../lib/api';
import { alertLogBadge } from '../../lib/inactivityConstants.mjs';
import { Icon } from '../Home/icons';

type Range = 7 | 30 | 90;

export default function EmergencyAlertLog({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<AdminAlertRow[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getAdminAlerts(range)
      .then(data => { if (active) setRows(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load alerts.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range]);

  return (
    <section className="me-section" aria-label="Emergency alert log">
      <header className="me-header">
        <button type="button" className="coach-back" onClick={onBack} aria-label="Back to account settings"><Icon name="arrow" size={20}/></button>
        <h2>Emergency alert log</h2>
        <span className="admin-view-label">Admin view</span>
      </header>
      <div className="me-scroll">
        <div className="me-threshold" role="group" aria-label="Date range">
          {([7, 30, 90] as const).map(value => (
            <button key={value} className={range === value ? 'selected' : ''} onClick={() => setRange(value)}>{value} days</button>
          ))}
        </div>
        {loading && <p className="hint" role="status">Loading alerts...</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!loading && !error && rows?.length === 0 && <p className="hint">No emergency alerts in this range.</p>}
        {!loading && !error && rows && rows.length > 0 && (
          <ul className="emergency-log-list">
            {rows.map(row => (
              <li key={row.id} className="emergency-log-row">
                <span>
                  <b>{new Date(row.occurredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b>
                  <small>{row.userName} · {row.exerciseId ?? 'Workout'} · {row.locationShared ? 'location shared' : 'no location'}</small>
                </span>
                <span className={`alarm-badge ${row.status}`}>{alertLogBadge(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
