'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import type { Exercise } from './exercises';

export default function LiveSession({ exercise, onEnd }: { exercise: Exercise; onEnd: (seconds: number) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [reps, setReps] = useState(6);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setReps(n => Math.min(n + 1, 10)), 11000);
    return () => window.clearInterval(id);
  }, [paused]);

  const time = `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  const togglePause = () => setPaused(v => !v);

  return (
    <section className="live-session">
      <header className="live-session-head">
        <span className="session-meta">Exercise 2 of 6 · Set 3 of 4</span>
        <b className="session-time">{time}</b>
      </header>

      <div className="live-video">
        <div className="live-scene">
          <span className="live-dumbbell">◆</span>
          <div className="live-athlete">
            <i/><span/><b/><b/>
          </div>
        </div>

        <span className="form-score">
          <Icon name="check" size={14}/> Form OK · 92%
        </span>

        <div className="rep-count">
          <b>{String(reps).padStart(2,'0')}</b>
          <small>reps / 10</small>
        </div>

        <div className="exercise-label">
          <small>Dumbbell · 22 kg</small>
          <b>Bench press</b>
        </div>
      </div>

      <div className="session-progress-label">
        <span>Session progress</span>
        <b>{seconds > 0 ? '38%' : '0%'}</b>
      </div>

      <div className="session-progress-track">
        <i style={{width: seconds > 0 ? '38%' : '0%'}}/>
      </div>

      <div className="session-controls">
        <button className="pause-button" onClick={togglePause}>
          {paused ? <Icon name="play" size={16}/> : <span className="pause-glyph" aria-hidden="true">Ⅱ</span>}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button className="end-button" onClick={() => onEnd(seconds)}>
          End session
        </button>
      </div>

      {paused && <div className="paused-banner">Session paused</div>}
    </section>
  );
}
