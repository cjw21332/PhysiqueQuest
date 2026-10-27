'use client';
import { titleCase } from '../../lib/titleCase';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type ApiError } from '../../lib/api';
import { Icon } from '../Home/icons';
import { adminExercisesPreview, filterAdminExercises, type AdminExercise, type ExerciseFilter } from './adminPreview';

function errorMessage(error: unknown) {
  if ((error as ApiError & { statusCode?: number })?.statusCode === 403) return 'Not authorized. Admin access is required.';
  return error instanceof Error ? error.message : 'Could not complete the admin request.';
}
export default function AdminExerciseLibrary({ onBack, preview = false }: { onBack: () => void; preview?: boolean }) {
  const [exercises, setExercises] = useState<AdminExercise[]>(preview ? adminExercisesPreview.map(item => ({ ...item })) : []);
  const [filter, setFilter] = useState<ExerciseFilter>('All');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('Chest');
  const [equipment, setEquipment] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (preview) return;
    setLoading(true); setError('');
    try { setExercises(await api.getAdminExercises() as AdminExercise[]); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [preview]);
  useEffect(() => { void refresh(); }, [refresh]);
  const visible = useMemo(() => showForm ? exercises.filter(item => item.status === 'published') : filterAdminExercises(exercises, filter, query), [exercises, filter, query, showForm]);
  const closeForm = () => { setShowForm(false); setName(''); setEquipment(''); setMuscle('Chest'); setPublished(false); setError(''); };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !name.trim() || !equipment.trim()) return;
    setBusy(true); setError('');
    const payload = { name: name.trim(), group: `${muscle} · ${equipment.trim()}`, targetMuscle: muscle, equipment: equipment.trim(), status: published ? 'published' as const : 'draft' as const, pose: 'missing' as const };
    try {
      if (preview) setExercises(current => [...current, { ...payload, _id: `preview-new-${Date.now()}` }]);
      else await api.createAdminExercise(payload);
      closeForm(); setFilter('All'); setQuery('');
      if (!preview) await refresh();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <section className="me-section admin-tools-screen admin-reference" aria-label="Admin exercise library">
    <header className="admin-tools-header"><button type="button" className="coach-back" onClick={showForm ? closeForm : onBack} disabled={busy} aria-label={showForm ? 'Back to exercise library' : 'Back to account settings'}><Icon name="arrow" size={20}/></button><h2>Admin · Exercises</h2><button type="button" className="admin-new-button" onClick={() => { setError(''); setShowForm(true); }} disabled={busy}><span aria-hidden="true">＋</span> New</button></header>
    <div className="admin-tools-scroll">
      {error && <div className="error" role="alert">{error}{!showForm && <button type="button" className="scan-retry" onClick={() => void refresh()}>Try again</button>}</div>}
      {showForm ? <form className="admin-reference-form" aria-labelledby="admin-new-title" onSubmit={event => void create(event)}>
        <h3 id="admin-new-title">New exercise</h3>
        <label>Name<input autoFocus required maxLength={80} placeholder="e.g. Bulgarian split squat" value={name} disabled={busy} onChange={event => setName(event.target.value)}/></label>
        <fieldset disabled={busy}><legend>Muscle group</legend><div className="admin-muscle-chips">{['Chest', 'Back', 'Legs', 'Shoulders', 'Core'].map(value => <button key={value} type="button" className={muscle === value ? 'active' : ''} aria-pressed={muscle === value} onClick={() => setMuscle(value)}>{value}</button>)}</div></fieldset>
        <label>Equipment<input required maxLength={70} placeholder="e.g. Dumbbells" value={equipment} disabled={busy} onChange={event => setEquipment(event.target.value)}/></label>
        <div className="admin-publish-row"><span><b>Published</b><small>Visible to all users in the library</small></span><button type="button" className={`admin-publish-switch ${published ? 'on' : ''}`} role="switch" aria-label="Published" aria-checked={published} disabled={busy} onClick={() => setPublished(value => !value)}><i/></button></div>
        <div className="admin-form-actions"><button type="button" className="secondary" disabled={busy} onClick={closeForm}>Cancel</button><button className="primary" disabled={busy || !name.trim() || !equipment.trim()} type="submit">{busy ? 'Saving…' : 'Save'}</button></div>
      </form> : <><label className="admin-search"><Icon name="search" size={17}/><span className="visually-hidden">Search exercises</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search content"/></label><div className="admin-filters" role="group" aria-label="Filter exercise records">{(['All', 'published', 'draft', 'missing'] as ExerciseFilter[]).map(option => <button type="button" key={option} className={filter === option ? 'active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option === 'missing' ? 'Missing pose' : option[0].toUpperCase() + option.slice(1)}</button>)}</div></>}
      <div className="admin-list-caption"><span>Exercise {preview && <small>Sample data</small>}</span><span>Status</span><span>Pose</span></div>
      <div className="admin-exercise-list">{loading ? <p role="status">Loading exercises…</p> : visible.map(item => <article className="admin-exercise-row" key={item._id}><div className="admin-exercise-copy"><b>{titleCase(item.name)}</b><small>{item.group}</small></div><span className={`admin-status ${item.status}`}>{item.status === 'published' ? 'Published' : 'Draft'}</span><span className={`admin-pose ${item.pose}`}>{item.pose[0].toUpperCase() + item.pose.slice(1)}</span></article>)}{!loading && !visible.length && !error && <p className="admin-empty-state">No exercises match this search.</p>}</div>
    </div>
  </section>;
}
