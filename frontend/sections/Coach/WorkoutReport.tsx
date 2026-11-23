'use client';

import WorkoutFeedback from './WorkoutFeedback';
import './workout-report.css';
import { Icon } from '../Home/icons';
import type { CoachExercise, WorkoutSessionRecord } from '../../lib/api';
import { titleCase } from '../../lib/titleCase';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function WorkoutReport({ workout, title = 'Workout session', exercises = [], onBack, onHome }: { workout: WorkoutSessionRecord; title?: string; exercises?: CoachExercise[]; onBack: () => void; onHome: () => void; onShare: () => void }) {
  const [insight, setInsight] = useState<{ summary: string; suggestion: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const local = workout._id?.startsWith('local-');
  const [sync, setSync] = useState<{pending:number;error?:string} | null>(null);
  useEffect(() => {
    if (!local) return;
    let active = true;
    const refresh = () => void api.workoutSyncStatus(workout._id).then(value => { if (active) setSync(value); }).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh,3000);
    return () => { active = false; window.clearInterval(timer); };
  },[local,workout._id]);
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
    <header className="manual-report-header pq-page-heading"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button><h2>Workout report</h2></header>
    <div className="manual-report-content">
      <section className="manual-report-hero"><span className="manual-report-badge"><Icon name="check" size={16}/> {finished}</span><p className="manual-report-date">{startedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p><h1>{title}</h1><p role="status">{local ? (sync?.pending === 0 ? 'Synchronized with your account.' : sync?.error ? 'Saved on this device. Sync failed: ' + sync.error : 'Saved on this device. Awaiting synchronization.') : 'Your workout is saved. Here’s what you logged.'}</p></section>
      <section className="manual-report-overview" aria-label="Workout summary"><div><span>Duration</span><strong>{elapsed}</strong><small>minutes</small></div><div><span>Sets logged</span><strong>{completed.length}{expected > 0 && <small> / {expected}</small>}</strong><small>{skipped ? `${skipped} skipped` : 'completed'}</small></div><div><span>Volume</span><strong>{hasVolume ? Math.round(volume).toLocaleString() : '—'}</strong><small>{hasVolume ? 'kg lifted' : 'no load logged'}</small></div></section>
      <section className="manual-report-exercise" aria-label="AI workout insight"><h3>AI workout insight</h3><p>Requesting an insight sends this workout's exercises and sets to an external AI service.</p>{insight ? <><p>{insight.summary}</p><p>{insight.suggestion}</p></> : <button type="button" disabled={busy || Boolean(local && sync?.pending !== 0)} onClick={async () => { setBusy(true); setError(''); try { setInsight(await api.getWorkoutAiSummary(workout._id)); } catch { setError('AI insight is unavailable. Please try again.'); } finally { setBusy(false); } }}>{busy ? 'Preparing insight…' : 'Get workout insight'}</button>}{error && <p role="alert">{error}</p>}</section>
      {rows.map(row => <WorkoutFeedback key={row.id} source="manual" exercise={row.name} sessionRef={workout._id}/>)}
      <section className="manual-report-exercises" aria-label="Confirmed results"><div className="manual-report-section-title"><div><span>YOUR SESSION</span><h3>Exercise breakdown</h3></div><small>{rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}</small></div>
        {rows.map((row, index) => <article className="manual-report-exercise" key={row.id}><div className="manual-report-exercise-head"><span className="manual-report-number">{index + 1}</span><div><h4>{titleCase(row.name)}</h4><p>{row.sets.filter(set => set.status === 'completed').length} {row.sets.filter(set => set.status === 'completed').length === 1 ? 'set' : 'sets'} logged</p></div></div>{row.sets.length > 0 ? <ul>{row.sets.map(set => <li key={set.setId}><span>{set.setType === 'warmup' ? 'Warm-up' : set.setType === 'drop' ? 'Drop' : set.setType === 'failure' ? 'Failure' : 'Set ' + (set.setIndex + 1)}</span><strong>{set.status === 'skipped' ? 'Skipped' : <>{set.durationSeconds ? `${set.durationSeconds} sec` : `${set.reps} reps`} <span>·</span> {set.loadKg === undefined ? 'Bodyweight / no load' : `${set.loadValue ?? Math.round(set.loadKg * 100) / 100} ${set.loadUnit ?? 'kg'}`}</>}</strong></li>)}</ul> : <p className="manual-report-empty">{row.result ? `${row.result.reps} reps recorded${row.result.loadKg === undefined ? '' : ` · ${row.result.loadKg} kg`}` : 'No sets logged'}</p>}</article>)}
      </section>
      <button type="button" className="manual-report-home" onClick={onHome}>Back to home <Icon name="arrow" size={18}/></button>
    </div>
  </div>;
}
