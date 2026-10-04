'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type ApiError } from '../../lib/api';
import { Icon } from '../Home/icons';

type Exercise = { _id: string; name: string; group: string; status: 'draft' | 'published'; pose: 'missing' | 'ready' | 'training' };
type Filter = 'All' | 'published' | 'draft' | 'missing';
function errorMessage(error: unknown) {
  const status = (error as ApiError & { statusCode?: number })?.statusCode;
  if (status === 403) return 'Not authorized. Admin access is required.';
  return error instanceof Error ? error.message : 'Could not complete the admin request.';
}

export default function AdminExerciseLibrary({ onBack }: { onBack: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setExercises(await api.getAdminExercises() as Exercise[]); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const visible = useMemo(() => exercises.filter(item => (filter === 'All' || (filter === 'missing' ? item.pose === 'missing' : item.status === filter)) && `${item.name} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase())), [exercises, filter, query]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.createAdminExercise({ name: name.trim(), group: group.trim() || 'General' }); setName(''); setGroup(''); setShowForm(false); await refresh(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const change = async (item: Exercise, patch: Record<string, unknown>) => {
    setBusy(true); setError('');
    try { await api.updateAdminExercise(item._id, patch); await refresh(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const remove = async (item: Exercise) => {
    setBusy(true); setError('');
    try { await api.deleteAdminExercise(item._id); await refresh(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return <section className="me-section admin-tools-screen" aria-label="Admin exercise library">
    <header className="admin-tools-header"><button className="coach-back" onClick={onBack} aria-label="Back to account settings"><Icon name="arrow" size={24}/></button><h2>Admin · Exercises</h2><button className="admin-new-button" onClick={() => setShowForm(true)} disabled={busy}><span aria-hidden="true">＋</span> New</button></header>
    <div className="admin-tools-scroll">
      {error && <div role="alert" className="scan-warning">{error}<button onClick={() => void refresh()}>Try again</button></div>}
      <label className="admin-search"><Icon name="search" size={15}/><span className="visually-hidden">Search exercises</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search content"/></label>
      <div className="admin-filters" role="group" aria-label="Filter exercise records">{(['All', 'published', 'draft', 'missing'] as Filter[]).map(option => <button key={option} className={filter === option ? 'active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option === 'missing' ? 'Missing pose' : option[0].toUpperCase() + option.slice(1)}</button>)}</div>
      <div className="admin-list-caption"><span>Exercise <small>Saved records</small></span><span>Status</span><span>Pose</span></div>
      <div className="admin-exercise-list">{loading ? <p role="status">Loading exercises…</p> : visible.map(item => <article className="admin-exercise-row" key={item._id}><div className="admin-exercise-copy"><b>{item.name}</b><small>{item.group}</small></div><span className={`admin-status ${item.status}`}>{item.status}</span><span className={`admin-pose ${item.pose}`}>{item.pose}</span><div className="admin-row-actions"><button disabled={busy} onClick={() => void change(item, { status: item.status === 'draft' ? 'published' : 'draft' })}>{item.status === 'draft' ? 'Publish' : 'Unpublish'}</button><button disabled={busy} onClick={() => void remove(item)}>Delete</button></div></article>)}{!loading && visible.length === 0 && !error && <p className="admin-empty-state">No saved exercises match this search.</p>}</div>
    </div>
    {showForm && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="admin-exercise-form" role="dialog" aria-modal="true" aria-labelledby="admin-exercise-form-title" onSubmit={event => void create(event)} onKeyDown={event => { if (event.key === 'Escape') setShowForm(false); }}><button type="button" className="admin-modal-close" aria-label="Close" onClick={() => setShowForm(false)}>×</button><h3 id="admin-exercise-form-title">New exercise</h3><label>Exercise name<input autoFocus value={name} onChange={event => setName(event.target.value)} required maxLength={80}/></label><label>Muscle · equipment<input value={group} onChange={event => setGroup(event.target.value)} maxLength={100} placeholder="e.g. Chest · Dumbbells"/></label><p>New exercises are saved as drafts until reviewed.</p><button className="admin-save-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create draft'}</button></form></div>}
  </section>;
}
