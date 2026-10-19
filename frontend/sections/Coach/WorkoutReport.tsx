'use client';

import { Icon } from '../Home/icons';
import type { CoachExercise, WorkoutSessionRecord } from '../../lib/api';

export default function WorkoutReport({ workout, title = 'Workout session', exercises = [], onBack, onHome, onShare }: { workout: WorkoutSessionRecord; title?: string; exercises?: CoachExercise[]; onBack: () => void; onHome: () => void; onShare: () => void }) {
  const duration = workout.durationSeconds ?? 0;
  const elapsed = `${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`;
  const startedAt = new Date(workout.startedAt);
  const results = workout.exerciseResults ?? [];
  const completedSets = (workout.sets ?? []).filter(set => set.status === 'completed');
  const hasVolume = completedSets.some(set => set.loadKg !== undefined);
  const volume = completedSets.reduce((sum, set) => sum + set.reps * (set.loadKg ?? 0), 0);
  const rows = exercises.length ? exercises.map(exercise => ({ id: exercise.exerciseId, name: exercise.name, result: results.find(result => result.exerciseId === exercise.exerciseId) })) : workout.exerciseIds.map(id => ({ id, name: id.replace(/[-_]+/g, ' '), result: results.find(result => result.exerciseId === id) }));
  return <>
    <header className="coach-header report-header"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button><h2>Workout report</h2><button className="share-button" onClick={onShare}><Icon name="share" size={14}/> Share</button></header>
    <div className="report-date">{startedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
    <h3 className="report-title">{title}</h3>
    <div className="report-summary"><div className="report-score" aria-label="Form score unavailable"><b>—</b><small>form</small></div><div className="report-stats"><span>Duration<b>{elapsed}</b></span><span>Volume<b>{hasVolume ? `${Math.round(volume).toLocaleString()} kg` : '—'}</b></span><span>Burned<b>—</b></span></div></div>
    <div className="mission-complete"><Icon name="check" size={19}/><span>{workout.status === 'completed' ? 'Workout completed and saved' : `Session status: ${workout.status}`} · {workout.exerciseIds.length} exercises</span></div>
    <p className="report-unavailable">Form analysis, calorie burn, and personal-record tracking are unavailable for this session.</p>
    <section className="report-section" aria-label="Confirmed results"><h3>Per exercise</h3>{rows.map((row, index) => <div className="performance-row" key={`${row.id}-${index}`}><div className="performance-head"><b>{row.name}</b><span aria-label="Form score unavailable">—</span></div><small>{row.result ? `${row.result.reps} reps counted${row.result.loadKg === undefined ? '' : ` · ${row.result.loadKg} kg`}` : 'No reps recorded'}</small><div className="performance-track" aria-hidden="true"/></div>)}{!results.length && <p className="report-unavailable">No reps or loads were submitted for this session.</p>}</section>
    <section className="report-section"><h3>Top form errors</h3><p className="report-unavailable">No form-analysis results are available for this session.</p></section>
    <footer className="coach-footer"><button className="primary" onClick={onHome}>Back to home</button></footer>
  </>;
}
