'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { api, type ExerciseRecord, type ProgramExercise, type SavedProgram } from '../../lib/api';
import { EXERCISES } from '../../lib/programCatalog';
import { formatRest, suggestFor, type TrainingContext } from '../../lib/programSuggest';
import { readPersonalExercises } from '../../lib/personalExercises';
import { titleCase } from '../../lib/titleCase';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import { blankExercise, newId, weekdayShort } from './programModel';

type PickedExercise = { exerciseId: string; name: string; targetMuscle: string; equipment: string; source: string };

function Stepper({ label, value, min, max, step, format = String, onChange }: { label: string; value: number; min: number; max: number; step: number; format?: (value: number) => string; onChange: (value: number) => void }) {
  return <div className="cq-field"><span className="cq-field-label">{label}</span><div className="cq-stepper">
    <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><Icon name="minus" size={16}/></button>
    <output aria-live="polite">{format(value)}</output>
    <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><Icon name="plus" size={16}/></button>
  </div></div>;
}

export default function ProgramBuilder({ ctx, initial, isNew, initialDay = 0, onCancel, onSaved }: { ctx: TrainingContext; initial: SavedProgram; isNew: boolean; initialDay?: number; onCancel: () => void; onSaved: (program: SavedProgram) => void }) {
  const [draft, setDraft] = useState<SavedProgram>(initial);
  const [dayIndex, setDayIndex] = useState(Math.min(Math.max(0, initialDay), initial.days.length - 1));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removingDay, setRemovingDay] = useState(false);
  const day = draft.days[Math.min(dayIndex, draft.days.length - 1)];
  const setDay = (change: (current: typeof day) => typeof day) => setDraft(current => ({ ...current, days: current.days.map((item, index) => index === dayIndex ? change(item) : item) }));
  const setExercise = (index: number, patch: Partial<ProgramExercise>) => setDay(current => ({ ...current, exercises: current.exercises.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const move = (index: number, by: number) => setDay(current => { const list = [...current.exercises]; [list[index], list[index + by]] = [list[index + by], list[index]]; return { ...current, exercises: list }; });
  const addDay = () => { setDraft(current => ({ ...current, days: [...current.days, { id: newId('day'), title: `Day ${current.days.length + 1}`, exercises: [] }] })); setDayIndex(draft.days.length); };
  const usedWeekdays = new Set(draft.days.map(item => item.weekday).filter(value => value !== undefined));
  // Copies the open day (exercises, sets, reps, weights, rest) onto the next free weekday after it.
  const duplicateDay = () => {
    const start = (day.weekday ?? -1) + 1;
    const weekday = [0, 1, 2, 3, 4, 5, 6].map(offset => (start + offset) % 7).find(value => !usedWeekdays.has(value));
    setDraft(current => ({ ...current, days: [...current.days, { ...day, id: newId('day'), title: `${day.title.trim() || 'Day'} copy`.slice(0, 60), weekday, exercises: day.exercises.map(row => ({ ...row })) }] }));
    setDayIndex(draft.days.length);
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) { setError('Give your program a name.'); return; }
    if (draft.days.some(item => !item.title.trim())) { setError('Every day needs a name.'); return; }
    if (!draft.days.some(item => item.exercises.length)) { setError('Add at least one exercise.'); return; }
    const program: SavedProgram = { ...draft, name, notes: draft.notes?.trim() || undefined, days: draft.days.map(item => ({ ...item, title: item.title.trim(), exercises: item.exercises.map(row => ({ ...row, reps: row.reps?.trim() || undefined })) })) };
    setBusy(true); setError('');
    try { await api.saveProgram(program); onSaved(program); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save your program.'); }
    finally { setBusy(false); }
  };

  return <form className="cq-builder" onSubmit={event => { event.preventDefault(); void save(); }} aria-label={isNew ? 'Create program' : 'Edit program'}>
    <header className="cq-subheader pq-page-heading"><button type="button" className="coach-back" onClick={onCancel} disabled={busy} aria-label="Back without saving"><Icon name="arrow" size={20}/></button><h2>{isNew ? 'New program' : 'Edit program'}</h2></header>

    <section className="cq-builder-card">
      <label className="cq-input"><span>Program name</span><input value={draft.name} maxLength={60} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Summer Push / Pull / Legs" disabled={busy}/></label>
      <label className="cq-input"><span>Notes <em>optional</em></span><textarea value={draft.notes ?? ''} maxLength={500} rows={2} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="Goal, cues or how to progress" disabled={busy}/></label>
    </section>

    <div className="cq-block-head"><h3 className="cq-block-title">Training days</h3><span className="cq-hint">{draft.days.length} / 7</span></div>
    <div className="cq-daytabs" role="tablist" aria-label="Program days">
      {draft.days.map((item, index) => <button type="button" role="tab" key={item.id} aria-selected={index === dayIndex} onClick={() => setDayIndex(index)}><small>{item.weekday === undefined ? `Day ${index + 1}` : weekdayShort[item.weekday]}</small>{item.title || 'Untitled'}<em>{item.exercises.length}</em></button>)}
      {draft.days.length < 7 && <button type="button" className="cq-add-day" onClick={addDay} disabled={busy}><Icon name="plus" size={16}/>Add day</button>}
    </div>

    <section className="cq-builder-card" aria-label={`${day.title || 'Day'} settings`}>
      <div className="cq-day-fields">
        <label className="cq-input"><span>Day name</span><input value={day.title} maxLength={60} onChange={event => setDay(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Push" disabled={busy}/></label>
        <label className="cq-input"><span>Weekday</span><select value={day.weekday ?? ''} onChange={event => setDay(current => ({ ...current, weekday: event.target.value === '' ? undefined : Number(event.target.value) }))} disabled={busy}>
          <option value="">Any day</option>
          {weekdayShort.map((name, index) => <option key={name} value={index} disabled={usedWeekdays.has(index) && day.weekday !== index}>{name}</option>)}
        </select></label>
      </div>
      <div className="cq-day-actions">
        {draft.days.length < 7 && day.exercises.length > 0 && <button type="button" className="cq-text-action" onClick={duplicateDay} disabled={busy}><Icon name="plus" size={15}/>Duplicate day</button>}
        {draft.days.length > 1 && <button type="button" className="cq-text-danger" onClick={() => setRemovingDay(true)} disabled={busy}><Icon name="trash" size={15}/>Remove this day</button>}
      </div>
    </section>

    <ol className="cq-build-list">{day.exercises.map((row, index) => {
      const hint = suggestFor(row, ctx);
      const label = titleCase(row.name.toLocaleLowerCase());
      return <li key={row.exerciseId} className="cq-build-item">
        <div className="cq-build-head">
          <span className="cq-ex-num" aria-hidden="true">{index + 1}</span>
          <div className="cq-row-copy"><strong>{label}</strong><small>{[row.targetMuscle, row.equipment].filter(Boolean).map(value => titleCase(value.toLocaleLowerCase())).join(' · ')}</small></div>
          <div className="cq-icon-actions">
            <button type="button" aria-label={`Move ${label} up`} disabled={index === 0 || busy} onClick={() => move(index, -1)}><Icon name="arrow-up" size={16}/></button>
            <button type="button" aria-label={`Move ${label} down`} disabled={index === day.exercises.length - 1 || busy} onClick={() => move(index, 1)}><Icon name="arrow-down" size={16}/></button>
            <button type="button" aria-label={`Remove ${label}`} disabled={busy} onClick={() => setDay(current => ({ ...current, exercises: current.exercises.filter((_, i) => i !== index) }))}><Icon name="trash" size={16}/></button>
          </div>
        </div>
        <div className="cq-build-grid">
          <Stepper label="Sets" value={row.sets} min={1} max={10} step={1} onChange={sets => setExercise(index, { sets })}/>
          <label className="cq-field"><span className="cq-field-label">Reps <em>optional</em></span><input inputMode="text" value={row.reps ?? ''} maxLength={20} placeholder={hint.reps} aria-label={`Reps for ${label}`} onChange={event => setExercise(index, { reps: event.target.value })}/></label>
          <div className="cq-field cq-weight"><span className="cq-field-label">Weight <em>optional</em></span><div className="cq-weight-row">
            <div className="cq-unit cq-bar-toggle" role="group" aria-label={`Bar for ${label}`}><button type="button" aria-pressed={Boolean(row.loadBase)} title="Tap to switch: plates on a bar, plates on an EZ bar, or a total weight" onClick={() => setExercise(index, { loadBase: !row.loadBase ? (/ez/i.test(row.name) ? 'EZ bar' : 'Bar') : row.loadBase === 'Bar' ? 'EZ bar' : undefined })}>{row.loadBase === 'EZ bar' ? 'EZ bar +' : 'Bar +'}</button></div>
            <input inputMode="decimal" value={row.weight ?? ''} maxLength={7} placeholder={hint.weight === undefined ? 'BW' : String(hint.unit === row.unit ? hint.weight : '')} aria-label={`Weight for ${label} in ${row.unit}`} onChange={event => { const value = event.target.value; if (!/^\d{0,4}(\.\d{0,2})?$/.test(value)) return; setExercise(index, { weight: value === '' ? undefined : Math.min(1000, Number(value)) }); }}/>
            <div className="cq-unit" role="group" aria-label={`Weight unit for ${label}`}>{(['kg', 'lbs'] as const).map(unit => <button type="button" key={unit} aria-pressed={row.unit === unit} onClick={() => setExercise(index, { unit })}>{unit}</button>)}</div>
          </div></div>
          <Stepper label="Rest between sets" value={row.restSets} min={0} max={600} step={15} format={formatRest} onChange={restSets => setExercise(index, { restSets })}/>
          <Stepper label="Rest after exercise" value={row.restNext} min={0} max={600} step={15} format={formatRest} onChange={restNext => setExercise(index, { restNext })}/>
        </div>
        <button type="button" className="cq-suggest-btn" onClick={() => setExercise(index, { sets: hint.sets, reps: hint.reps, unit: hint.unit, weight: hint.weight, restSets: hint.restSets, restNext: hint.restNext })}><Icon name="coach-wand" size={15}/>Use suggestion · {hint.sets} × {hint.reps}{hint.weight !== undefined ? ` @ ${hint.weight} ${hint.unit}${hint.perHand ? ' each' : ''}` : ''}</button>
      </li>;
    })}</ol>
    {!day.exercises.length && <p className="cq-empty">No exercises on {day.title || 'this day'} yet. Add as many as you like.</p>}
    <button type="button" className="cq-add-exercise" onClick={() => setPicking(true)} disabled={busy}><Icon name="plus" size={18}/>Add exercise</button>

    {error && <p className="cq-inline-error" role="alert">{error}</p>}
    <div className="cq-actions"><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Save program' : 'Save changes'}</button></div>

    {picking && <ExercisePicker taken={new Set(day.exercises.map(item => item.exerciseId))} onClose={() => setPicking(false)} onPick={item => { setDay(current => ({ ...current, exercises: [...current.exercises, blankExercise(item, ctx)] })); setPicking(false); }}/>}
    {removingDay && <DeleteConfirmation title="Remove this day?" description={`${day.title || 'This day'} and its ${day.exercises.length} exercises will be removed when you save.`} confirmLabel="Remove day" onCancel={() => setRemovingDay(false)} onConfirm={() => { setDraft(current => ({ ...current, days: current.days.filter((_, index) => index !== dayIndex) })); setDayIndex(0); setRemovingDay(false); }}/>}
  </form>;
}

function ExercisePicker({ taken, onClose, onPick }: { taken: Set<string>; onClose: () => void; onPick: (item: PickedExercise) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<ExerciseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  useEffect(() => { const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; const element = dialog.current; element?.showModal(); return () => { element?.close(); if (opener?.isConnected) opener.focus(); }; }, []);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setRemote([]); setRemoteError(''); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void api.getExercises({ search: term, limit: 20 }).then(data => { if (active) { setRemote(data.items); setRemoteError(''); } }).catch(() => { if (active) { setRemote([]); setRemoteError('The online exercise library is unavailable. Suggested and custom exercises still work.'); } }).finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  const term = query.trim().toLowerCase();
  const results = useMemo(() => {
    let personal: PickedExercise[] = [];
    try { personal = readPersonalExercises().map(item => ({ exerciseId: item._id, name: item.name, targetMuscle: item.targetMuscle, equipment: item.equipment, source: 'My exercise' })); } catch { /* Personal exercises are optional. */ }
    const suggested = Object.values(EXERCISES).map(item => ({ exerciseId: `pq-${item.key}`, name: item.name, targetMuscle: item.muscle, equipment: item.equipment, source: 'Suggested' }));
    const library = remote.map(item => ({ exerciseId: item._id, name: titleCase(item.name.toLocaleLowerCase()), targetMuscle: item.targetMuscle || item.group || '', equipment: item.equipment || '', source: 'Library' }));
    const seen = new Set<string>();
    return [...personal, ...suggested, ...library].filter(item => !term || `${item.name} ${item.targetMuscle} ${item.equipment}`.toLowerCase().includes(term)).filter(item => { const key = item.name.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 60);
  }, [remote, term]);
  const custom = query.trim();
  return <dialog ref={dialog} className="cq-picker" aria-labelledby="cq-picker-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id="cq-picker-title">Add exercise</h2><button type="button" aria-label="Close exercise picker" onClick={onClose}><Icon name="close" size={20}/></button></header>
    <label className="cq-search"><Icon name="search" size={16}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search exercises or muscles" aria-label="Search exercises" autoFocus/></label>
    {loading && <p className="cq-hint" role="status">Searching the library…</p>}
    {remoteError && <p className="cq-hint">{remoteError}</p>}
    <ul className="cq-picker-list">{results.map(item => <li key={item.exerciseId}><button type="button" disabled={taken.has(item.exerciseId)} onClick={() => onPick(item)}>
      <span className="cq-row-copy"><strong>{item.name}</strong><small>{[item.targetMuscle, item.equipment].filter(Boolean).join(' · ')}</small></span>
      <span className="cq-pill">{taken.has(item.exerciseId) ? 'Added' : item.source}</span>
    </button></li>)}</ul>
    {custom.length >= 2 && <button type="button" className="cq-add-custom" onClick={() => onPick({ exerciseId: newId('custom').slice(0, 80), name: custom.slice(0, 120), targetMuscle: '', equipment: '', source: 'Custom' })}><Icon name="plus" size={16}/>Add “{custom.slice(0, 40)}” as a custom exercise</button>}
    {!results.length && custom.length < 2 && <p className="cq-empty">Type at least two letters to search.</p>}
    {!loading && !results.length && custom.length >= 2 && <p className="cq-empty" role="status">No exercises match “{custom.slice(0, 40)}”. Try another name or muscle, or add it as a custom exercise above.</p>}
  </dialog>;
}
