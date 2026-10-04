'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import type { Exercise } from './exercises';

export default function LiveSession({ exercise, onEnd, onPause }: { exercise: Exercise; onEnd: (seconds: number) => Promise<void>; onPause: (paused: boolean) => Promise<void> }) {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);

  const time = `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  const togglePause = async () => {
    setBusy(true); setError('');
    try { await onPause(!paused); setPaused(value => !value); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the workout.'); }
    finally { setBusy(false); }
  };
  const end = async () => {
    setBusy(true); setError('');
    try { await onEnd(seconds); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the workout.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="live-session">
      <header className="live-session-head"><span className="session-meta">Manual workout · form tracking unavailable</span><b className="session-time">{time}</b></header>
      <div className="live-video">
        <div className="live-scene"><span className="live-dumbbell">◆</span><div className="live-athlete"><i/><span/><b/><b/></div></div>
        <span className="form-score"><Icon name="shield" size={14}/> Form analysis unavailable</span>
        <div className="exercise-label"><small>{exercise.equipment}</small><b>{exercise.name}</b></div>
      </div>
      <div className="session-progress-label"><span>Elapsed time</span><b>{time}</b></div>
      <div className="session-progress-track"><i style={{width: `${Math.min(seconds / 1800 * 100, 100)}%`}}/></div>
      <div className="session-controls">
        <button className="pause-button" disabled={busy} onClick={() => void togglePause()}>{paused ? <Icon name="play" size={16}/> : <span className="pause-glyph" aria-hidden="true">Ⅱ</span>}{paused ? 'Resume' : 'Pause'}</button>
        <button className="end-button" disabled={busy} onClick={() => void end()}>{busy ? 'Saving…' : 'End session'}</button>
      </div>
      {paused && <div className="paused-banner">Session paused</div>}
      {error && <p className="scan-warning" role="alert">{error}</p>}
    </section>
  );
}
