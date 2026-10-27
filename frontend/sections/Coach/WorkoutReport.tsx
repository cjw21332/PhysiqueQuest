'use client';

import './workout-report.css';
import { Icon } from '../Home/icons';
import type { CoachExercise, WorkoutSessionRecord } from '../../lib/api';
import { titleCase } from '../../lib/titleCase';

export default function WorkoutReport({ workout, title = 'Workout session', exercises = [], onBack, onHome }: { workout: WorkoutSessionRecord; title?: string; exercises?: CoachExercise[]; onBack: () => void; onHome: () => void; onShare: () => void }) {
  const duration = workout.durationSeconds ?? 0;
  const elapsed = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
  const startedAt = new Date(workout.startedAt);
  const sets = workout.sets ?? [];
  const completed = sets.filter(set => set.status === 'completed');
  const routine = workout.exercises ?? [];
  const expected = routine.reduce((sum, exercise) => sum + exercise.sets, 0);
  const skipped = sets.filter(set => set.status === 'skipped').length;
  const volume = completed.reduce((sum, set) => sum + set.reps * (set.loadKg ?? 0), 0);
  const hasVolume = completed.some(set => set.loadKg !== undefined);
  const rows = workout.exerciseIds.map(id => ({ id, name: routine.find(item => item.exerciseId === id)?.name ?? exercises.find(item => item.exerciseId === id)?.name ?? id.replace(/[-_]+/g, ' '), sets: sets.filter(set => set.exerciseId === id).sort((a, b) => a.setIndex - b.setIndex), result: workout.exerciseResults?.find(result => result.exerciseId === id) }));
  const finished = expected > 0 && completed.length < expected ? 'Workout saved' : 'Workout complete';

  return <div className="manual-report">
    <header className="manual-report-header"><button type="button" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button><h2>Workout report</h2></header>
    <div className="manual-report-content">
      <section className="manual-report-hero"><span className="manual-report-badge"><Icon name="check" size={16}/> {finished}</span><p className="manual-report-date">{startedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p><h1>{title}</h1><p>Your workout is saved. Here’s what you logged.</p></section>
      <section className="manual-report-overview" aria-label="Workout summary"><div><span>Duration</span><strong>{elapsed}</strong><small>minutes</small></div><div><span>Sets logged</span><strong>{completed.length}{expected > 0 && <small> / {expected}</small>}</strong><small>{skipped ? `${skipped} skipped` : 'completed'}</small></div><div><span>Volume</span><strong>{hasVolume ? Math.round(volume).toLocaleString() : '—'}</strong><small>{hasVolume ? 'kg lifted' : 'no load logged'}</small></div></section>
      <section className="manual-report-exercises" aria-label="Confirmed results"><div className="manual-report-section-title"><div><span>YOUR SESSION</span><h3>Exercise breakdown</h3></div><small>{rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}</small></div>
        {rows.map((row, index) => <article className="manual-report-exercise" key={row.id}><div className="manual-report-exercise-head"><span className="manual-report-number">{index + 1}</span><div><h4>{titleCase(row.name)}</h4><p>{row.sets.filter(set => set.status === 'completed').length} {row.sets.filter(set => set.status === 'completed').length === 1 ? 'set' : 'sets'} logged</p></div></div>{row.sets.length > 0 ? <ul>{row.sets.map(set => <li key={set.setId}><span>Set {set.setIndex + 1}</span><strong>{set.status === 'skipped' ? 'Skipped' : <>{set.durationSeconds ? `${set.durationSeconds} sec` : `${set.reps} reps`} <span>·</span> {set.loadKg === undefined ? 'Bodyweight / no load' : `${set.loadKg} kg`}</>}</strong></li>)}</ul> : <p className="manual-report-empty">{row.result ? `${row.result.reps} reps recorded${row.result.loadKg === undefined ? '' : ` · ${row.result.loadKg} kg`}` : 'No sets logged'}</p>}</article>)}
      </section>
      <button type="button" className="manual-report-home" onClick={onHome}>Back to home <Icon name="arrow" size={18}/></button>
    </div>
  </div>;
}
