'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, getApiBaseUrl, type WorkoutSessionRecord, type WorkoutSetResult } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import LiveSession from './LiveSession';
import { Icon } from '../Home/icons';
import { exerciseProgress, prescribedWork } from './workoutRoutine';
import { titleCase } from '../../lib/titleCase';
import WorkoutKeypad from './WorkoutKeypad';
import WorkoutEditor from './WorkoutEditor';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { nextTrainingSuggestion } from '../../lib/trainingProgress';
import { useNutrition } from '../../hooks/useNutrition';

type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
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
  const { workouts: history, workoutLoading: historyLoading, workoutError: historyError } = useWorkoutHistory();
  const { profile } = useCurrentProfile();
  const { dietaryPlan } = useNutrition();
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
  useEffect(() => {
    const dialog = restDialog.current;
    if (restUntil && dialog && !dialog.open) dialog.showModal();
    if (!restUntil && dialog?.open) dialog.close();
  }, [restUntil]);
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
  const unit = (exercise && draft.units?.[exercise.exerciseId]) || record.sets?.find(set => set.exerciseId === exercise?.exerciseId && set.loadUnit)?.loadUnit || draft.unit || 'lbs';
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
      const next = await api.updateWorkoutRoutine(workout._id, recordRef.current.revision ?? 0, rows.map(row => ({ exerciseId: row.exerciseId, name: row.name, equipment: row.equipment, prescription: row.prescription, sets: row.sets, restBetweenSets: row.restBetweenSets ?? 90, restAfterExercise: row.restAfterExercise ?? 120 })), routineName);
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
    const reps = prescribed.durationSeconds ? 0 : Number(input?.reps ?? (existing?.status === 'completed' ? existing.reps : prescribed.reps));
    const weight = input?.weight ?? (existing?.loadKg === undefined ? '' : String(existing.loadUnit === unit && existing.loadValue !== undefined ? existing.loadValue : existing.loadKg * (unit === 'lbs' ? 2.2046226218 : 1)));
    const loadKg = weight === '' ? undefined : Number(weight) / (unit === 'lbs' ? 2.2046226218 : 1);
    if ((!prescribed.durationSeconds && (input?.reps === '' || !Number.isInteger(reps) || reps < 1 || reps > 1000)) || (loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 1000))) throw new Error('Enter 1–1000 whole reps and a valid weight, or leave weight blank.');
    await writeSet({ setId, exerciseId: exercise.exerciseId, setIndex: index, reps, setType: draftRef.current.setTypes?.[setId] ?? existing?.setType ?? 'normal', ...(prescribed.durationSeconds ? { durationSeconds: prescribed.durationSeconds } : {}), ...(loadKg !== undefined ? { loadKg, loadValue: Number(weight), loadUnit: unit } : {}), status: 'completed', source: 'manual' });
    if (existing?.status !== 'completed') { const seconds = exerciseProgress(exercise, recordRef.current.sets ?? []) === 'completed' ? exercise.restAfterExercise ?? 120 : exercise.restBetweenSets ?? 90; const now = Date.now(); setRestNow(now); setRestUntil(seconds > 0 ? now + seconds * 1000 : 0); }
    const values = { ...draftRef.current.values }; delete values[setId];
    const setTypes = { ...draftRef.current.setTypes }; delete setTypes[setId];
    changeDraft({ ...draftRef.current, values, setTypes });
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
      onEnd={end} renderRoutine={mode === 'manual' ? paused => <>
        <h2 className="manual-exercises-title">Exercises · {exercises.length}</h2>
        <div className="routine-progress" role="status">{completed} of {total} sets completed · Manual logging</div>
        <nav aria-label="Workout routine"><ol>{exercises.map((row, index) => {
          const status = exerciseProgress(row, sets);
          return <li key={row.exerciseId} className={index === selected && expanded ? 'routine-exercise-open' : ''}><button type="button" aria-current={index === selected ? 'step' : undefined} aria-expanded={index === selected && expanded} disabled={saving} onClick={()=>{ if (index === selected) setExpanded(value => !value); else { changeDraft({ ...draftRef.current, selected: index }); setExpanded(true); } }} aria-label={`${status === 'completed' || status === 'skipped' ? 'Revisit' : 'View'} ${titleCase(row.name)}`}><span className="routine-exercise-number">{index + 1}</span><span className="routine-exercise-label"><strong>{titleCase(row.name)}</strong><small>{row.sets} sets · {prescribedWork(row.prescription).durationSeconds ? `${prescribedWork(row.prescription).durationSeconds} sec` : `${prescribedWork(row.prescription).reps || "—"} reps`}</small></span><small>{sets.filter(set => set.exerciseId === row.exerciseId && set.status === 'completed').length}/{row.sets}</small><span aria-hidden="true"><Icon name="chevron-down" size={18}/></span></button><div className="routine-row-actions"><button type="button" className="routine-reorder" aria-label={`Reorder ${titleCase(row.name)}`} aria-expanded={reordering === row.exerciseId} disabled={saving || paused || exercises.length < 2} onClick={() => { setMenu(null); setReordering(reordering === row.exerciseId ? null : row.exerciseId); }}><Icon name="reorder" size={20}/></button><button type="button" disabled={saving || paused} aria-label={`Options for ${titleCase(row.name)}`} aria-expanded={menu === row.exerciseId} onClick={() => { setMenu(menu === row.exerciseId ? null : row.exerciseId); }}><Icon name="more" size={20}/></button></div>
          {reordering === row.exerciseId && <div className="routine-reorder-actions"><button type="button" disabled={saving || paused || index === 0} onClick={() => moveExercise(index, -1)}>Move up</button><button type="button" disabled={saving || paused || index === exercises.length - 1} onClick={() => moveExercise(index, 1)}>Move down</button></div>}
          {menu === row.exerciseId && <div className="routine-row-menu"><button type="button" disabled={saving || paused} onClick={() => { setError(''); setEditor({ kind: 'rename', id: row.exerciseId }); }}>Rename exercise</button><button type="button" disabled={saving || paused || sets.some(set => set.exerciseId === row.exerciseId)} onClick={() => { setError(''); setEditor({ kind: 'replace', id: row.exerciseId }); }}>Replace exercise</button><button type="button" disabled={saving || paused || index !== selected} onClick={() => void skip()}>Skip exercise</button><strong>Rest for {titleCase(row.name)}</strong>{([['Between sets', 'restBetweenSets', row.restBetweenSets ?? 90], ['Before next exercise', 'restAfterExercise', row.restAfterExercise ?? 120]] as const).map(([label,key,seconds]) => <div className="routine-rest-setting" key={key}><span>{label}</span><button type="button" aria-label={`Decrease ${label.toLowerCase()} rest for ${titleCase(row.name)}`} disabled={saving || paused || seconds <= 0} onClick={() => void changeRoutine(exercises.map(item => item.exerciseId === row.exerciseId ? { ...item, [key]: Math.max(0, seconds - 15) } : item))}><Icon name="minus" size={18}/></button><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2,'0')}</b><button type="button" aria-label={`Increase ${label.toLowerCase()} rest for ${titleCase(row.name)}`} disabled={saving || paused || seconds >= 600} onClick={() => void changeRoutine(exercises.map(item => item.exerciseId === row.exerciseId ? { ...item, [key]: Math.min(600, seconds + 15) } : item))}>+</button></div>)}<button type="button" disabled={saving || paused || exercises.length <= 1 || sets.some(set => set.exerciseId === row.exerciseId)} onClick={() => setRemoving(row.exerciseId)}>Remove exercise</button><small>Exercises with saved sets cannot be removed or replaced.</small></div>}
          {index === selected && expanded && <section aria-label="Current exercise" className="routine-current"><div className="manual-unit"><strong>Weight unit</strong><div role="group" aria-label={`Weight unit for ${titleCase(row.name)}`}>{(['lbs', 'kg'] as const).map(value => <button type="button" key={value} aria-pressed={unit === value} disabled={paused || saving} onClick={() => setUnit(value)}>{value}</button>)}</div></div><p className="routine-help">Tap a number to log your set. Blank weight means no added load.</p>
          {!prescribedWork(exercise.prescription).durationSeconds && <aside className="training-suggestion"><strong>Next-session guidance</strong><p>{historyLoading ? 'Loading workout history…' : historyError ? 'Workout history is unavailable.' : nextTrainingSuggestion(history, exercise.exerciseId, exercise.equipment, profile?.goal ?? '', exercise.sets, dietaryPlan?.goal)}</p><small>{dietaryPlan?.goal ? `Dietary goal: ${dietaryPlan.goal}. ` : 'Set a dietary goal in Scan to include your nutrition phase. '}Suggestion only. Adjust for technique, recovery and available equipment; stop if you feel pain.</small></aside>}
          <div className="routine-set-heading" aria-hidden="true"><span>Set</span><span>{/body\s*weight|bodyweight|none/i.test(exercise.equipment) ? 'Load' : unit}</span><span>{prescribedWork(exercise.prescription).durationSeconds ? 'Time' : 'Reps'}</span><span /></div>
          {Array.from({ length: exercise.sets }, (_, index) => {
            const setId = `${exercise.exerciseId}:${index}`, saved = sets.find(set => set.setId === setId), input = draft.values[setId], prescribed = prescribedWork(exercise.prescription);
            const values = { reps: input?.reps ?? String(saved?.status === 'completed' ? saved.reps : prescribed.reps || ''), weight: input?.weight ?? (saved?.loadKg === undefined ? '' : String(saved.loadUnit === unit && saved.loadValue !== undefined ? saved.loadValue : Math.round(saved.loadKg * (unit === 'lbs' ? 2.2046226218 : 1) * 100) / 100)) };
            const bodyweight = /body\s*weight|bodyweight|none/i.test(exercise.equipment);
            const change = (key: 'reps' | 'weight', value: string) => changeDraft({ ...draftRef.current, values: { ...draftRef.current.values, [setId]: { ...values, [key]: value } } });
            return <form key={setId} className="routine-set" onSubmit={event=>{event.preventDefault();void save(index);}}><label><span className="visually-hidden">Set type for set {index + 1}</span><select aria-label={`Set type for set ${index + 1}`} disabled={paused || saving} value={draft.setTypes?.[setId] ?? saved?.setType ?? 'normal'} onChange={event=>changeDraft({ ...draftRef.current, setTypes: { ...draftRef.current.setTypes, [setId]: event.target.value as SetType } })}><option value="normal" aria-label="Normal set">{index + 1}</option><option value="warmup" aria-label="Warm-up set">W</option><option value="drop" aria-label="Drop set">D</option><option value="failure" aria-label="Failure set">F</option></select></label>
              {!bodyweight && <label><span className="visually-hidden">Weight ({unit})</span><input type="text" inputMode="none" onClick={() => setKeypad({ setId, field: 'weight', values })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setKeypad({ setId, field: 'weight', values }); } }} min={0} max={unit === 'kg' ? 1000 : 2204.62} step="any" value={values.weight} disabled={paused || saving} aria-label={`Weight (${unit}), set ${index + 1}`} onChange={event=>{ if (/^\d*(\.\d*)?$/.test(event.target.value) && event.target.value.length <= 8) change('weight',event.target.value); }}/></label>}
              {bodyweight && <p>Bodyweight · no added load</p>}
              {prescribed.durationSeconds ? <p>{prescribed.durationSeconds} sec</p> : <label><span className="visually-hidden">Reps</span><input type="text" inputMode="none" onClick={() => setKeypad({ setId, field: 'reps', values })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setKeypad({ setId, field: 'reps', values }); } }} min={1} max={1000} step={1} required value={values.reps} disabled={paused || saving} aria-label={`Reps, set ${index + 1}`} onChange={event=>{ if (/^\d*$/.test(event.target.value) && event.target.value.length <= 4) change('reps',event.target.value); }}/></label>}
              <button type="submit" className={saved?.status === 'completed' ? 'is-saved' : undefined} aria-label={`${saved?.status === 'completed' ? 'Update' : 'Save'} set ${index + 1}`} disabled={paused || saving}><Icon name="check" size={18}/></button>
            </form>;
          })}
          <button type="button" className="manual-add-set" disabled={paused || saving || exercise.sets >= 10} onClick={() => void changeRoutine(exercises.map(item => item.exerciseId === exercise.exerciseId ? { ...item, sets: item.sets + 1 } : item))}>{exercise.sets >= 10 ? '10-set limit reached' : '+ Add Set'}</button>
        </section>}</li>;
        })}</ol></nav>
        {storageError && <p role="alert">Device draft storage is unavailable. Unsaved inputs will be lost if you close the app.</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
      </> : undefined}/>
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
    <dialog ref={restDialog} className="routine-rest-dialog" aria-labelledby="routine-rest-title" onCancel={event => { event.preventDefault(); setRestUntil(0); }}><h2 id="routine-rest-title">Rest time</h2><p>Take a breath before your next set.</p><strong role="timer" aria-label="Rest time remaining">{Math.floor(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) / 60)}:{String(Math.max(0, Math.ceil((restUntil - restNow) / 1000)) % 60).padStart(2, '0')}</strong><div className="routine-rest-actions"><button type="button" onClick={() => setRestUntil(until => until + 60000)}>+1 min</button><button type="button" onClick={() => setRestUntil(0)}>End rest</button></div></dialog>
    {ending !== null && <dialog ref={endDialog} aria-labelledby="routine-end-title" className="routine-end-dialog" onCancel={event=>{event.preventDefault();if(!saving)setEnding(null);}}><h2 id="routine-end-title">End workout early?</h2><p>{total - completed} sets are not completed. Remaining sets will be saved as skipped. Unsaved inputs are not counted.</p>{error && <p role="alert">{error}</p>}<button type="button" disabled={saving} onClick={()=>{completionRequest.current=null;setEnding(null);}}>Keep training</button><button type="button" disabled={saving} onClick={()=>void finish(ending)}>{saving ? 'Saving…' : 'Save and end workout'}</button></dialog>}
  </div>;
}
