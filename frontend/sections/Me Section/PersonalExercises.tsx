'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { muscleGroups, primaryEquipment, readPersonalExercises, savePersonalExercises, type PersonalExercise } from '../../lib/personalExercises';
import { Icon } from '../Home/icons';
import DeleteConfirmation from '../../components/DeleteConfirmation';

export default function PersonalExercises({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<PersonalExercise[]>([]);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState(muscleGroups[0]);
  const [equipment, setEquipment] = useState(primaryEquipment[0]);
  const [options, setOptions] = useState<string[]>(primaryEquipment);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<PersonalExercise | null>(null);
  useEffect(() => {
    try { setItems(readPersonalExercises()); } catch { setError('Device storage is unavailable. Your exercises cannot be loaded.'); }
    void api.getExerciseFilters().then(filters => setOptions([...new Set([...primaryEquipment, ...filters.equipments])])).catch(() => {});
  }, []);
  function save(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) { setError('Enter an exercise name.'); return; }
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: PersonalExercise = { _id: `personal-${id}`, name: clean, targetMuscle: muscle, equipment, pose: 'missing' };
    try { const next = [...items, item]; savePersonalExercises(next); setItems(next); setName(''); setShowForm(false); setError(''); }
    catch { setError('Could not save on this device. Check your browser storage and try again.'); }
  }
  function remove(id: string) {
    try { const next = items.filter(item => item._id !== id); savePersonalExercises(next); setItems(next); setError(''); }
    catch { setError('Could not remove the exercise from this device.'); }
  }
  return <section className="me-section admin-tools-screen admin-reference" aria-label="Personal exercises">
    <header className="admin-tools-header"><button type="button" className="coach-back" aria-label={showForm ? 'Back to personal exercises' : 'Back to account settings'} onClick={() => { if (showForm) { setShowForm(false); setError(''); } else onBack(); }}><Icon name="arrow" size={20}/></button><h2>My exercises</h2>{!showForm && <button type="button" className="admin-new-button" onClick={() => setShowForm(true)}>＋ New</button>}</header>
    <div className="admin-tools-scroll"><p className="personal-exercise-intro">Exercises you create stay on this device and are only visible to your account here. If you log a workout, its exercise name and results are saved to your account.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {showForm ? <form className="admin-reference-form" onSubmit={save}><h3>New exercise</h3>
        <label>Exercise name<input autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bulgarian split squat"/></label>
        <label>Target muscle group<select value={muscle} onChange={e => setMuscle(e.target.value)}>{muscleGroups.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Equipment needed<select value={equipment} onChange={e => setEquipment(e.target.value)}>{options.map(value => <option key={value}>{value}</option>)}</select></label>
        <p className="personal-exercise-intro">Manual tracking only. No pose upload is needed.</p><div className="admin-form-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" type="submit">Save exercise</button></div>
      </form> : <div className="admin-exercise-list">{items.length ? items.map(item => <article key={item._id} className="personal-exercise-row"><div><b>{item.name}</b><small>{item.targetMuscle} · {item.equipment}</small></div><button type="button" className="secondary" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)}>Delete</button></article>) : <p className="admin-empty-state">No personal exercises yet. Add one to use it in the exercise library.</p>}</div>}
      {deleting && <DeleteConfirmation title="Delete this exercise?" description={`${deleting.name} will be removed from this device.`} confirmLabel="Delete exercise" onCancel={() => setDeleting(null)} onConfirm={() => { remove(deleting._id); setDeleting(null); }}/>}
    </div></section>;
}
