'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseRecord } from '../../lib/api';

export default function WorkoutEditor({ title, initialName, replacing, busy, error, excludedIds, onSave, onReplace, onClose }: {
  title: string; initialName: string; replacing: boolean; busy: boolean; error: string; excludedIds: string[];
  onSave: (name: string) => void; onReplace: (exercise: ExerciseRecord) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ExerciseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retry, setRetry] = useState(0);
  const availableItems = items.filter(item => !excludedIds.includes(item._id));
  useEffect(() => { const opener = document.activeElement as HTMLElement; dialog.current?.showModal(); return () => { dialog.current?.close(); opener?.focus(); }; }, []);
  useEffect(() => {
    if (!replacing) return;
    let active = true; setLoading(true);
    const timer = setTimeout(() => { void api.getExercises({ search: query, limit: 20 }).then(result => { if (active) { setItems(result.items); setSearchError(''); } }).catch(() => { if (active) setSearchError('Could not load exercises. Try again.'); }).finally(() => { if (active) setLoading(false); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, replacing, retry]);
  return <dialog ref={dialog} className="workout-editor" aria-labelledby="workout-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id="workout-editor-title">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close editor">×</button></header>
    {!replacing ? <form onSubmit={event => { event.preventDefault(); if (name.trim()) onSave(name.trim()); }}><label>Name<input autoFocus maxLength={120} required value={name} onChange={event => setName(event.target.value)} /></label><button type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save name'}</button></form> : <><label>Find an exercise<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search exercises" /></label><p className="routine-help">Replacement starts with fresh sets. Logged exercises stay in your workout.</p>{loading ? <p role="status">Loading exercises…</p> : <div className="workout-search-results">{availableItems.map(item => <button type="button" key={item._id} disabled={busy} onClick={() => onReplace(item)}><strong>{item.name}</strong><small>{item.equipment || item.equipments?.join(', ')}</small></button>)}{!availableItems.length && !searchError && <p>No available exercises found. Try another name.</p>}</div>}{searchError && <p role="alert">{searchError} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}</>}
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
