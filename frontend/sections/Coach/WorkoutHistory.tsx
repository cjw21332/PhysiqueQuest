'use client';
import { useState } from 'react';
import { api, type RecordingPlan, type WorkoutSessionRecord } from '../../lib/api';
import { useWorkoutDay } from '../../hooks/useWorkoutDay';
import Link from 'next/link';
import { Icon } from '../Home/icons';
import { workoutLabel } from '../../lib/workoutLabel';
import { plannedDayResults, setProgress } from '../../../shared/workouts';
import { notifyDataChanged } from '../../hooks/useApiResource';
export default function WorkoutHistory({ date, plan }: { date?: string; plan?: RecordingPlan }) {
  const resource = useWorkoutDay(date);
  const [older, setOlder] = useState<WorkoutSessionRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const rows = [...(resource.data ?? []), ...older].filter(
    (row, index, all) =>
      all.findIndex((other) => other._id === row._id) === index,
  );
  const used = new Set(rows.flatMap(row => [...(row.appliedRecordingIds ?? []), ...(row.sets ?? []).flatMap(set => set.sourceRecordingId ? [set.sourceRecordingId] : [])]));
  const reviewed = plan ? plannedDayResults(rows, plan.programVersion, plan.dayIndex, plan.scheduledDate, plan.timezone) : [];
  const available = plan?.exercises.filter(exercise => setProgress([exercise], reviewed).remaining > 0) ?? [];
  const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    <section className="workout-history">
      <h3>{date ? 'Saved workouts and recordings' : 'All workout history'}</h3>
      {date && <p>{new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' })}</p>}
      {resource.loading && <p role="status">Loading history…</p>}
      {(resource.error || error) && (
        <p role="alert">
          {resource.error || error}
          <button onClick={() => void resource.refresh()}>Retry</button>
        </p>
      )}
      {!resource.loading && !resource.error && !rows.length && (
        <p>No saved workouts yet.</p>
      )}
      <ul className="workout-history-list">
        {rows.map((row) => {
          const source = row.sets?.find(set => set.status === 'completed') ?? row.exerciseResults?.[0];
          const positive = source && (source.reps > 0 || ('durationSeconds' in source && typeof source.durationSeconds === 'number' && source.durationSeconds > 0));
          const suggested = available.find(exercise => normalized(exercise.name) === normalized(row.exercises?.[0]?.name ?? ''))?.exerciseId ?? '';
          const selected = selections[row._id] ?? suggested;
          return (
          <li key={row._id}>
            <Link href={`/workouts/${row._id}`}>
              {row.origin === 'planned' && row.appliedRecordingIds?.length ? 'Planned workout' : workoutLabel(row)}{' '}
              · Performed {new Date(row.startedAt).toLocaleDateString()} · {row.status}
            </Link>
            {plan && row.origin === 'recorded-set' && row.status === 'completed' && (used.has(row._id) ? <p className="recording-applied"><Icon name="check-circle" size={17}/> Applied to a planned set.</p> : !positive ? <p className="recording-note">No reps logged; this recording does not complete a planned set.</p> : <div className="recording-apply-panel">
              <p>Apply this recording as one planned set. Review the exercise match first.</p>
              <label>Planned exercise for {row.exercises?.[0]?.name ?? 'this recording'}<select value={available.some(exercise => exercise.exerciseId === selected) ? selected : ''} disabled={!!applying || resource.loading || !!resource.error} onChange={event => setSelections(previous => ({ ...previous, [row._id]: event.target.value }))}>
                <option value="">Choose a matching planned exercise</option>
                {available.map(exercise => <option key={exercise.exerciseId} value={exercise.exerciseId}>{exercise.name}</option>)}
              </select></label>
              {!available.length && <p>All sets in this plan are already reviewed.</p>}
              <button type="button" className="recording-apply-button" aria-label={`Apply ${workoutLabel(row)} to a planned set`} disabled={!!applying || resource.loading || !!resource.error || !available.some(exercise => exercise.exerciseId === selected)} onClick={async () => {
                if (applying) return;
                setApplying(row._id); setError(''); setNotice('');
                try {
                  await api.applyRecordedWorkout(row._id, plan, selected);
                  notifyDataChanged('workouts', 'workout-history');
                  setNotice('Recording applied as one set. Resume your session to log the remaining sets.');
                } catch (error) {
                  setError(error instanceof Error ? error.message : 'Could not apply the recording. Try again.');
                  notifyDataChanged('workouts', 'workout-history');
                } finally { setApplying(''); }
              }}><Icon name="check-circle" size={18}/>{applying === row._id ? 'Applying…' : 'Apply to set'}</button>
            </div>)}
          </li>
        ); })}
      </ul>
      {notice && <p role="status">{notice}</p>}
      {!date && rows.length >= 20 && !done && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const last = rows.at(-1)!;
              const next = await api.getWorkouts(
                20,
                `${last.startedAt}|${last._id}`,
              );
              setOlder((previous) => [...previous, ...next]);
              setDone(next.length < 20);
            } catch (err) {
              setError(String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Loading…' : 'Load older workouts'}
        </button>
      )}
      {date && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Hide all workout history' : 'View all workout history'}</button>}
      {date && showAll && <WorkoutHistory/>}
    </section>
  );
}
