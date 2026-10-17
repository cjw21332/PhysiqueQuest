'use client';

import { Icon } from '../Home/icons';
import type { WorkoutSessionRecord } from '../../lib/api';
import { trackingPresets } from '../../../shared/repCounter';
import { workoutLabel } from '../../lib/workoutLabel';

export default function WorkoutReport({ workout, onBack, onHome, onShare }: { workout: WorkoutSessionRecord; onBack: () => void; onHome: () => void; onShare: () => void }) {
  const duration = workout.durationSeconds ?? 0;
  const elapsed = `${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`;
  const startedAt = new Date(workout.startedAt);
  const name = (id: string) => workout.exercises?.find(exercise => exercise.exerciseId === id)?.name ?? trackingPresets.find(exercise => exercise._id === id)?.name ?? id;
  return <>
    <header className="coach-header report-header"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button><h2>Workout report</h2><button className="share-button" onClick={onShare}><Icon name="trend" size={14}/> Share</button></header>
    <div className="report-date">{startedAt.toLocaleString()}</div>
    <h3 className="report-title">{workout.origin === 'recorded-set' ? workoutLabel(workout) : 'Workout session'}</h3>
    <div className="report-summary"><div className="report-score"><b>—</b><small>form</small></div><div className="report-stats"><span>Duration<b>{elapsed}</b></span><span>Exercises<b>{workout.exerciseIds.length}</b></span><span>Status<b>{workout.status}</b></span></div></div>
    <p className="scan-warning">Form analysis and calorie burn are unavailable. Reviewed set results feed your Progress records.</p>
    {workout.origin === 'recorded-set' && <p>This is one recorded set, not an additional completed training day.</p>}
    <section className="report-section"><h3>Confirmed results</h3>{workout.sets?.length ? workout.sets.map(item => <div className="performance-row" key={item.setId}><b>{name(item.exerciseId)} · set {item.setIndex + 1}</b><small>{item.status === 'skipped' ? 'Skipped' : `${item.durationSeconds === undefined ? `${item.reps} reps` : `${item.durationSeconds} seconds`}${item.loadKg === undefined ? '' : ` · ${item.loadKg} kg`}`}</small></div>) : (workout.exerciseResults ?? []).map((item, index) => <div className="performance-row" key={`${item.exerciseId}-${index}`}><b>{name(item.exerciseId)}</b><small>{item.reps} reps{item.loadKg === undefined ? '' : ` · ${item.loadKg} kg`}</small></div>)}{!workout.sets?.length && !workout.exerciseResults?.length && <p>No reps or loads were submitted for this session.</p>}</section>
    <footer className="coach-footer"><button className="primary" onClick={onHome}>Back to home</button></footer>
  </>;
}

