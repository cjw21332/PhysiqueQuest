'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, getApiBaseUrl, type WorkoutSessionRecord, type WorkoutSetResult } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import LiveSession from './LiveSession';
import { exerciseProgress, prescribedWork } from './workoutRoutine';

type Draft = { selected: number; values: Record<string, { reps: string; weight: string }>; checkpoint?: string };
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
      return { selected: value.selected, values, checkpoint: typeof value.checkpoint === 'string' && Number.isFinite(Date.parse(value.checkpoint)) ? value.checkpoint : undefined };
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
    const weight = input?.weight ?? (existing?.loadKg === undefined ? '' : String(existing.loadKg));
    if ((!prescribed.durationSeconds && (input?.reps === '' || !Number.isInteger(reps) || reps < 1 || reps > 1000)) || (weight !== '' && (!Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 1000))) throw new Error('Enter 1–1000 whole reps and a weight from 0–1000 kg, or leave weight blank.');
    await writeSet({ setId, exerciseId: exercise.exerciseId, setIndex: index, reps, ...(prescribed.durationSeconds ? { durationSeconds: prescribed.durationSeconds } : {}), ...(weight !== '' ? { loadKg: Number(weight) } : {}), status: 'completed', source: 'manual' });
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
        <div className="routine-progress" role="status">{completed} of {total} sets completed · Manual logging</div>
        <nav aria-label="Workout routine"><ol>{exercises.map((row, index) => {
          const status = exerciseProgress(row, sets);
          const reachable = index <= selected || index === exercises.findIndex(item => exerciseProgress(item, sets) !== 'completed') || status !== 'upcoming';
          return <li key={row.exerciseId}><button type="button" aria-current={index === selected ? 'step' : undefined} disabled={saving || !reachable} onClick={()=>changeDraft({ ...draftRef.current, selected: index })} aria-label={`${status === 'completed' || status === 'skipped' ? 'Revisit' : 'View'} ${row.name}`}><span>{index + 1}. {row.name}</span><small>{index === selected ? 'Current · ' : ''}{status}</small></button></li>;
        })}</ol></nav>
        {exercise ? <section aria-label="Current exercise" className="routine-current"><h2>{exercise.name}</h2><p>{exercise.prescription ?? 'Record the work you performed.'}</p><p className="routine-help">Save each set after you do it. Prescribed values are not measured. Blank weight means no added load.</p>
          {Array.from({ length: exercise.sets }, (_, index) => {
            const setId = `${exercise.exerciseId}:${index}`, saved = sets.find(set => set.setId === setId), input = draft.values[setId], prescribed = prescribedWork(exercise.prescription);
            const values = { reps: input?.reps ?? String(saved?.status === 'completed' ? saved.reps : prescribed.reps || ''), weight: input?.weight ?? (saved?.loadKg === undefined ? '' : String(saved.loadKg)) };
            const bodyweight = /body\s*weight|bodyweight|none/i.test(exercise.equipment);
            const change = (key: 'reps' | 'weight', value: string) => changeDraft({ ...draftRef.current, values: { ...draftRef.current.values, [setId]: { ...values, [key]: value } } });
            return <form key={setId} className="routine-set" onSubmit={event=>{event.preventDefault();void save(index);}}><h3>Set {index + 1} <small>{saved?.status ?? 'Not saved'}</small></h3>
              {prescribed.durationSeconds ? <p>Confirm {prescribed.durationSeconds} seconds completed</p> : <label>Reps<input type="number" inputMode="numeric" min={1} max={1000} step={1} required value={values.reps} disabled={paused || saving} aria-label={`Reps, set ${index + 1}`} onChange={event=>change('reps',event.target.value)}/></label>}
              {!bodyweight && <label>Weight (kg)<input type="number" inputMode="decimal" min={0} max={1000} step="any" value={values.weight} disabled={paused || saving} aria-label={`Weight (kg), set ${index + 1}`} onChange={event=>change('weight',event.target.value)}/></label>}
              {bodyweight && <p>Bodyweight · no added load</p>}
              <button type="submit" disabled={paused || saving}>{saved?.status === 'completed' ? 'Update' : 'Save'} set {index + 1}</button>
            </form>;
          })}
          <button type="button" disabled={paused || saving} onClick={()=>void skip()}>Skip exercise</button>
        </section> : <p>This older workout has no routine snapshot. You can finish it, but no sets will be invented.</p>}
        <p className="routine-help">Saved sets are on your account and editable until you end. Unsaved inputs stay on this device; reopen Coach to resume.</p>
        {storageError && <p role="alert">Device draft storage is unavailable. Unsaved inputs will be lost if you close the app.</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
      </>}/>
    {ending !== null && <dialog ref={endDialog} aria-labelledby="routine-end-title" className="routine-end-dialog" onCancel={event=>{event.preventDefault();if(!saving)setEnding(null);}}><h2 id="routine-end-title">End workout early?</h2><p>{total - completed} sets are not completed. Remaining sets will be saved as skipped. Unsaved inputs are not counted.</p>{error && <p role="alert">{error}</p>}<button type="button" disabled={saving} onClick={()=>{completionRequest.current=null;setEnding(null);}}>Keep training</button><button type="button" disabled={saving} onClick={()=>void finish(ending)}>{saving ? 'Saving…' : 'Save and end workout'}</button></dialog>}
  </div>;
}
