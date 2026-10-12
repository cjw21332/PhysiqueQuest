'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { COUNTDOWN_SECONDS, HOLD_TO_STOP_MS, alertStatusText } from '../../lib/inactivityConstants.mjs';
import { api, type AdminAlertRow } from '../../lib/api';

export function InactivityCountdown({
  remainingSeconds,
  thresholdSeconds,
  exerciseName,
  contactName,
  onImOkay,
}: {
  remainingSeconds: number;
  thresholdSeconds: number;
  exerciseName: string;
  contactName: string;
  onImOkay: () => void;
}) {
  const progress = Math.max(0, Math.min(1, remainingSeconds / COUNTDOWN_SECONDS));
  const radius = 92;
  const circumference = 2 * Math.PI * radius;

  return (
    <section className="inactivity-view inactivity-countdown" aria-label="Inactivity countdown">
      <div className="inactivity-ring" role="timer" aria-live="off">
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#f2d4d1" strokeWidth="14" />
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="#D92D20"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div className="inactivity-ring-label">
          <b>{remainingSeconds}</b>
          <span>seconds</span>
        </div>
      </div>
      <h2 className="inactivity-kicker">Emergency check</h2>
      <h3 className="inactivity-question">Are you okay?</h3>
      <p className="inactivity-copy">No movement detected for {thresholdSeconds} seconds during your {exerciseName}.</p>
      <div className="inactivity-notice">
        <Icon name="bell" size={18} />
        <p>
          When the countdown ends, an alarm sounds and we try to alert <b>{contactName || 'your emergency contact'}</b>. Location is included only when available.
        </p>
      </div>
      <button type="button" className="inactivity-ok" onClick={onImOkay}>I'm okay</button>
      <p className="inactivity-footnote">Also cancels automatically if movement is detected</p>
    </section>
  );
}

export function EmergencyAlarm({
  exerciseName,
  recordedAt,
  contactName,
  contactPhone,
  status,
  errorCode,
  locationShared,
  resolved,
  canViewAdmin,
  adminAccessError,
  stopError,
  finishing,
  stopping,
  onHoldComplete,
  onFinishSession,
}: {
  exerciseName: string;
  recordedAt: string;
  contactName: string;
  contactPhone: string;
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  errorCode?: string;
  locationShared: boolean;
  resolved: boolean;
  canViewAdmin: boolean;
  adminAccessError: string;
  stopError: string;
  finishing: boolean;
  stopping: boolean;
  onHoldComplete: () => void;
  onFinishSession: () => Promise<void>;
}) {
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const tick = (now: number) => {
    if (holdStart.current === null) return;
    const elapsed = now - holdStart.current;
    const ratio = Math.min(1, elapsed / HOLD_TO_STOP_MS);
    setHoldProgress(ratio);
    if (ratio >= 1) {
      holdStart.current = null;
      frame.current = null;
      onHoldComplete();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };

  const beginHold = () => {
    if (resolved || holdStart.current !== null) return;
    holdStart.current = performance.now();
    frame.current = requestAnimationFrame(tick);
  };
  const cancelHold = () => {
    holdStart.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setHoldProgress(0);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) beginHold();
  };
  const onKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') cancelHold();
  };

  const [recentAlerts, setRecentAlerts] = useState<AdminAlertRow[] | null>(null);
  const [logError, setLogError] = useState('');

  useEffect(() => {
    if (!canViewAdmin) return;
    let active = true;
    setRecentAlerts(null);
    setLogError('');
    api.getAdminAlerts(30)
      .then(rows => { if (active) setRecentAlerts(rows.slice(0, 2)); })
      .catch(error => {
        if (active) setLogError(error instanceof Error ? error.message : 'Could not load the alert log.');
      });
    return () => { active = false; };
  }, [canViewAdmin, resolved, status]);

  return (
    <section className="inactivity-view emergency-alarm" aria-label="Emergency alarm">
      <div className="alarm-bell" aria-hidden="true"><Icon name="bell" size={36} /></div>
      <p className="alarm-state">{resolved ? 'Alarm stopped' : 'Alarm active · current phone volume'}</p>
      <h2 className="alarm-title">Emergency detected</h2>
      <p className="alarm-copy">
        {resolved ? 'Session ended and flagged.' : 'Hold the stop control for 3 seconds to end the alarm.'} Recorded at {recordedAt} during your {exerciseName}.
      </p>
      <div className="alarm-card">
        <div className="alarm-card-head">
          <span>{status === 'delivered' ? 'Alert sent to' : status === 'failed' ? 'Alert not delivered to' : status === 'cancelled' ? 'Alert not sent to' : 'Sending alert to'}</span>
          <span className={`alarm-badge ${status}`} role="status">{alertStatusText(status, errorCode)}</span>
        </div>
        <b className="alarm-contact">{contactName || 'No contact saved'}</b>
        <small>{contactPhone || 'No phone number saved'} · {locationShared ? 'location shared' : 'Location unavailable'}</small>
      </div>
      {stopError && <p className="alarm-error" role="alert">{stopError}</p>}
      {adminAccessError && <p className="alarm-error" role="alert">{adminAccessError}</p>}
      {!resolved && (
        <button
          type="button"
          className="alarm-hold"
          disabled={stopping}
          aria-describedby="alarm-hold-help"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={cancelHold}
        >
          <span className="alarm-hold-fill" style={{ transform: `scaleX(${holdProgress})` }} aria-hidden="true" />
          <span className="alarm-hold-label">{stopping ? 'Stopping alarm…' : 'Hold to stop alarm'}</span>
        </button>
      )}
      {!resolved && <p id="alarm-hold-help" className="alarm-hint">Hold for 3 seconds — prevents accidental dismissal</p>}
      {resolved && (
        <button type="button" className="alarm-finish" disabled={finishing} onClick={() => void onFinishSession()}>
          {finishing ? 'Saving workout…' : 'Finish workout'}
        </button>
      )}
      {canViewAdmin && (
        <section className="alarm-log" aria-label="Emergency alert log">
          <div className="alarm-log-head"><b>Emergency alert log</b><span>Admin view</span></div>
          {recentAlerts === null && !logError && <p className="alarm-log-state" role="status">Loading recent alerts…</p>}
          {logError && <p className="alarm-log-state" role="alert">{logError}</p>}
          {recentAlerts?.length === 0 && <p className="alarm-log-state">No alerts in the last 30 days.</p>}
          {recentAlerts && recentAlerts.length > 0 && (
            <ul className="alarm-log-list">
              {recentAlerts.map(row => (
                <li key={row.id}>
                  <span>
                    <b>{new Date(row.occurredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b>
                    <small>{row.exerciseId ?? 'Workout'} · {row.eventType === 'cancelled' ? 'cancelled by user' : row.status === 'delivered' ? 'contact notified' : alertStatusText(row.status, row.errorCode ?? undefined)}</small>
                  </span>
                  <span className={`alarm-log-badge ${row.eventType === 'cancelled' ? 'false-alarm' : row.resolvedAt ? 'resolved' : 'open'}`}>
                    {row.eventType === 'cancelled' ? 'False alarm' : row.resolvedAt ? 'Resolved' : 'Open'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="sr-only" aria-live="polite">{holdProgress > 0 && holdProgress < 1 ? 'Keep holding to stop the alarm' : ''}</p>
    </section>
  );
}
