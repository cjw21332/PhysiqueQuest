'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import { api, type WorkoutSessionRecord } from '../../lib/api';
import { setProgress, type SetResult, type WorkoutExercise } from '../../../shared/workouts';
import { trackingPresets } from '../../../shared/repCounter';
import { accountScope, notifyDataChanged } from '../../hooks/useApiResource';
import type { UserSettings } from '../../hooks/useSettings';
import LiveSession from './LiveSession';
import RecordedRepCounter from './RecordedRepCounter';
import { Icon } from '../Home/icons';

type Draft = {
  phase: 'active' | 'review';
  selected: number;
  reps: number;
  load: string;
  endedAt?: string;
  editing?: number;
  pendingSet?: SetResult;
  startedSet?: string;
};
const initial: Draft = { phase: 'active', selected: 0, reps: 0, load: '' };
function reducer(state: Draft, action: Partial<Draft>): Draft {
  return { ...state, ...action };
}
export default function WorkoutRunner({
  workout: initialWorkout,
  settings,
  contactName,
  contactPhone,
  onCompleted,
}: {
  workout: WorkoutSessionRecord;
  settings: UserSettings;
  contactName: string;
  contactPhone: string;
  onCompleted: (workout: WorkoutSessionRecord) => void;
}) {
  const [workout, setWorkout] = useState(initialWorkout);
  const [draft, dispatch] = useReducer(reducer, initial);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [pauseBusy, setPauseBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [presetId, setPresetId] = useState('');
  const draftKey = `physiquequest-draft:${accountScope()}:${workout._id}`;
  const exercises: WorkoutExercise[] = workout.exercises?.length
    ? workout.exercises
    : workout.exerciseIds.map((exerciseId) => ({
        exerciseId,
        name:
          trackingPresets.find((item) => item._id === exerciseId)?.name ??
          exerciseId,
        equipment: '',
        sets: 1,
      }));
  const exercise = exercises[draft.selected] ?? exercises[0];
  const timed = /\d+\s*(?:s\b|sec|seconds|min)/i.test(
    exercise?.prescription ?? '',
  );
  const results = workout.sets ?? [];
  const setIndex =
    draft.editing ??
    (exercise
      ? Array.from({ length: exercise.sets }, (_, index) => index).find(
          (index) =>
            !results.some(
              (set) => set.setId === `${exercise.exerciseId}:${index}`,
            ),
        )
      : undefined);
  const currentSetId = exercise && setIndex !== undefined ? `${exercise.exerciseId}:${setIndex}` : undefined;
  const setStarted = !!currentSetId && draft.startedSet === currentSetId;
  const paused = draft.phase === 'active' && !!workout.pausedAt;
  const locked = busy || pauseBusy || paused;
  const progress = setProgress(exercises, results);
  const total = progress.total;
  const exerciseProgress = setProgress(exercise ? [exercise] : [], results);
  const allReviewed = progress.remaining === 0 || !workout.exercises?.length;
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (
        value &&
        Number.isInteger(value.selected) &&
        value.selected >= 0 &&
        value.selected < exercises.length &&
        ['active', 'review'].includes(value.phase)
      ) {
        dispatch(value);
      } else {
        const next = exercises.findIndex(item => setProgress([item], results).remaining > 0);
        if (next >= 0) dispatch({ selected: next });
      }
    } catch {
      /* Draft is optional. */
    }
    setReady(true);
  }, [draftKey]);
  useEffect(() => {
    if (ready) localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, ready, draftKey]);
  const commitSet = async (result: SetResult) => {
    if (busyRef.current || pauseBusy || paused) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ ...draft, pendingSet: result }),
      );
      dispatch({ pendingSet: result });
      const saved = await api.saveWorkoutSet(
        workout._id,
        workout.revision ?? 0,
        result,
      );
      setWorkout(saved);
      notifyDataChanged('workout-history');
      setFile(null);
      dispatch({
        reps: 0,
        load: '',
        editing: undefined,
        pendingSet: undefined,
        startedSet: undefined,
      });
      const next = exercises.findIndex(
        (item) =>
          setProgress([item], saved.sets ?? []).remaining > 0,
      );
      if (next >= 0) dispatch({ selected: next });
      setPresetId('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Set could not be saved. Retry.',
      );
      throw err;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const manual = (status: 'completed' | 'skipped') => {
    if (!exercise || setIndex === undefined) return;
    const result: SetResult = {
      setId: `${exercise.exerciseId}:${setIndex}`,
      exerciseId: exercise.exerciseId,
      setIndex,
      reps: status === 'skipped' || timed ? 0 : draft.reps,
      ...(timed && status === 'completed'
        ? { durationSeconds: draft.reps }
        : {}),
      source: 'manual',
      status,
      ...(draft.load !== '' && status === 'completed'
        ? { loadKg: Number(draft.load) }
        : {}),
    };
    void commitSet(result).catch(() => {});
  };
  const complete = async () => {
    if (busyRef.current || !draft.endedAt) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await api.completeWorkout(workout._id, {
        endedAt: draft.endedAt,
        durationSeconds: 0,
        exerciseResults: [],
        expectedRevision: workout.revision ?? 0,
      });
      localStorage.removeItem(draftKey);
      notifyDataChanged(
        'workouts',
        'workout-history',
        'workout-summary',
        'activity',
        'leaderboard',
      );
      onCompleted(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish. Retry.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const reload = async () => {
    try {
      const saved = await api.getWorkout(workout._id);
      if (saved.status === 'completed') onCompleted(saved);
      else {
        setWorkout(saved);
        setError('');
      }
    } catch (err) {
      setError(String(err));
    }
  };
  if (!ready || !exercise) return <p role="status">Restoring your workout…</p>;
  const review = (
    <fieldset className="workout-set-editor" disabled={locked}>
      {draft.pendingSet && !busy && (
        <button
          className="secondary"
          onClick={() => void commitSet(draft.pendingSet!).catch(() => {})}
        >
          Retry saving reviewed set
        </button>
      )}
      <h3>
        {draft.phase === 'review'
          ? 'Review your workout'
          : `Exercise ${draft.selected + 1} of ${exercises.length}`}
      </h3>
      <label>
        Exercise
        <select
          value={draft.selected}
          disabled={busy || setStarted || !!draft.pendingSet}
          onChange={(event) => {
            dispatch({
              selected: Number(event.target.value),
              editing: undefined,
              startedSet: undefined,
              reps: 0,
              load: '',
            });
            setPresetId('');
            setFile(null);
          }}
        >
          {exercises.map((item, index) => (
            <option key={item.exerciseId} value={index}>
              {item.name} (
              {
                results.filter((set) => set.exerciseId === item.exerciseId)
                  .length
              }
              /{item.sets} sets reviewed)
            </option>
          ))}
        </select>
      </label>
      <p>
        {exercise.name} · {exercise.prescription || `${exercise.sets} sets`}
      </p>
      <p role="status" aria-label="Remaining sets for this exercise">{exerciseProgress.remaining} {exerciseProgress.remaining === 1 ? 'set' : 'sets'} remaining for this exercise.</p>
      {!workout.exercises?.length && (
        <p>
          This is an older session without a set plan. Finish it to preserve its
          original record.
        </p>
      )}
      {setIndex !== undefined && workout.exercises?.length ? (
        <>
          <p>
            Set {setIndex + 1} of {exercise.sets}
          </p>
          {draft.editing === undefined && !setStarted && (
            <div className="set-start-prompt" role="status" aria-label="Next set">
              <strong>Ready for {exercise.name}?</strong>
              <p>Rest as needed, then start set {setIndex + 1}. The next set starts when you choose.</p>
              <button type="button" className="set-action" disabled={!!draft.pendingSet} onClick={() => dispatch({ startedSet: currentSetId })}>
                <Icon name="play" size={18}/> Start set
              </button>
            </div>
          )}
          {setStarted && <p className="set-in-progress" role="status">Set in progress · {exercise.name}</p>}
          <fieldset className="set-entry-fields" disabled={!!draft.pendingSet || (!setStarted && draft.editing === undefined)}>
          <label>
            {timed ? 'Seconds held' : 'Reps'}
            <input
              aria-label={timed ? 'Set seconds' : 'Set reps'}
              type="number"
              min={0}
              max={1000}
              value={draft.reps}
              disabled={busy}
              onChange={(event) =>
                dispatch({
                  reps: Math.max(
                    0,
                    Math.min(1000, Math.floor(Number(event.target.value) || 0)),
                  ),
                })
              }
            />
          </label>
          <label>
            Load (kg, optional)
            <input
              aria-label="Set load in kg"
              type="number"
              min={0}
              max={1000}
              step="0.5"
              value={draft.load}
              disabled={busy}
              onChange={(event) => dispatch({ load: event.target.value })}
            />
          </label>
          <button
            className="set-action"
            disabled={
              busy ||
              (draft.load !== '' &&
                (!Number.isFinite(Number(draft.load)) ||
                  Number(draft.load) < 0 ||
                  Number(draft.load) > 1000))
            }
            onClick={() => manual('completed')}
          >
            <Icon name="check-circle" size={18}/> {busy ? 'Saving…' : draft.editing !== undefined ? 'Save changes' : 'Done set'}
          </button>
          {!timed && (
            <details>
              <summary>Use a recorded video for this set</summary>
              <p>
                Select a matching counting rule yourself. The result will be
                saved to {exercise.name}; choose manual logging when no rule
                matches.
              </p>
              <label>
                Counting rule
                <select
                  value={presetId}
                  onChange={(event) => {
                    setPresetId(event.target.value);
                    setFile(null);
                  }}
                >
                  <option value="">Choose a matching exercise</option>
                  {trackingPresets.map((preset) => (
                    <option key={preset._id} value={preset._id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              {presetId && (
                <input
                  aria-label="Set video"
                  type="file"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              )}
              {file && presetId && (
                <RecordedRepCounter
                  key={`${exercise.exerciseId}:${setIndex}:${presetId}`}
                  file={file}
                  onChooseAnother={() => setFile(null)}
                  attachment={{
                    exercise,
                    setIndex,
                    presetId,
                    onReviewed: (result) =>
                      commitSet({
                        ...result,
                        ...(draft.load !== ''
                          ? { loadKg: Number(draft.load) }
                          : {}),
                      }),
                  }}
                />
              )}
            </details>
          )}
          </fieldset>
          <button
            className="quiet-link"
            disabled={busy || !!draft.pendingSet}
            onClick={() => manual('skipped')}
          >
            Skip this set
          </button>
        </>
      ) : (
        <p>All sets for this exercise are reviewed.</p>
      )}
      <p>
        {progress.reviewed} of {total} sets reviewed. Skipped sets remain marked as
        skipped.
      </p>
      <p role="status" aria-label="Remaining sets in this workout">{progress.remaining} {progress.remaining === 1 ? 'set' : 'sets'} remaining in this workout · {progress.completed} completed · {progress.skipped} skipped.</p>
      <ul>
        {results.map((result) => (
          <li key={result.setId}>
            <button
              disabled={busy || setStarted || !!draft.pendingSet}
              onClick={() =>
                dispatch({
                  selected: exercises.findIndex(
                    (item) => item.exerciseId === result.exerciseId,
                  ),
                  editing: result.setIndex,
                  startedSet: undefined,
                  reps: result.durationSeconds ?? result.reps,
                  load:
                    result.loadKg === undefined ? '' : String(result.loadKg),
                })
              }
            >
              Edit{' '}
              {
                exercises.find((item) => item.exerciseId === result.exerciseId)
                  ?.name
              }
              , set {result.setIndex + 1}
            </button>
          </li>
        ))}
      </ul>
      {draft.phase === 'review' && (
        <>
          <ul>
            {results.map((result) => (
              <li key={result.setId}>
                {
                  exercises.find(
                    (item) => item.exerciseId === result.exerciseId,
                  )?.name
                }{' '}
                · set {result.setIndex + 1}:{' '}
                {result.status === 'skipped'
                  ? 'Skipped'
                  : `${result.durationSeconds === undefined ? `${result.reps} reps` : `${result.durationSeconds} seconds`}${result.loadKg === undefined ? '' : ` at ${result.loadKg} kg`}`}
              </li>
            ))}
          </ul>
          <button
            className="primary"
            disabled={busy || !allReviewed || !!draft.pendingSet || draft.editing !== undefined}
            onClick={() => void complete()}
          >
            {busy ? 'Saving…' : 'Confirm and finish workout'}
          </button>
          <p>Review or skip every set before finishing.</p>
        </>
      )}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void reload()}>Reload saved workout</button>
        </p>
      )}
    </fieldset>
  );
  if (draft.phase === 'review') return review;
  const elapsed = Math.max(
    0,
    Math.floor(
      ((workout.pausedAt ? Date.parse(workout.pausedAt) : Date.now()) -
        Date.parse(workout.startedAt)) /
        1000,
    ) - (workout.pausedSeconds ?? 0),
  );
  return (
    <LiveSession
      key={workout._id}
      exercise={exercise}
      workoutId={workout._id}
      initialSeconds={elapsed}
      initialPaused={!!workout.pausedAt}
      controlsDisabled={busy || pauseBusy}
      thresholdSeconds={settings.threshold}
      inactivityEnabled={settings.inactivity && !file}
      alarmVolume={settings.alarmVolume}
      contactName={contactName}
      contactPhone={contactPhone}
      onPause={async (paused) => {
        setPauseBusy(true);
        try {
        const saved = await api.pauseWorkout(workout._id, {
          paused,
          occurredAt: new Date().toISOString(),
          expectedRevision: workout.revision ?? 0,
        });
        setWorkout(saved);
        } finally { setPauseBusy(false); }
      }}
      onEnd={async () => {
        if (!allReviewed || draft.pendingSet || draft.editing !== undefined) {
          setError('Review or skip each set before finishing.');
          return;
        }
        dispatch({ phase: 'review', endedAt: new Date().toISOString() });
      }}
    >
      {review}
    </LiveSession>
  );
}

