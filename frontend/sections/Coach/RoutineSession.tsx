'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, getApiBaseUrl, type WorkoutSessionRecord, type WorkoutSetResult } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import LiveSession from './LiveSession';
import { Icon } from '../Home/icons';
import { DEFAULT_REST_SECONDS, exerciseProgress, prescribedWork, plannedLoadKg, plannedLoadUnit, plannedOnBar } from './workoutRoutine';
import WorkoutFeedback from './WorkoutFeedback';
import { titleCase } from '../../lib/titleCase';
import WorkoutKeypad from './WorkoutKeypad';
import WorkoutEditor from './WorkoutEditor';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { suggestedWorkingSet } from '../../lib/trainingProgress';

type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
const STATUS_META = { completed: { label: 'Done', icon: 'check-circle' }, 'in progress': { label: 'In progress', icon: 'pulse' }, upcoming: { label: 'Up next', icon: 'clock' }, skipped: { label: 'Skipped', icon: 'minus-circle' } } as const;
type Draft = { selected: number; values: Record<string, { reps: string; weight: string }>; checkpoint?: string; unit?: 'kg' | 'lbs'; units?: Record<string, 'kg' | 'lbs'>; setTypes?: Record<string, SetType> };
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
      const units = Object.fromEntries(Object.entries(value.units ?? {}).filter(([, unit]) => unit === 'kg' || unit === 'lbs')) as Draft['units'];
      const setTypes = Object.fromEntries(Object.entries(value.setTypes ?? {}).filter(([, type]) => ['normal','warmup','drop','failure'].includes(String(type)))) as Draft['setTypes'];
      return { selected: value.selected, values, units, setTypes, unit: value.unit === 'kg' ? 'kg' : 'lbs', checkpoint: typeof value.checkpoint === 'string' && Number.isFinite(Date.parse(value.checkpoint)) ? value.checkpoint : undefined };
    }
  } catch { /* A damaged or unavailable device draft never replaces server records. */ }
  return { selected: 0, values: {} };
}

export default function RoutineSession({ workout, thresholdSeconds, contactName, contactPhone, onSaved, onComplete, mode = 'manual', title = 'Workout session', onCancel }: {
  workout: WorkoutSessionRecord; thresholdSeconds: number; contactName: string; contactPhone: string;
  mode?: 'live' | 'manual'; title?: string; onCancel?: () => void;
  onSaved: (record: WorkoutSessionRecord) => void; onComplete: (record: WorkoutSessionRecord) => void;
}) {
  const [record, setRecord] = useState(workout);
  const [barWeights, setBarWeights] = useState<Record<string, string>>({});
  const { workouts: history, workoutLoading: historyLoading, workoutError: historyError } = useWorkoutHistory();
  const recordRef = useRef(workout);
  const [draft, setDraft] = useState(() => readWorkoutDraft(workout._id));
  const draftRef = useRef(draft);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [menu, setMenu] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState(0);
  const [restNow, setRestNow] = useState(Date.now());
  const restDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!restUntil) return; const timer = window.setInterval(() => { const now = Date.now(); setRestNow(now); if (now >= restUntil) setRestUntil(0); }, 1000); return () => window.clearInterval(timer); }, [restUntil]);
  // Exercise just finished: its quick review keeps the rest dialog open after the timer ends.
  const [reviewing, setReviewing] = useState<string | null>(null);
  useEffect(() => {
    const dialog = restDialog.current;
    if ((restUntil || reviewing) && dialog && !dialog.open) dialog.showModal();
    if (!restUntil && !reviewing && dialog?.open) dialog.close();
  }, [restUntil, reviewing]);
  const endRest = () => { setRestUntil(0); setReviewing(null); };
  const [cancelling, setCancelling] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [editor, setEditor] = useState<{ kind: 'routine' | 'rename' | 'replace'; id?: string } | null>(null);
  const [keypad, setKeypad] = useState<{ setId: string; field: 'weight' | 'reps'; values: { weight: string; reps: string } } | null>(null);
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
  const barDescription = `${exercise?.name ?? ''} ${exercise?.equipment ?? ''}`;
  const usesEstimatedBar = /smith|ez.?bar|barbell/i.test(barDescription) && !/t.?bar/i.test(barDescription);
  const suggestion = exercise && !historyLoading && !historyError && !prescribedWork(exercise.prescription).durationSeconds
    ? suggestedWorkingSet(history, exercise.exerciseId, exercise.equipment, record.startedAt, usesEstimatedBar) : null;
  const hasExerciseDraft = exercise && Object.keys(draft.values).some(key => key.startsWith(`${exercise.exerciseId}:`));
  const plannedUnit = plannedLoadUnit(exercise?.prescription);
  const unit = (exercise && draft.units?.[exercise.exerciseId]) || record.sets?.find(set => set.exerciseId === exercise?.exerciseId && set.loadUnit)?.loadUnit || (hasExerciseDraft ? draft.unit : suggestion?.preferredUnit ?? plannedUnit) || draft.unit || 'lbs';
  const defaultBarKg = /smith/i.test(barDescription) ? 20 : /ez.?bar/i.test(barDescription) ? 10 : 20;
  const barInput = exercise ? (barWeights[exercise.exerciseId] ?? String(record.sets?.find(set => set.exerciseId === exercise.exerciseId && set.barWeightKg !== undefined)?.barWeightKg ?? defaultBarKg)) : String(defaultBarKg);
  const estimatedBarKg = Number(barInput);
  const displayedLoad = (set: WorkoutSetResult) => set.barWeightKg !== undefined && set.loadKg !== undefined ? Math.max(0, set.loadKg - set.barWeightKg) * (unit === 'lbs' ? 2.2046226218 : 1) : set.loadUnit === unit && set.loadValue !== undefined ? set.loadValue : (set.loadKg ?? 0) * (unit === 'lbs' ? 2.2046226218 : 1);
  const defaultSetValues = (saved: WorkoutSetResult | undefined, input: { reps: string; weight: string } | undefined, setType: SetType, index: number) => {
    const prescribed = prescribedWork(exercise?.prescription);
    const workingIndex = Array.from({ length: index }, (_, i) => {
      const id = `${exercise.exerciseId}:${i}`;
      return draft.setTypes?.[id] ?? record.sets?.find(set => set.setId === id)?.setType ?? 'normal';
    }).filter(type => type === 'normal').length;
    const suggest = !saved && setType === 'normal' && suggestion
      ? suggestedWorkingSet(history, exercise.exerciseId, exercise.equipment, record.startedAt, usesEstimatedBar, workingIndex) : null;
    // Without history, fall back to the program's planned load (bar excluded where the field logs plates only).
    const planned = !suggest && setType === 'normal' ? plannedLoadKg(exercise?.prescription) : undefined;
    // "Bar + 25 kg" is already the added plates; only a plain total has the bar taken off.
    const suggestedKg = suggest?.weightKg ?? (planned === undefined ? undefined : Math.max(0, planned - (usesEstimatedBar && !plannedOnBar(exercise?.prescription) ? estimatedBarKg || 0 : 0)));
    const suggestedWeight = suggestedKg === undefined ? '' : String(Number((suggestedKg * (unit === 'lbs' ? 2.2046226218 : 1)).toFixed(unit === 'lbs' ? 0 : 1)));
    return {
      reps: input?.reps ?? String(saved?.status === 'completed' ? saved.reps : suggest?.reps ?? (prescribed.reps || '')),
      weight: input?.weight ?? (saved?.loadKg === undefined ? suggestedWeight : String(Number(displayedLoad(saved).toFixed(2)))),
    };
  };
  useEffect(() => { setKeypad(null); setMenu(null); setReordering(null); }, [exercise?.exerciseId]);
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
  const setUnit = (next: 'kg' | 'lbs') => { if (!exercise || next === unit) return; const factor = next === 'lbs' ? 2.2046226218 : 1 / 2.2046226218; const values = Object.fromEntries(Object.entries(draftRef.current.values).map(([key, value]) => [key, key.startsWith(`${exercise.exerciseId}:`) ? { ...value, weight: value.weight === '' ? '' : String(Math.round(Number(value.weight) * factor * 100) / 100) } : value])); changeDraft({ ...draftRef.current, units: { ...draftRef.current.units, [exercise.exerciseId]: next }, values }); };
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
        completionRequest.current = null;
        try { const latest = await api.getWorkout(workout._id); if (latest.status === 'completed') { showCompleted(latest); return true; } updateRecord(latest); message = 'Workout changed on another screen. Latest saved sets loaded; review your inputs and retry.'; }
        catch { message += ' Could not reload the workout. Reopen Coach before retrying.'; }
      }
      setError(message);
      return false;
    } finally { locked.current = false; setSaving(false); }
  };
  const changeRoutine = async (rows: typeof exercises, routineName?: string) => {
    const currentId = exercise?.exerciseId;
    return attempt(async () => {
      const next = await api.updateWorkoutRoutine(workout._id, recordRef.current.revision ?? 0, rows.map(row => ({ exerciseId: row.exerciseId, name: row.name, equipment: row.equipment, prescription: row.prescription, sets: row.sets, restBetweenSets: row.restBetweenSets ?? DEFAULT_REST_SECONDS, restAfterExercise: row.restAfterExercise ?? DEFAULT_REST_SECONDS })), routineName);
      updateRecord(next);
      const newIndex = (next.exercises ?? []).findIndex(row => row.exerciseId === currentId);
      changeDraft({ ...draftRef.current, values: Object.fromEntries(Object.entries(draftRef.current.values).filter(([key]) => next.exercises?.some(row => key.startsWith(`${row.exerciseId}:`)))), selected: newIndex < 0 ? Math.min(selected, Math.max(0, (next.exercises?.length ?? 1) - 1)) : newIndex });
    });
  };
  const moveExercise = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    const rows = [...exercises];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    void changeRoutine(rows).then(ok => { if (ok) setReordering(null); });
  };
  const writeSet = async (result: WorkoutSetResult) => {
    const next = await api.saveWorkoutSet(workout._id, recordRef.current.revision ?? 0, result);
    updateRecord(next);
  };
  const advance = () => {
    const next = exercises.findIndex((row, index) => index > selected && ['upcoming', 'in progress'].includes(exerciseProgress(row, recordRef.current.sets ?? [])));
    if (next >= 0) changeDraft({ ...draftRef.current, selected: next });
  };
  const save = (index: number) => attempt(async () => {
    const setId = `${exercise.exerciseId}:${index}`;
    const prescribed = prescribedWork(exercise.prescription);
    const existing = sets.find(set => set.setId === setId);
    const input = draftRef.current.values[setId];
    const values = defaultSetValues(existing, input, draftRef.current.setTypes?.[setId] ?? existing?.setType ?? 'normal', index);
    const reps = prescribed.durationSeconds ? 0 : Number(values.reps);
    const weight = values.weight;
    const addedKg = weight === '' ? undefined : Number(weight) / (unit === 'lbs' ? 2.2046226218 : 1);
    if (usesEstimatedBar && (!barInput.trim() || !Number.isFinite(estimatedBarKg) || estimatedBarKg < 0 || estimatedBarKg > 100)) throw new Error('Enter a bar weight between 0 and 100 kg.');
    const loadKg = addedKg === undefined ? undefined : addedKg + (usesEstimatedBar ? estimatedBarKg : 0);
    if ((!prescribed.durationSeconds && (input?.reps === '' || !Number.isInteger(reps) || reps < 1 || reps > 1000)) || (loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 1000))) throw new Error('Enter 1–1000 whole reps and a valid weight, or leave weight blank.');
    await writeSet({ setId, exerciseId: exercise.exerciseId, setIndex: index, reps, setType: draftRef.current.setTypes?.[setId] ?? existing?.setType ?? 'normal', ...(prescribed.durationSeconds ? { durationSeconds: prescribed.durationSeconds } : {}), ...(loadKg !== undefined ? { loadKg, loadValue: loadKg * (unit === 'lbs' ? 2.2046226218 : 1), loadUnit: unit, ...(usesEstimatedBar ? { barWeightKg: estimatedBarKg } : {}) } : {}), status: 'completed', source: 'manual' });
    if (existing?.status !== 'completed') { const done = exerciseProgress(exercise, recordRef.current.sets ?? []) === 'completed'; const seconds = done ? exercise.restAfterExercise ?? DEFAULT_REST_SECONDS : exercise.restBetweenSets ?? DEFAULT_REST_SECONDS; const now = Date.now(); setRestNow(now); setRestUntil(seconds > 0 ? now + seconds * 1000 : 0); if (done) setReviewing(exercise.name); }
    const remainingValues = { ...draftRef.current.values }; delete remainingValues[setId];
    const setTypes = { ...draftRef.current.setTypes }; delete setTypes[setId];
    changeDraft({ ...draftRef.current, values: remainingValues, setTypes });
    setNotice(`Set ${index + 1} saved to ${workout._id.startsWith('local-') ? 'this device' : 'your account'}.`);
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
      routineTitle={editingTitle ? <form className="manual-title-edit" onSubmit={event => {
        event.preventDefault();
        const name = titleInput.trim();
        if (!name || saving) return;
        if (name === (record.routineName || title)) { setEditingTitle(false); return; }
        void changeRoutine(exercises, name).then(ok => { if (ok) setEditingTitle(false); });
      }}>
        <input autoFocus aria-label="Workout session name" maxLength={120} required value={titleInput} disabled={saving} onChange={event => setTitleInput(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && !saving) { setEditingTitle(false); setError(''); } }} />
        <div className="manual-title-actions"><button type="button" disabled={saving} onClick={() => { setEditingTitle(false); setError(''); }}>Cancel</button><button type="submit" disabled={saving || !titleInput.trim()}>{saving ? 'Saving…' : 'Save'}</button></div>
        {error && <p className="manual-title-error" role="alert">{error}</p>}
      </form> : <div className="manual-title-edit"><h1>{record.routineName || title}</h1><button type="button" disabled={saving} onClick={() => { setTitleInput(record.routineName || title); setError(''); setEditingTitle(true); }}>Edit</button></div>} onCancel={() => setCancelling(true)}
      initialSeconds={initialSeconds} initialPaused={Boolean(record.pausedAt)} onCheckpoint={checkpoint} controlsDisabled={saving}
      onPause={async paused => { const saved = await attempt(async () => { updateRecord(await api.pauseWorkout(workout._id, { paused, occurredAt: new Date().toISOString(), expectedRevision: recordRef.current.revision ?? 0 })); }); if (!saved) throw new Error('Pause state was not saved. Review the error and retry.'); }}
      onEnd={end} renderRoutine={mode === 'manual' ? paused => <div className="ml">
        <section className="ml-hero" aria-label="Workout progress">
          <div className="ml-ring-wrap" aria-hidden="true">
            <svg className="ml-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" className="ml-ring-track"/><circle cx="32" cy="32" r="27" className="ml-ring-fill" style={{ strokeDasharray: `${(total ? completed / total : 0) * 169.6} 169.6` }}/></svg>
            <span className="ml-ring-pct">{total ? Math.round(completed / total * 100) : 0}%</span>
          </div>
          <div className="ml-hero-copy">
            <span className="ml-chip"><Icon name="edit" size={12}/> Manual log</span>
            <strong className="routine-progress" role="status">{completed} of {total} sets completed</strong>
            <small>{exercises.filter(row => ['completed', 'skipped'].includes(exerciseProgress(row, sets))).length} of {exercises.length} exercises finished</small>
          </div>
          <div className="ml-segments" aria-hidden="true">{exercises.map((row, index) => { const status = exerciseProgress(row, sets); const doneSets = sets.filter(set => set.exerciseId === row.exerciseId && set.status === 'completed').length; return <span key={row.exerciseId} className={`ml-seg is-${status.replace(' ', '-')}${index === selected ? ' is-current' : ''}`}><i style={{ width: `${row.sets ? doneSets / row.sets * 100 : 0}%` }}/></span>; })}</div>
        </section>
        <h2 className="ml-section-title">Exercises <span>{exercises.length}</span></h2>
        <nav aria-label="Workout routine" className="ml-list">{exercises.map((row, index) => {
          const status = exerciseProgress(row, sets);
          const meta = STATUS_META[status];
          const work = prescribedWork(row.prescription);
          const doneSets = sets.filter(set => set.exerciseId === row.exerciseId && set.status === 'completed').length;
          const open = index === selected && expanded;
          return <div key={row.exerciseId} className={`ml-ex is-${status.replace(' ', '-')}${open ? ' is-open' : ''}${index === selected ? ' is-selected' : ''}`}>
          <div className="ml-ex-head">
            <button type="button" className="ml-ex-toggle" aria-current={index === selected ? 'step' : undefined} aria-expanded={open} disabled={saving} onClick={()=>{ if (index === selected) setExpanded(value => !value); else { changeDraft({ ...draftRef.current, selected: index }); setExpanded(true); } }} aria-label={`${status === 'completed' || status === 'skipped' ? 'Revisit' : 'View'} ${titleCase(row.name)}`}>
              <span className="ml-ex-num">{status === 'completed' ? <Icon name="check" size={16}/> : index + 1}</span>
              <span className="ml-ex-label"><strong>{titleCase(row.name)}</strong><small>{row.sets} sets · {work.durationSeconds ? `${work.durationSeconds} sec` : `${work.reps || '—'} reps`}</small>
                <span className="ml-ex-status"><span className={`ml-badge is-${status.replace(' ', '-')}`}><Icon name={meta.icon} size={12}/>{meta.label}</span><span className="ml-dots">{Array.from({ length: row.sets }, (_, i) => <i key={i} className={i < doneSets ? 'on' : ''}/>)}</span></span>
              </span>
              <span className="ml-ex-chevron" aria-hidden="true"><Icon name="chevron-down" size={18}/></span>
            </button>
            <div className="ml-ex-actions"><button type="button" aria-label={`Reorder ${titleCase(row.name)}`} aria-expanded={reordering === row.exerciseId} disabled={saving || paused || exercises.length < 2} onClick={() => { setMenu(null); setReordering(reordering === row.exerciseId ? null : row.exerciseId); }}><Icon name="reorder" size={19}/></button><button type="button" disabled={saving || paused} aria-label={`Options for ${titleCase(row.name)}`} aria-expanded={menu === row.exerciseId} onClick={() => { setReordering(null); setMenu(menu === row.exerciseId ? null : row.exerciseId); }}><Icon name="more" size={19}/></button></div>
          </div>
          {reordering === row.exerciseId && <div className="ml-panel ml-reorder"><button type="button" disabled={saving || paused || index === 0} onClick={() => moveExercise(index, -1)}><Icon name="arrow-up" size={16}/> Move up</button><button type="button" disabled={saving || paused || index === exercises.length - 1} onClick={() => moveExercise(index, 1)}><Icon name="arrow-down" size={16}/> Move down</button></div>}
          {menu === row.exerciseId && <div className="ml-panel ml-menu">
            <div className="ml-menu-actions"><button type="button" disabled={saving || paused} onClick={() => { setError(''); setEditor({ kind: 'rename', id: row.exerciseId }); }}><Icon name="edit" size={16}/>Rename exercise</button><button type="button" disabled={saving || paused || sets.some(set => set.exerciseId === row.exerciseId)} onClick={() => { setError(''); setEditor({ kind: 'replace', id: row.exerciseId }); }}><Icon name="retake" size={16}/>Replace exercise</button><button type="button" disabled={saving || paused || index !== selected} onClick={() => void skip()}><Icon name="arrow" size={16}/>Skip exercise</button></div>
            <strong className="ml-menu-title"><Icon name="clock" size={14}/> Rest for {titleCase(row.name)}</strong>
            {([['Between sets', 'restBetweenSets', row.restBetweenSets ?? DEFAULT_REST_SECONDS], ['Before next exercise', 'restAfterExercise', row.restAfterExercise ?? DEFAULT_REST_SECONDS]] as const).map(([label,key,seconds]) => <div className="ml-rest" key={key}><span>{label}</span><div className="ml-stepper"><button type="button" aria-label={`Decrease ${label.toLowerCase()} rest for ${titleCase(row.name)}`} disabled={saving || paused || seconds <= 0} onClick={() => void changeRoutine(exercises.map(item => item.exerciseId === row.exerciseId ? { ...item, [key]: Math.max(0, seconds - 15) } : item))}><Icon name="minus" size={16}/></button><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2,'0')}</b><button type="button" aria-label={`Increase ${label.toLowerCase()} rest for ${titleCase(row.name)}`} disabled={saving || paused || seconds >= 600} onClick={() => void changeRoutine(exercises.map(item => item.exerciseId === row.exerciseId ? { ...item, [key]: Math.min(600, seconds + 15) } : item))}><Icon name="plus" size={16}/></button></div></div>)}
            <button type="button" className="ml-danger" disabled={saving || paused || exercises.length <= 1 || sets.some(set => set.exerciseId === row.exerciseId)} onClick={() => setRemoving(row.exerciseId)}><Icon name="trash" size={16}/>Remove exercise</button>
            <small>Exercises with saved sets cannot be removed or replaced.</small>
          </div>}
          {open && <section aria-label="Current exercise" className="routine-current ml-current">
            <div className="ml-toolbar"><span className="ml-toolbar-label">Weight unit</span><div className="ml-segmented" role="group" aria-label={`Weight unit for ${titleCase(row.name)}`}>{(['lbs', 'kg'] as const).map(value => <button type="button" key={value} aria-pressed={unit === value} disabled={paused || saving} onClick={() => setUnit(value)}>{value}</button>)}</div></div>
            {usesEstimatedBar && <label className="ml-bar">Bar estimate (kg) <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={barInput} disabled={paused || saving} onChange={event => setBarWeights(current => ({ ...current, [exercise.exerciseId]: event.target.value }))}/></label>}
            {!prescribedWork(exercise.prescription).durationSeconds && <aside className="ml-tip"><span className="ml-tip-icon" aria-hidden="true"><Icon name="lightbulb" size={16}/></span><span><strong>Suggested starting point</strong><p>{historyLoading ? 'Loading your last workout…' : historyError ? 'History is unavailable. Enter your own values.' : suggestion ? suggestion.unknownBar ? 'Check the bar weight and enter your added plates.' : suggestion.note : plannedLoadKg(exercise.prescription) !== undefined ? 'Weight prefilled from your program. Adjust it after the first set.' : 'No previous working set. Enter your own values.'}</p>{suggestion && <small>Suggestions are editable. Adjust to how you feel.</small>}</span></aside>}
            <p className="ml-help">{usesEstimatedBar ? 'Enter added plates. Total includes the estimated bar.' : 'Tap a value to edit, then tick to log the set. Blank weight means no added load.'}</p>
            <div className="ml-sets">
            {Array.from({ length: exercise.sets }, (_, index) => {
              const setId = `${exercise.exerciseId}:${index}`, saved = sets.find(set => set.setId === setId), input = draft.values[setId], prescribed = prescribedWork(exercise.prescription);
              const setType = draft.setTypes?.[setId] ?? saved?.setType ?? 'normal';
              const values = defaultSetValues(saved, input, setType, index);
              const bodyweight = /body\s*weight|bodyweight|none/i.test(exercise.equipment);
              const change = (key: 'reps' | 'weight', value: string) => changeDraft({ ...draftRef.current, values: { ...draftRef.current.values, [setId]: { ...values, [key]: value } } });
              return <form key={setId} className={`ml-set is-${setType}${saved?.status === 'completed' ? ' is-done' : saved?.status === 'skipped' ? ' is-skipped' : ''}`} onSubmit={event=>{event.preventDefault();void save(index);}}>
                <label className="ml-set-type"><span className="visually-hidden">Set type for set {index + 1}</span><select aria-label={`Set type for set ${index + 1}`} disabled={paused || saving} value={setType} onChange={event=>changeDraft({ ...draftRef.current, setTypes: { ...draftRef.current.setTypes, [setId]: event.target.value as SetType } })}><option value="normal" aria-label="Normal set">{index + 1}</option><option value="warmup" aria-label="Warm-up set">W</option><option value="drop" aria-label="Drop set">D</option><option value="failure" aria-label="Failure set">F</option></select></label>
                {!bodyweight && <label className="ml-field"><span className="ml-field-label" aria-hidden="true">{unit}</span><input type="text" inputMode="none" onClick={() => setKeypad({ setId, field: 'weight', values })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setKeypad({ setId, field: 'weight', values }); } }} min={0} max={unit === 'kg' ? 1000 : 2204.62} step="any" value={values.weight} placeholder="—" disabled={paused || saving} aria-label={`Weight (${unit}), set ${index + 1}`} onChange={event=>{ if (/^\d*(\.\d*)?$/.test(event.target.value) && event.target.value.length <= 8) change('weight',event.target.value); }}/></label>}
                {bodyweight && <p className="ml-field ml-static"><span className="ml-field-label">Load</span>Bodyweight</p>}
                {prescribed.durationSeconds ? <p className="ml-field ml-static"><span className="ml-field-label">Time</span>{prescribed.durationSeconds} sec</p> : <label className="ml-field"><span className="ml-field-label" aria-hidden="true">reps</span><input type="text" inputMode="none" onClick={() => setKeypad({ setId, field: 'reps', values })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setKeypad({ setId, field: 'reps', values }); } }} min={1} max={1000} step={1} required value={values.reps} placeholder="0" disabled={paused || saving} aria-label={`Reps, set ${index + 1}`} onChange={event=>{ if (/^\d*$/.test(event.target.value) && event.target.value.length <= 4) change('reps',event.target.value); }}/></label>}
                <button type="submit" className={`ml-set-save${saved?.status === 'completed' ? ' is-saved' : ''}`} aria-label={`${saved?.status === 'completed' ? 'Update' : 'Save'} set ${index + 1}`} disabled={paused || saving || (historyLoading && !saved && !input)}><Icon name="check" size={20}/></button>
              </form>;
            })}
            </div>
            <button type="button" className="ml-add-set" disabled={paused || saving || exercise.sets >= 10} onClick={() => void changeRoutine(exercises.map(item => item.exerciseId === exercise.exerciseId ? { ...item, sets: item.sets + 1 } : item))}>{exercise.sets >= 10 ? '10-set limit reached' : <><Icon name="plus" size={16}/> Add set</>}</button>
            {exercises.length > 1 && <div className="ml-pager"><button type="button" disabled={saving || selected === 0} onClick={() => changeDraft({ ...draftRef.current, selected: selected - 1 })}><Icon name="chevron-left" size={16}/> Previous</button><button type="button" className="is-next" disabled={saving || selected >= exercises.length - 1} onClick={() => changeDraft({ ...draftRef.current, selected: selected + 1 })}>Next exercise <Icon name="chevron-right" size={16}/></button></div>}
          </section>}</div>;
        })}</nav>
        {storageError && <p className="ml-alert is-warn" role="alert"><Icon name="warning" size={16}/>Device draft storage is unavailable. Unsaved inputs will be lost if you close the app.</p>}
        {notice && <p className="ml-alert is-ok" role="status"><Icon name="check-circle" size={16}/>{notice}</p>}
        {error && <p className="ml-alert is-error" role="alert"><Icon name="warning" size={16}/>{error}</p>}
      </div> : undefined}/>
    {keypad && <WorkoutKeypad key={`${keypad.setId}:${keypad.field}`} field={keypad.field} value={keypad.values[keypad.field]} unit={unit} onClose={() => setKeypad(null)} onApply={(value, nextUnit) => {
      if (keypad.field === 'weight') setUnit(nextUnit);
      const values = draftRef.current.values[keypad.setId] ?? keypad.values;
      changeDraft({ ...draftRef.current, values: { ...draftRef.current.values, [keypad.setId]: { ...values, [keypad.field]: value } } });
    }}/>}
    {editor && <WorkoutEditor title={editor.kind === 'routine' ? 'Rename routine' : editor.kind === 'rename' ? 'Rename exercise' : 'Replace exercise'} initialName={editor.kind === 'routine' ? record.routineName || title : exercises.find(row => row.exerciseId === editor.id)?.name || ''} replacing={editor.kind === 'replace'} busy={saving} error={error} excludedIds={exercises.map(row => row.exerciseId)} onClose={() => setEditor(null)} onSave={name => { void changeRoutine(editor.kind === 'routine' ? exercises : exercises.map(row => row.exerciseId === editor.id ? { ...row, name } : row), editor.kind === 'routine' ? name : undefined).then(ok => { if (ok) setEditor(null); }); }} onReplace={item => {
      void changeRoutine(exercises.map(row => row.exerciseId === editor.id ? { ...row, exerciseId: item._id, name: item.name, equipment: item.equipment || item.equipments?.join(', ') || '', prescription: '1 x 10' } : row)).then(ok => { if (ok) { setEditor(null); setMenu(null); } });
    }}/>}
    {cancelling && <DeleteConfirmation title="Cancel workout?" description="This discards this workout and all its sets. It will not count toward your progress. Choose End session instead to keep your logged sets." confirmLabel="Discard workout" busy={saving} error={error} onCancel={() => setCancelling(false)} onConfirm={() => void attempt(async () => { await api.cancelWorkout(workout._id, recordRef.current.revision ?? 0); try { localStorage.removeItem(workoutDraftKey(workout._id)); } catch {} onCancel?.(); })}/>}
    {removing && <DeleteConfirmation title="Remove this exercise?" description={`${titleCase(exercises.find(row => row.exerciseId === removing)?.name ?? 'This exercise')} will be removed from this workout. Exercises with saved sets cannot be removed or replaced.`} confirmLabel="Remove exercise" busy={saving} error={error} onCancel={() => { setRemoving(null); setError(''); }} onConfirm={() => { void changeRoutine(exercises.filter(row => row.exerciseId !== removing)).then(ok => { if (ok) { setRemoving(null); setMenu(null); } }); }}/>}
    <dialog ref={restDialog} className="routine-rest-dialog" aria-labelledby="routine-rest-title" onCancel={event => { event.preventDefault(); endRest(); }}><h2 id="routine-rest-title">Rest time</h2><p>{reviewing ? `${titleCase(reviewing)} done. Quick check before you move on — stop if you feel chest pain, dizziness or sharp joint pain.` : 'Take a breath before your next set.'}</p><strong role="timer" aria-label="Rest time remaining">{Math.floor(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) / 60)}:{String(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) % 60).padStart(2, '0')}</strong>{reviewing && <WorkoutFeedback key={reviewing} source="manual" exercise={reviewing} sessionRef={workout._id}/>}<div className="routine-rest-actions"><button type="button" onClick={() => setRestUntil(until => Math.max(until, Date.now()) + 60000)}>+1 min</button><button type="button" onClick={endRest}>{reviewing && !restUntil ? 'Continue' : 'End rest'}</button></div></dialog>
    {ending !== null && <dialog ref={endDialog} aria-labelledby="routine-end-title" className="routine-end-dialog" onCancel={event=>{event.preventDefault();if(!saving)setEnding(null);}}><h2 id="routine-end-title">End workout early?</h2><p>{total - completed} sets are not completed. Remaining sets will be saved as skipped. Unsaved inputs are not counted.</p>{error && <p role="alert">{error}</p>}<button type="button" disabled={saving} onClick={()=>{completionRequest.current=null;setEnding(null);}}>Keep training</button><button type="button" disabled={saving} onClick={()=>void finish(ending)}>{saving ? 'Saving…' : 'Save and end workout'}</button></dialog>}
  </div>;
}
