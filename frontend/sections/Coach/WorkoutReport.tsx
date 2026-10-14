'use client';

import { Icon } from '../Home/icons';
import type { WorkoutSessionRecord } from '../../lib/api';

export default function WorkoutReport({ workout, onBack, onHome, onShare }: { workout: WorkoutSessionRecord; onBack: () => void; onHome: () => void; onShare: () => void }) {
  const duration = workout.durationSeconds ?? 0;
  const elapsed = `${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`;
  const startedAt = new Date(workout.startedAt);
  return <>
    <header className="coach-header report-header"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button><h2>Workout report</h2><button className="share-button" onClick={onShare}><Icon name="trend" size={14}/> Share</button></header>
    <div className="report-date">{startedAt.toLocaleString()}</div>
    <h3 className="report-title">Workout session</h3>
    <div className="report-summary"><div className="report-score"><b>—</b><small>form</small></div><div className="report-stats"><span>Duration<b>{elapsed}</b></span><span>Exercises<b>{workout.exerciseIds.length}</b></span><span>Status<b>{workout.status}</b></span></div></div>
    <p className="scan-warning">Form analysis, calorie burn, and personal-record tracking are unavailable until a provider is configured.</p>
    <section className="report-section"><h3>Confirmed results</h3>{(workout.exerciseResults ?? []).length ? (workout.exerciseResults ?? []).map((item, index) => <div className="performance-row" key={`${item.exerciseId}-${index}`}><div><b>{item.exerciseId}</b></div><small>{item.reps} reps{item.loadKg === undefined ? '' : ` · ${item.loadKg} kg`}</small></div>) : <p>No reps or loads were submitted for this session.</p>}</section>
    <footer className="coach-footer"><button className="primary" onClick={onHome}>Back to home</button></footer>
  </>;
}
