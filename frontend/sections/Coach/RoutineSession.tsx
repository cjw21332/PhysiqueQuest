'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, getApiBaseUrl, type WorkoutSessionRecord, type WorkoutSetResult } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import LiveSession from './LiveSession';
import { Icon } from '../Home/icons';
import { exerciseProgress, prescribedWork } from './workoutRoutine';
import { titleCase } from '../../lib/titleCase';

type Draft = { selected: number; values: Record<string, { reps: string; weight: string }>; checkpoint?: string; unit?: 'kg' | 'lbs' };
export function workoutDraftKey(id: string) { return `physiquequest-workout-draft:${getApiBaseUrl()}:${getCurrentUser()?.id ?? 'signed-out'}:${id}`; }
export function readWorkoutDraft(id: string): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(workoutDraftKey(id)) ?? 'null');
    if (value && Number.isInteger(value.selected) && value.selected >= 0 && value.values && typeof value.values === 'object' && !Array.isArray(value.values)) {
      const values: Draft['values'] = {};
      for (const [key, row] of Object.entries(value.values).slice(0, 500)) {
        const item = row as { reps?: unknown; weight?: unknown };
        if (item && typeof item.reps === 'string' && item.reps.length <= 8 && typeof item.weight === 'string' && item.weight.length <= 8) values[key] = { reps: item.reps, weight: item.weight };
      }
      return { selected: value.selected, values, unit: value.unit === 'lbs' ? 'lbs' : 'kg', checkpoint: typeof value.checkpoint === 'string' && Number.isFinite(Date.parse(value.checkpoint)) ? value.checkpoint : undefined };
    }
  } catch { /* A damaged or unavailable device draft never replaces server records. */ }
  return { selected: 0, values: {} };
}

export default function RoutineSession({ workout, thresholdSeconds, contactName, contactPhone, onSaved, onComplete }: {
  workout: WorkoutSessionRecord; thresholdSeconds: number; contactName: string; contactPhone: string;
  onSaved: (record: WorkoutSessionRecord) => void; onComplete: (record: WorkoutSessionRecord) => void;
}) {
  const [record, setRecord] = useState(workout);
  const recordRef = useRef(workout);
  const [draft, setDraft] = useState(() => readWorkoutDraft(workout._id));
  const draftRef = useRef(draft);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(true);
  const unit = draft.unit ?? 'kg';
  const [restSets, setRestSets] = useState(90);
  const [restExercises, setRestExercises] = useState(120);
  const [restUntil, setRestUntil] = useState(0);
  const [restNow, setRestNow] = useState(Date.now());
  const restDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!restUntil) return; const timer = window.setInterval(() => { const now = Date.now(); setRestNow(now); if (now >= restUntil) setRestUntil(0); }, 1000); return () => window.clearInterval(timer); }, [restUntil]);
  useEffect(() => {
    const dialog = restDialog.current;
    if (restUntil && dialog && !dialog.open) dialog.showModal();
    if (!restUntil && dialog?.open) dialog.close();
  }, [restUntil]);
  const [ending, setEnding] = useState<number | null>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const completionRequest = useRef<{ endedAt: string; exerciseResults: []; expectedRevision: number } | null>(null);
  const showCompleted = (saved: WorkoutSessionRecord) => {
    try { localStorage.removeItem(workoutDraftKey(workout._id)); } catch { /* Server completion remains authoritative. */ }
    onComplete(saved);
  };
  const exercises = record.exercises ?? [];
  const selected = Math.min(draft.selected, Math.max(0, exercises.length - 1));
  const exercise = exercises[selected];
  const sets = record.sets ?? [];
  const total = exercises.reduce((sum, row) => sum + row.sets, 0);
  const completed = sets.filter(set => set.status === 'completed').length;
  const updateRecord = (next: WorkoutSessionRecord) => { recordRef.current = next; setRecord(next); onSaved(next); };
  const persist = useCallback((next: Draft) => {
    draftRef.current = next;
    try { localStorage.setItem(workoutDraftKey(workout._id), JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [workout._id]);
  const changeDraft = (next: Draft) => { persist(next); setDraft(next); };
  const setUnit = (next: 'kg' | 'lbs') => { if (next === unit) return; const factor = next === 'lbs' ? 2.2046226218 : 1 / 2.2046226218; const values = Object.fromEntries(Object.entries(draftRef.current.values).map(([key, value]) => [key, { ...value, weight: value.weight === '' ? '' : String(Math.round(Number(value.weight) * factor * 100) / 100) }])); changeDraft({ ...draftRef.current, unit: next, values }); };
  const checkpoint = useCallback(() => persist({ ...draftRef.current, checkpoint: new Date().toISOString() }), [persist]);
  useEffect(() => { persist(draftRef.current); }, [persist]);
  useEffect(() => {
    if (ending === null) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = endDialog.current; dialog?.showModal();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); };
  }, [ending]);

  const attempt = async (action: () => Promise<void>) => {
    if (locked.current) return false;
    locked.current = true; setSaving(true); setError('');
    try { await action(); return true; }
    catch (err) {
      let message = err instanceof Error ? err.message : 'Could not save. Your inputs are still here; try again.';
      if (err instanceof ApiRequestError && err.statusCode === 409) {
        try { const latest = await api.getWorkout(workout._id); if (latest.status === 'completed') { showCompleted(latest); return true; } updateRecord(latest); message = 'Workout changed on another screen. Latest saved sets loaded; review your inputs and retry.'; }
        catch { message += ' Could not reload the workout. Reopen Coach before retrying.'; }
      }
      setError(message);
      return false;
    } finally { locked.current = false; setSaving(false); }
  };
  const writeSet = async (result: WorkoutSetResult) => {
    const next = await api.saveWorkoutSet(workout._id, recordRef.current.revision ?? 0, result);
    updateRecord(next);
  };
  const advance = () => {
    const next = exercises.findIndex((row, index) => index > selected && exerciseProgress(row, recordRef.current.sets ?? []) !== 'completed');
    if (next >= 0) changeDraft({ ...draftRef.current, selected: next });
  };
  const save = (index: number) => attempt(async () => {
    const setId = `${exercise.exerciseId}:${index}`;
    const prescribed = prescribedWork(exercise.prescription);
    const existing = sets.find(set => set.setId === setId);
    const input = draftRef.current.values[setId];
    const reps = prescribed.durationSeconds ? 0 : Number(input?.reps ?? (existing?.reps ?? prescribed.reps));
    const weight = input?.weight ?? (existing?.loadKg === undefined ? '' : String(existing.loadKg * (unit === 'lbs' ? 2.2046226218 : 1)));
    const loadKg = weight === '' ? undefined : Number(weight) / (unit === 'lbs' ? 2.2046226218 : 1);
    if ((!prescribed.durationSeconds && (input?.reps === '' || !Number.isInteger(reps) || reps < 1 || reps > 1000)) || (loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 1000))) throw new Error('Enter 1–1000 whole reps and a valid weight, or leave weight blank.');
    await writeSet({ setId, exerciseId: exercise.exerciseId, setIndex: index, reps, ...(prescribed.durationSeconds ? { durationSeconds: prescribed.durationSeconds } : {}), ...(loadKg !== undefined ? { loadKg } : {}), status: 'completed', source: 'manual' });
    if (existing?.status !== 'completed') { const seconds = exerciseProgress(exercise, recordRef.current.sets ?? []) === 'completed' ? restExercises : restSets; const now = Date.now(); setRestNow(now); setRestUntil(now + seconds * 1000); }
    const values = { ...draftRef.current.values }; delete values[setId];
    changeDraft({ ...draftRef.current, values });
    setNotice(`Set ${index + 1} saved to your account.`);
    if (exerciseProgress(exercise, recordRef.current.sets ?? []) === 'completed' && existing?.status !== 'completed') advance();
  });
  const skip = () => attempt(async () => {
    for (let index = 0; index < exercise.sets; index++) {
      const setId = `${exercise.exerciseId}:${index}`;
      if (recordRef.current.sets?.some(set => set.setId === setId)) continue;
      await writeSet({ setId, exerciseId: exercise.exerciseId, setIndex: index, reps: 0, status: 'skipped', source: 'manual' });
    }
    setNotice('Unfinished sets skipped. You can revisit them before ending.'); advance();
  });
  const finish = async (seconds: number) => attempt(async () => {
    for (const row of exercises) for (let index = 0; index < row.sets; index++) {
      const setId = `${row.exerciseId}:${index}`;
      if (recordRef.current.sets?.some(set => set.setId === setId)) continue;
      await writeSet({ setId, exerciseId: row.exerciseId, setIndex: index, reps: 0, status: 'skipped', source: 'manual' });
    }
    completionRequest.current ??= { endedAt: new Date().toISOString(), exerciseResults: [], expectedRevision: recordRef.current.revision ?? 0 };
    try { showCompleted(await api.completeWorkout(workout._id, completionRequest.current)); }
    catch (error) {
      const latest = await api.getWorkout(workout._id).catch(() => null);
      if (latest?.status === 'completed') { showCompleted(latest); return; }
      throw error;
    }
  });
  const end = async (seconds: number) => {
    if (completed < total) { setEnding(seconds); return; }
    await finish(seconds);
  };
  const timeEndpoint = record.pausedAt ? Date.parse(record.pausedAt) : Date.now();
  const initialSeconds = Math.max(0, Math.floor((timeEndpoint - Date.parse(record.startedAt)) / 1000) - (record.pausedSeconds ?? 0));

  return <div className="routine-session">
    <LiveSession exercise={exercise ?? { exerciseId: record.exerciseIds[0], name: 'Workout session', equipment: '' }} workoutId={workout._id} thresholdSeconds={thresholdSeconds} contactName={contactName} contactPhone={contactPhone}
      initialSeconds={initialSeconds} initialPaused={Boolean(record.pausedAt)} onCheckpoint={checkpoint} controlsDisabled={saving}
      onPause={async paused => { const saved = await attempt(async () => { updateRecord(await api.pauseWorkout(workout._id, { paused, occurredAt: new Date().toISOString(), expectedRevision: recordRef.current.revision ?? 0 })); }); if (!saved) throw new Error('Pause state was not saved. Review the error and retry.'); }}
      onEnd={end} renderRoutine={paused => <>
        <section className="manual-settings" aria-label="Manual log settings"><div className="manual-unit"><strong>Weight unit</strong><div role="group" aria-label="Weight unit">{(['kg', 'lbs'] as const).map(value => <button type="button" key={value} aria-pressed={unit === value} onClick={() => setUnit(value)}>{value}</button>)}</div></div><h3>Rest timer</h3>{([['Between sets', restSets, setRestSets], ['Between exercises', restExercises, setRestExercises]] as const).map(([label, seconds, update]) => <div className="manual-rest" key={label}><span>{label}</span><button type="button" aria-label={`Decrease ${label.toLowerCase()} rest`} onClick={() => update(Math.max(0, seconds - 15))}>−</button><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong><button type="button" aria-label={`Increase ${label.toLowerCase()} rest`} onClick={() => update(Math.min(600, seconds + 15))}>+</button></div>)}<small>Saving a set starts the timer automatically.</small>{restUntil > 0 && <p role="status">Rest: {Math.floor(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) / 60)}:{String(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) % 60).padStart(2, '0')}</p>}</section>
        <h2 className="manual-exercises-title">Exercises · {exercises.length}</h2>
        <div className="routine-progress" role="status">{completed} of {total} sets completed · Manual logging</div>
        <nav aria-label="Workout routine"><ol>{exercises.map((row, index) => {
          const status = exerciseProgress(row, sets);
          const reachable = index <= selected || index === exercises.findIndex(item => exerciseProgress(item, sets) !== 'completed') || status !== 'upcoming';
          return <li key={row.exerciseId} className={index === selected && expanded ? 'routine-exercise-open' : ''}><button type="button" aria-current={index === selected ? 'step' : undefined} aria-expanded={index === selected && expanded} disabled={saving || !reachable} onClick={()=>{ if (index === selected) setExpanded(value => !value); else { changeDraft({ ...draftRef.current, selected: index }); setExpanded(true); } }} aria-label={`${status === 'completed' || status === 'skipped' ? 'Revisit' : 'View'} ${titleCase(row.name)}`}><span className="routine-exercise-number">{index + 1}</span><span className="routine-exercise-label"><strong>{titleCase(row.name)}</strong><small>{row.prescription ?? `${row.sets} sets`}</small></span><small>{sets.filter(set => set.exerciseId === row.exerciseId && set.status === 'completed').length}/{row.sets}</small><span aria-hidden="true">⌄</span></button>{index === selected && expanded && <section aria-label="Current exercise" className="routine-current"><p className="routine-help">Blank weight means no added load.</p>
          <div className="routine-set-heading" aria-hidden="true"><span>Set</span><span>{/body\s*weight|bodyweight|none/i.test(exercise.equipment) ? 'Load' : unit}</span><span>{prescribedWork(exercise.prescription).durationSeconds ? 'Time' : 'Reps'}</span><span /></div>
          {Array.from({ length: exercise.sets }, (_, index) => {
            const setId = `${exercise.exerciseId}:${index}`, saved = sets.find(set => set.setId === setId), input = draft.values[setId], prescribed = prescribedWork(exercise.prescription);
            const values = { reps: input?.reps ?? String(saved?.status === 'completed' ? saved.reps : prescribed.reps || ''), weight: input?.weight ?? (saved?.loadKg === undefined ? '' : String(unit === 'kg' ? saved.loadKg : Math.round(saved.loadKg * 2.2046226218 * 100) / 100)) };
            const bodyweight = /body\s*weight|bodyweight|none/i.test(exercise.equipment);
            const change = (key: 'reps' | 'weight', value: string) => changeDraft({ ...draftRef.current, values: { ...draftRef.current.values, [setId]: { ...values, [key]: value } } });
            return <form key={setId} className="routine-set" onSubmit={event=>{event.preventDefault();void save(index);}}><h3><span className="visually-hidden">Set </span>{index + 1}<small className="visually-hidden"> {saved?.status ?? 'Not saved'}</small></h3>
              {!bodyweight && <label><span className="visually-hidden">Weight ({unit})</span><input type="number" inputMode="decimal" min={0} max={unit === 'kg' ? 1000 : 2204.62} step="any" value={values.weight} disabled={paused || saving} aria-label={`Weight (${unit}), set ${index + 1}`} onChange={event=>change('weight',event.target.value)}/></label>}
              {bodyweight && <p>Bodyweight · no added load</p>}
              {prescribed.durationSeconds ? <p>{prescribed.durationSeconds} sec</p> : <label><span className="visually-hidden">Reps</span><input type="number" inputMode="numeric" min={1} max={1000} step={1} required value={values.reps} disabled={paused || saving} aria-label={`Reps, set ${index + 1}`} onChange={event=>change('reps',event.target.value)}/></label>}
              <button type="submit" className={saved?.status === 'completed' ? 'is-saved' : undefined} aria-label={`${saved?.status === 'completed' ? 'Update' : 'Save'} set ${index + 1}`} disabled={paused || saving}><Icon name="check" size={18}/></button>
            </form>;
          })}
          <button type="button" disabled={paused || saving} onClick={()=>void skip()}>Skip exercise</button>
        </section>}</li>;
        })}</ol></nav>
        {storageError && <p role="alert">Device draft storage is unavailable. Unsaved inputs will be lost if you close the app.</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
      </>}/>
    <dialog ref={restDialog} className="routine-rest-dialog" aria-labelledby="routine-rest-title" onCancel={event => { event.preventDefault(); setRestUntil(0); }}><h2 id="routine-rest-title">Rest time</h2><p>Take a breath before your next set.</p><strong role="timer" aria-label="Rest time remaining">{Math.floor(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) / 60)}:{String(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) % 60).padStart(2, '0')}</strong><div className="routine-rest-actions"><button type="button" onClick={() => setRestUntil(until => until + 60000)}>+1 min</button><button type="button" onClick={() => setRestUntil(0)}>End rest</button></div></dialog>
    {ending !== null && <dialog ref={endDialog} aria-labelledby="routine-end-title" className="routine-end-dialog" onCancel={event=>{event.preventDefault();if(!saving)setEnding(null);}}><h2 id="routine-end-title">End workout early?</h2><p>{total - completed} sets are not completed. Remaining sets will be saved as skipped. Unsaved inputs are not counted.</p>{error && <p role="alert">{error}</p>}<button type="button" disabled={saving} onClick={()=>{completionRequest.current=null;setEnding(null);}}>Keep training</button><button type="button" disabled={saving} onClick={()=>void finish(ending)}>{saving ? 'Saving…' : 'Save and end workout'}</button></dialog>}
  </div>;
}
