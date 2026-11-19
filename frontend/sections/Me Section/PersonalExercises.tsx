'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { muscleGroups, primaryEquipment, readPersonalExercises, savePersonalExercises, type PersonalExercise } from '../../lib/personalExercises';
import { Icon } from '../Home/icons';
import DeleteConfirmation from '../../components/DeleteConfirmation';
import styles from './PersonalExercises.module.css';
import { titleCase } from '../../lib/titleCase';

export default function PersonalExercises({ onBack, readOnly = false }: { onBack: () => void; readOnly?: boolean }) {
  const [items, setItems] = useState<PersonalExercise[]>([]);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState(muscleGroups[0]);
  const [equipment, setEquipment] = useState(primaryEquipment[0]);
  const [options, setOptions] = useState<string[]>(primaryEquipment);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PersonalExercise | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<PersonalExercise | null>(null);
  useEffect(() => {
    try { setItems(readPersonalExercises()); } catch { setError('Device storage is unavailable. Your exercises cannot be loaded.'); }
    void api.getExerciseFilters().then(filters => setOptions([...new Set([...primaryEquipment, ...filters.equipments])])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!showForm) return;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (opener.current?.isConnected) opener.current.focus(); };
  }, [showForm]);
  function openForm(item?: PersonalExercise) {
    if (readOnly) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setMuscle(item?.targetMuscle ?? muscleGroups[0]);
    setEquipment(item?.equipment ?? primaryEquipment[0]);
    setError('');
    setShowForm(true);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    const clean = name.trim();
    if (!clean) { setError('Enter an exercise name.'); return; }
    const id = editing?._id ?? `personal-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const item: PersonalExercise = { _id: id, name: clean, targetMuscle: muscle, equipment, pose: 'missing' };
    try { const next = editing ? items.map(existing => existing._id === editing._id ? item : existing) : [...items, item]; savePersonalExercises(next); setItems(next); setName(''); setShowForm(false); setError(''); }
    catch { setError('Could not save on this device. Check your browser storage and try again.'); }
  }
  function remove(id: string) {
    if (readOnly) return;
    try { const next = items.filter(item => item._id !== id); savePersonalExercises(next); setItems(next); setError(''); }
    catch { setError('Could not remove the exercise from this device.'); }
  }
  return <section className={`me-section admin-tools-screen admin-reference ${styles.screen}`} aria-label="Personal exercises">
    <header className="admin-tools-header pq-page-heading"><button type="button" className="coach-back" aria-label="Back to account settings" onClick={onBack}><Icon name="arrow" size={20}/></button><h2>My Exercises</h2><button type="button" className="admin-new-button" disabled={readOnly} onClick={() => openForm()}><Icon name="plus" size={16}/> New</button></header>
    <div className="admin-tools-scroll"><div className={styles.intro}><span className={styles.introIcon}><Icon name="library-dumbbells" size={20}/></span><div><h3>Your exercise library</h3><p>Exercises you create stay on this device and are only visible to your account here. If you log a workout, its exercise name and results are saved to your account.</p></div></div>
      {error && !showForm && <p className="error" role="alert">{error}</p>}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="admin-exercise-list">{items.length ? <><div className={styles.listHeading}><h3>Saved Exercises</h3><span>{items.length}</span></div>{items.map(item => <article key={item._id} className={`personal-exercise-row ${styles.row}`}><span className={styles.exerciseIcon}><Icon name="dumbbell" size={20}/></span><div className={styles.exerciseInfo}><b>{titleCase(item.name)}</b><small>{titleCase(item.targetMuscle)} · {titleCase(item.equipment)}</small></div><div className={styles.rowActions}><button type="button" className={`secondary ${styles.actionButton}`} aria-label={`Edit ${titleCase(item.name)}`} onClick={() => openForm(item)}><Icon name="edit" size={17}/><span>Edit</span></button><button type="button" className={`secondary ${styles.actionButton}`} aria-label={`Delete ${titleCase(item.name)}`} onClick={() => setDeleting(item)}><Icon name="trash" size={17}/><span>Delete</span></button></div></article>)}</> : <div className={styles.empty}><span className={styles.exerciseIcon}><Icon name="dumbbell" size={20}/></span><h3>No Exercises Yet</h3><p>Add your own exercise to use it in the exercise library.</p><button type="button" className="primary" onClick={() => openForm()}><Icon name="plus" size={16}/> Add Exercise</button></div>}</div>
      </fieldset>
      {showForm && <dialog ref={dialog} className={styles.dialog} aria-labelledby="personal-exercise-form-title" onCancel={event => { event.preventDefault(); setShowForm(false); setError(''); }}>
        <form className={styles.form} onSubmit={save}><header className={styles.modalHeader}><div><h2 id="personal-exercise-form-title">{editing ? 'Edit Exercise' : 'New Exercise'}</h2><p>{editing ? 'Update the details saved on this device.' : 'Add an exercise to your personal library.'}</p></div><button type="button" className={styles.close} aria-label="Close" onClick={() => { setShowForm(false); setError(''); }}><Icon name="close" size={20}/></button></header>
          <label>Exercise Name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bulgarian Split Squat" autoFocus/></label>
          <label>Target Muscle Group<select value={muscle} onChange={e => setMuscle(e.target.value)}>{[...new Set([...muscleGroups, muscle])].map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
          <label>Equipment Needed<select value={equipment} onChange={e => setEquipment(e.target.value)}>{[...new Set([...options, equipment])].map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
          <p className={styles.note}>Manual tracking only. Existing workout records are not changed.</p>{error && <p className="error" role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" className="secondary" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button><button className="primary" type="submit">{editing ? 'Save Changes' : 'Save Exercise'}</button></div>
        </form></dialog>}
      {deleting && <DeleteConfirmation title="Delete this exercise?" description={`${deleting.name} will be removed from this device.`} confirmLabel="Delete exercise" onCancel={() => setDeleting(null)} onConfirm={() => { remove(deleting._id); setDeleting(null); }}/>}
    </div></section>;
}
