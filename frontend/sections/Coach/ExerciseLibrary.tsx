'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseCatalog, type ExerciseRecord } from '../../lib/api';
import { Icon } from '../Home/icons';
import './libraryreference.css';

const muscles = ['All', 'Chest', 'Back', 'Legs', 'Core', 'Shoulders', 'Arms'];
const equipmentOptions = ['Any equipment', 'Dumbbells', 'Barbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Resistance bands'];
const metadata = (item: ExerciseRecord) => [item.targetMuscle || item.group, item.equipment, item.difficulty].filter(Boolean).join(' · ');

export default function ExerciseLibrary({ onBack, selectedEquipment = [] }: { onBack: () => void; selectedEquipment?: string[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [equipment, setEquipment] = useState(() => selectedEquipment.length === 1 ? equipmentOptions.find(option => option.toLowerCase().replace(/s$/, '') === selectedEquipment[0].toLowerCase().replace(/s$/, '')) || 'Any equipment' : 'Any equipment');
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<ExerciseCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<ExerciseRecord | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [detail, setDetail] = useState<ExerciseRecord | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setCatalog(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.getExercises({ search: searchTerm.trim() || undefined, muscle: selectedMuscle === 'All' ? undefined : selectedMuscle, equipment: equipment === 'Any equipment' ? undefined : equipment, page, limit: 12 });
        if (current) setCatalog(result);
      } catch (err) {
        if (current) setError(err instanceof Error ? err.message : 'Could not load exercises.');
      } finally { if (current) setLoading(false); }
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [searchTerm, selectedMuscle, equipment, page, retry]);

  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); openerRef.current?.focus(); };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let current = true;
    setDetail(null); setDetailError(''); setMediaError(false); setPlaying(false); setFrameReady(false);
    api.getExercise(selected._id).then(record => { if (current) setDetail(record); }).catch(err => { if (current) setDetailError(err instanceof Error ? err.message : 'Could not load exercise details.'); });
    return () => { current = false; };
  }, [selected, detailRetry]);

  const freezeFrame = () => {
    const img = imageRef.current, canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    setFrameReady(true);
  };

  const reset = () => { setSearchTerm(''); setSelectedMuscle('All'); setEquipment('Any equipment'); setPage(1); };
  const trackingLabel = (item: ExerciseRecord) => item.pose === 'missing' ? 'Manual' : item.trackingStatus || 'Manual';

  return <div className="coach-library">
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
      {equipmentOptions.map(item => <button type="button" key={item} aria-pressed={equipment === item} onClick={() => { setEquipment(item); setPage(1); }}><span>{item}</span></button>)}
    </div>
    {loading && <p role="status">Loading exercises…</p>}
    {error && <div className="empty-library" role="alert"><p>{error}</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {!loading && !error && catalog && <>
      <div className="library-caption"><p className="result-count" role="status">{catalog.total} results</p></div>
      <div className="library-list">
        {catalog.items.map(item => <button type="button" className="library-item" key={item._id} aria-haspopup="dialog" onClick={event => { openerRef.current = event.currentTarget; setMediaError(false); setSelected(item); }}>
          <span className="exercise-thumb"><Icon name="library-dumbbells" size={24}/>{item.gifUrl && <i><Icon name="play" size={8}/></i>}</span>
          <span className="library-copy"><b>{item.name}</b><small>{metadata(item)}</small></span>
          <span className={`tracking-tag ${trackingLabel(item) === 'Caution' ? 'caution' : trackingLabel(item) === 'Manual' ? 'manual' : ''}`}>{trackingLabel(item)}</span>
        </button>)}
        {!catalog.items.length && <div className="empty-library"><p>No exercises match those filters.</p><button type="button" className="secondary" onClick={reset}>Reset filters</button></div>}
      </div>
      {catalog.pages > 1 && <nav className="library-caption" aria-label="Exercise pages"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page} of {catalog.pages}</span><button type="button" className="secondary" disabled={page >= catalog.pages} onClick={() => setPage(value => value + 1)}>Next page</button></nav>}
      {catalog.coverageNote && <p className="library-preview-note">{catalog.coverageNote}</p>}
      <p className="library-preview-note">Exercise data by <a href="https://ascendapi.com" target="_blank" rel="noreferrer">AscendAPI</a>.</p>
    </>}
    {selected && <dialog ref={dialogRef} className="library-dialog" aria-labelledby="library-exercise-title" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <article className="exercise-sheet library-exercise-sheet">
        <header className="library-sheet-header"><div><h3 id="library-exercise-title">{detail?.name || selected.name}</h3><p>{metadata(detail || selected)}</p></div><button type="button" className="sheet-close" onClick={() => setSelected(null)} aria-label="Close exercise details" autoFocus><Icon name="close" size={18}/></button></header>
        {!detail && !detailError && <p role="status">Loading exercise details…</p>}
        {detailError && <div role="alert" className="empty-library"><p>{detailError}</p><button className="secondary" onClick={() => setDetailRetry(value => value + 1)}>Retry details</button></div>}
        {detail && <>
          <div className="library-demo">
            {detail.gifUrl && !mediaError ? <>
              <img ref={imageRef} src={detail.gifUrl} alt={`Exercise demonstration - ${detail.name}`} style={{ visibility: playing || !frameReady ? 'visible' : 'hidden' }} onLoad={freezeFrame} onError={() => { setMediaError(true); setPlaying(false); }}/>
              <canvas ref={canvasRef} aria-hidden="true" style={{ visibility: !playing && frameReady ? 'visible' : 'hidden' }}/>
              <button type="button" className={`library-demo-toggle ${playing ? 'is-playing' : ''}`} aria-label={playing ? 'Pause exercise demonstration' : 'Play exercise demonstration'} onClick={() => { if (playing) freezeFrame(); setPlaying(value => !value); }}>{playing ? <span aria-hidden="true">Ⅱ</span> : <Icon name="play" size={22}/>}</button>
            </> : <span className="library-video-unavailable"><Icon name="library-dumbbells" size={40}/><small>{mediaError ? 'Could not load this demonstration.' : 'No demonstration available'}</small></span>}
          </div>
          {mediaError && <button type="button" className="secondary library-media-retry" onClick={() => setDetailRetry(value => value + 1)}>Retry demonstration</button>}
          <div className="library-recommendation">{detail.recommended && <span>Recommended <b>{detail.recommended}</b></span>}<span className="library-manual-label">Manual tracking</span></div>
          {detail.description && <p className="library-description">{detail.description}</p>}
          <section className="library-instructions"><h4>How to do it</h4>{detail.instructions?.length ? <ol>{detail.instructions.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step.replace(/^Step\s*\d+\s*[:.\-]?\s*/i, '')}</p></li>)}</ol> : <p>No instructions are available for this exercise.</p>}</section>
          {!!detail.checks?.length && <section className="library-form-checks"><h4>Form cues</h4><ul>{detail.checks.map((cue, index) => <li key={index}>{cue}</li>)}</ul></section>}
          <p className="library-preview-note">Exercise data by <a href="https://ascendapi.com" target="_blank" rel="noreferrer">AscendAPI</a>.</p>
        </>}
      </article>
    </dialog>}
  </div>;
}
