'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseCredit, type LibraryExerciseRecord } from '../../lib/api';
import { Icon } from '../Home/icons';

const muscles = ['All', 'Chest', 'Back', 'Legs', 'Core', 'Shoulders', 'Arms'];
const equipmentTypes = ['Any equipment', 'Dumbbells', 'Bodyweight', 'Barbell', 'Bench', 'Kettlebell', 'Pull-up bar'];

function Credit({ label, credit }: { label: string; credit: ExerciseCredit | null }) {
  if (!credit) return null;
  return <p className="library-preview-note">{label}: {credit.author || 'wger contributors'} · {credit.licenseUrl ? <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a> : credit.license} · <a href={credit.sourceUrl} target="_blank" rel="noreferrer">Source</a></p>;
}

export default function ExerciseLibrary({ onBack }: { onBack: () => void; selectedEquipment: string[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [equipment, setEquipment] = useState('Any equipment');
  const [selected, setSelected] = useState<LibraryExerciseRecord | null>(null);
  const [items, setItems] = useState<LibraryExerciseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setItems([]);
    const timer = setTimeout(() => {
      api.getExercises({ search: searchTerm, muscle: selectedMuscle, equipment, page, limit: 24 })
        .then(data => { if (active) { setItems(data.items); setTotal(data.total); setPages(data.pages); } })
        .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load the exercise library.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [searchTerm, selectedMuscle, equipment, page, retry]);

  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); openerRef.current?.focus(); };
  }, [selected]);

  const closeSheet = () => setSelected(null);
  return (
    <div className="coach-library">
      <header className="coach-header library-header">
        <button className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button>
        <h2>Exercise library</h2>
      </header>
      <label className="library-search">
        <Icon name="search" size={19}/>
        <input type="search" aria-label="Search Exercise" placeholder="Search Exercise" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }}/>
        {searchTerm && <button type="button" onClick={() => { setSearchTerm(''); setPage(1); }} aria-label="Clear search"><Icon name="close" size={16}/></button>}
      </label>
      <div className="filter-row" role="group" aria-label="Muscle group">
        {muscles.map(item => <button type="button" key={item} aria-pressed={selectedMuscle === item} onClick={() => { setSelectedMuscle(item); setPage(1); }}><span>{item}</span></button>)}
      </div>
      <div className="filter-row equipment-filters" role="group" aria-label="Equipment">
        {equipmentTypes.map(item => <button type="button" key={item} aria-pressed={equipment === item} onClick={() => { setEquipment(item); setPage(1); }}><span>{item}</span></button>)}
      </div>
      <div className="library-caption"><p className="result-count" role="status">{loading ? '' : error ? 'Library unavailable' : `${total} results`}</p><a className="library-sample-label" href="https://wger.de" target="_blank" rel="noreferrer">Powered by wger</a></div>
      {loading && <div className="empty-library" role="status" aria-live="polite"><p>Loading exercises… Please wait.</p></div>}
      {error && <div className="empty-library" role="alert"><p>{error}</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      <div className="library-list" aria-busy={loading}>
        {items.map(item => (
          <button type="button" className="library-item" key={item._id} aria-haspopup="dialog" onClick={event => { openerRef.current = event.currentTarget; setMediaError(false); setSelected(item); }}>
            <span className="exercise-thumb">{item.pictureUrl ? <img src={item.pictureUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Icon name="library-dumbbells" size={24}/>}</span>
            <span className="library-copy"><b>{item.name}</b><small>{item.targetMuscle} · {item.equipment}</small></span>
            <span className="tracking-tag manual">Manual</span>
          </button>
        ))}
        {!loading && !error && !items.length && <div className="empty-library"><p>No exercises match those filters.</p><button type="button" className="secondary" onClick={() => { setSearchTerm(''); setSelectedMuscle('All'); setEquipment('Any equipment'); setPage(1); }}>Reset filters</button></div>}
      </div>
      {!loading && !error && pages > 1 && <nav className="library-caption" aria-label="Exercise pages"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
      {selected && (
        <dialog ref={dialogRef} className="library-dialog" aria-labelledby="library-exercise-title" aria-describedby="library-tracking-note" onCancel={closeSheet} onClick={event => { if (event.target === event.currentTarget) closeSheet(); }}>
          <article className="exercise-sheet library-exercise-sheet">
            <header className="library-sheet-header">
              <div><h3 id="library-exercise-title">{selected.name}</h3><p>{selected.targetMuscle} · {selected.equipment}</p></div>
              <button type="button" className="sheet-close" onClick={closeSheet} aria-label="Close exercise details" autoFocus><Icon name="close" size={18}/></button>
            </header>
            <div className="library-video library-video-placeholder">
              {selected.videoUrl ? <video src={selected.videoUrl} poster={selected.pictureUrl || undefined} controls playsInline preload="none" onError={() => setMediaError(true)} style={{ width: '100%', maxHeight: 300 }}/> : selected.pictureUrl ? <img src={selected.pictureUrl} alt={selected.name} style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }}/> : <span className="library-video-unavailable"><Icon name="library-dumbbells" size={40}/><small>No media available for this exercise</small></span>}
            </div>
            {mediaError && <p role="status">This video cannot play in your browser. <a href={selected.videoUrl} target="_blank" rel="noreferrer">Open the original video</a>.</p>}
            <section className="library-instructions"><h4>How to do it</h4>{selected.instructions.length ? <ol>{selected.instructions.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol> : <p>No English instructions are available for this exercise.</p>}</section>
            <p id="library-tracking-note" className="library-preview-note">Manual tracking · AI form tracking is not available for this exercise.</p>
            <Credit label="Instructions" credit={selected.attribution}/>
            {selected.pictureUrl && <Credit label="Image" credit={selected.imageAttribution}/>}
            {selected.videoUrl && <Credit label="Video" credit={selected.videoAttribution}/>}
          </article>
        </dialog>
      )}
    </div>
  );
}
