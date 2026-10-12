'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { COUNTDOWN_SECONDS, HOLD_TO_STOP_MS, alertStatusText } from '../../lib/inactivityConstants.mjs';

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
      <h2 className="inactivity-kicker">Emergency check</h2>
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
      <h3 className="inactivity-question">Are you okay?</h3>
      <p className="inactivity-copy">No movement detected for {thresholdSeconds} seconds during your {exerciseName}.</p>
      <div className="inactivity-notice">
        <Icon name="bell" size={18} />
        <p>
          When the countdown ends, an alarm sounds and <b>{contactName || 'your emergency contact'}</b> is alerted with your location.
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
  onHoldComplete,
}: {
  exerciseName: string;
  recordedAt: string;
  contactName: string;
  contactPhone: string;
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  errorCode?: string;
  locationShared: boolean;
  resolved: boolean;
  onHoldComplete: () => void;
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

  const statusLabel = status === 'delivered' ? 'Delivered' : status === 'pending' ? 'Sending...' : 'Not delivered';

  return (
    <section className="inactivity-view emergency-alarm" aria-label="Emergency alarm">
      <div className="alarm-bell" aria-hidden="true"><Icon name="bell" size={40} /></div>
      <p className="alarm-state">Alarm active</p>
      <h2 className="alarm-title">Emergency detected</h2>
      <p className="alarm-copy">
        {resolved ? 'Session ended and flagged.' : 'Hold the stop control to end the alarm.'} Recorded at {recordedAt} during your {exerciseName}.
      </p>
      <div className="alarm-card">
        <div className="alarm-card-head">
          <span>Alert sent to</span>
          <span className={`alarm-badge ${status}`} role="status">{alertStatusText(status, errorCode)}</span>
        </div>
        <b className="alarm-contact">{contactName || 'No contact saved'}</b>
        <small>{contactPhone || '—'} · {locationShared ? 'location shared' : 'Location unavailable'}</small>
      </div>
      {!resolved && (
        <button
          type="button"
          className="alarm-hold"
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
          <span className="alarm-hold-label">Hold to stop alarm</span>
        </button>
      )}
      <p id="alarm-hold-help" className="alarm-hint">Hold for 3 seconds — prevents accidental dismissal</p>
      <p className="sr-only" aria-live="polite">{holdProgress > 0 && holdProgress < 1 ? 'Keep holding to stop the alarm' : ''}</p>
    </section>
  );
}
