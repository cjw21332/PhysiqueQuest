'use client';
import { useEffect, useState } from 'react';
import { api, type CoachDay, type CoachExercise, type ExerciseRecord } from '../../lib/api';
import { readPersonalExercises } from '../../lib/personalExercises';
import { Icon } from '../Home/icons';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import { titleCase } from '../../lib/titleCase';

export default function ProgramDayEditor({ day, version, onCancel, onSaved }: { day: CoachDay; version: string; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(day.isWorkoutDay ? day.title : '');
  const [exercises, setExercises] = useState<CoachExercise[]>(day.exercises);
  const [replace, setReplace] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExerciseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  useEffect(() => {
    if (!picking) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void api.getExercises({ search: query.trim() || undefined, limit: 20 }).then(data => { if (active) { setResults(data.items); setError(''); } }).catch(() => { if (active) { setResults([]); setError('Could not load exercises. Check your connection and try again.'); } }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [picking, query]);
  let personal: ExerciseRecord[] = [];
  try { personal = readPersonalExercises().filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => ({ ...item, group: item.targetMuscle })); } catch { /* Personal exercises are optional. */ }
  const choose = (item: ExerciseRecord) => {
    if (exercises.some((exercise, index) => exercise.exerciseId === item._id && index !== replace)) { setError('This exercise is already in the day.'); return; }
    const next: CoachExercise = { exerciseId: item._id, name: item.name, group: item.group || item.targetMuscle || '', targetMuscle: item.targetMuscle || '', equipment: item.equipment || '', tracking: 'Manual', prescription: replace === null ? '3 x 10' : exercises[replace].prescription || '3 x 10' };
    setExercises(current => replace === null ? [...current, next] : current.map((exercise, index) => index === replace ? next : exercise));
    setPicking(false); setQuery(''); setError('');
  };
  const save = async () => {
    if (!title.trim()) { setError('Enter a name for this day.'); return; }
    setBusy(true); setError('');
    try {
      await api.updateCoachDay({ programVersion: version, dayIndex: day.index, title: title.trim(), exercises: exercises.map(({ exerciseId, name, group, targetMuscle, equipment, tracking, prescription }) => ({ exerciseId, name, group: group || '', targetMuscle: targetMuscle || '', equipment: equipment || '', tracking, ...(prescription ? { prescription } : {}) })) });
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your day.'); } finally { setBusy(false); }
  };
  const picker = <div className="program-picker"><div className="program-editor-heading"><h4>{replace === null ? 'Add an exercise' : 'Choose a replacement'}</h4><button type="button" aria-label="Close exercise picker" onClick={() => { setPicking(false); setError(''); }}><Icon name="close" size={19}/></button></div><label>Search exercises<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name" autoFocus/></label><p className="program-editor-help">Personal exercises added here are saved with your program to your account.</p>{loading && <p role="status">Searching exercises...</p>}<div className="program-picker-results">{[...personal, ...results].map(item => <button key={item._id} type="button" onClick={() => choose(item)}><strong>{titleCase(item.name.toLocaleLowerCase())}</strong><small>{titleCase(item.targetMuscle || item.group || '')} | {titleCase(item.equipment || '')}</small></button>)}</div>{!loading && !personal.length && !results.length && <p>No exercises found.</p>}</div>;
  return <section className="program-editor" aria-label={`Edit ${day.name} program`}>
    <div className="program-editor-heading"><div><p>YOUR PROGRAM | {day.name.toUpperCase()}</p><h3>Edit training day</h3></div><button type="button" onClick={onCancel} disabled={busy}>Cancel</button></div>
    <label>Day name<input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="e.g. Push day" disabled={busy}/></label>
    <p className="program-editor-help">Choose the exercises you want to train. Changes are saved to your account.</p>
    <div className="program-editor-list">{exercises.map((item, index) => <div key={item.exerciseId}><div className="program-editor-row"><span>{index + 1}</span><div className="program-editor-exercise"><strong>{titleCase(item.name.toLocaleLowerCase())}</strong><small>{item.equipment ? titleCase(item.equipment.toLocaleLowerCase()) : 'No Equipment Specified'} | {item.prescription || '3 x 10'}</small></div><div className="program-editor-row-actions"><button type="button" title="Change exercise" aria-label={`Change ${titleCase(item.name.toLocaleLowerCase())}`} disabled={busy} onClick={() => { setReplace(index); setPicking(true); setError(''); }}><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4 4-4-4 4-4"/></svg></button><button type="button" title="Remove exercise" aria-label={`Remove ${titleCase(item.name.toLocaleLowerCase())}`} disabled={busy} onClick={() => setRemoving(index)}><Icon name="trash" size={19}/></button></div></div>{picking && replace === index && picker}</div>)}</div>
    {!exercises.length && <p className="program-editor-help">No exercises yet. Add one below.</p>}
    <button className="program-add" type="button" disabled={busy || exercises.length >= 50} onClick={() => { setReplace(null); setPicking(true); setError(''); }}><Icon name="plus" size={18}/> Add exercise</button>
    {picking && replace === null && picker}
    {removing !== null && exercises[removing] && <DeleteConfirmation title="Remove this exercise?" description={`${exercises[removing].name} will be removed from this day when you save your changes.`} confirmLabel="Remove exercise" onCancel={() => setRemoving(null)} onConfirm={() => { setExercises(current => current.filter((_, i) => i !== removing)); setRemoving(null); setPicking(false); }}/>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="program-editor-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="primary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving...' : 'Save day'}</button></div>
  </section>;
}
