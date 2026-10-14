'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { filterLibrary, libraryEquipment, libraryMuscles, libraryPreview, type LibraryExercise } from './libraryPreview';

export default function ExerciseLibrary({ onBack }: { onBack: () => void; selectedEquipment: string[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [equipment, setEquipment] = useState('Dumbbells');
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [mediaNotice, setMediaNotice] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const exercises = filterLibrary(libraryPreview, searchTerm, selectedMuscle, equipment);

  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); openerRef.current?.focus(); };
  }, [selected]);

  const closeSheet = () => setSelected(null);
  const showMediaNotice = () => setMediaNotice(true);

  return (
    <div className="coach-library">
      <header className="coach-header library-header">
        <button className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button>
        <h2>Exercise library</h2>
      </header>
      <label className="library-search">
        <Icon name="search" size={19}/>
        <input type="search" aria-label="Search Exercise" placeholder="Search Exercise" value={searchTerm} onChange={event => setSearchTerm(event.target.value)}/>
        {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search"><Icon name="close" size={16}/></button>}
      </label>
      <div className="filter-row" role="group" aria-label="Muscle group">
        {libraryMuscles.map(item => <button type="button" key={item} aria-pressed={selectedMuscle === item} onClick={() => setSelectedMuscle(item)}><span>{item}</span></button>)}
      </div>
      <div className="filter-row equipment-filters" role="group" aria-label="Equipment">
        {libraryEquipment.map(item => <button type="button" key={item} aria-pressed={equipment === item} onClick={() => setEquipment(item)}><span>{item}</span></button>)}
      </div>
      <div className="library-caption"><p className="result-count" role="status">{exercises.length} results</p><span className="library-sample-label">Sample library</span></div>
      <div className="library-list">
        {exercises.map(item => (
          <button type="button" className="library-item" key={item.name} aria-haspopup="dialog" onClick={event => { openerRef.current = event.currentTarget; setMediaNotice(false); setSelected(item); }}>
            <span className="exercise-thumb"><Icon name="library-dumbbells" size={24}/><i><Icon name="play" size={8}/></i></span>
            <span className="library-copy"><b>{item.name}</b><small>{item.muscle} · {item.equipment} · {item.level}</small></span>
            <span className={`tracking-tag ${item.tag === 'Caution' ? 'caution' : item.tag === 'Manual' ? 'manual' : ''}`}>{item.tag === 'Caution' && <Icon name="warning" size={11}/>} {item.tag}</span>
          </button>
        ))}
        {!exercises.length && <div className="empty-library"><p>No exercises match those filters.</p><button type="button" className="secondary" onClick={() => { setSearchTerm(''); setSelectedMuscle('All'); setEquipment('Any equipment'); }}>Reset filters</button></div>}
      </div>
      {selected && (
        <dialog ref={dialogRef} className="library-dialog" aria-labelledby="library-exercise-title" aria-describedby="library-preview-note" onCancel={closeSheet} onClick={event => { if (event.target === event.currentTarget) closeSheet(); }}>
          <article className="exercise-sheet library-exercise-sheet">
            <header className="library-sheet-header">
              <div><h3 id="library-exercise-title">{selected.name}</h3><p>{selected.muscle} · {selected.equipment} · {selected.level}</p></div>
              <button type="button" className="sheet-close" onClick={closeSheet} aria-label="Close exercise details" autoFocus><Icon name="close" size={18}/></button>
            </header>
            <div className={`library-video ${selected.poster ? 'library-video-bench' : 'library-video-placeholder'}`}>
              {selected.poster ? <img className="library-reference-poster" src={selected.poster} alt="Sample dumbbell bench press video preview"/> : <span className="library-video-unavailable"><Icon name="library-dumbbells" size={40}/><small>Video coming soon</small></span>}
              <button type="button" className="library-video-play" onClick={showMediaNotice} aria-label="Play exercise video preview"><Icon name="play" size={22}/></button>
              <div className="library-video-controls"><button type="button" onClick={showMediaNotice} aria-label="Play exercise video preview"><Icon name="play" size={12}/></button><span className="library-video-track" aria-hidden="true"/><span>0:00 / {selected.poster ? '0:42' : '—'}</span></div>
            </div>
            {mediaNotice && <p className="library-media-notice" role="status">Sample preview only. Exercise video playback is not connected yet.</p>}
            <div className="library-recommendation"><span>Recommended <b>{selected.recommended}</b></span><span className={selected.tag === 'Caution' ? 'library-form-caution' : 'library-form-label'}><Icon name={selected.tag === 'Caution' ? 'warning' : 'coach'} size={15}/>{selected.tag === 'Caution' ? 'Caution' : 'AI form tracking'}</span></div>
            <section className="library-instructions"><h4>How to do it</h4><ol>{selected.instructions.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>
            <section className="library-form-checks"><h4>What the AI checks</h4><ul>{selected.checks.map(check => <li key={check}><Icon name="check-circle" size={16}/><span>{check}</span></li>)}</ul></section>
            <p id="library-preview-note" className="library-preview-note">Sample preview · AI form tracking is not connected.</p>
          </article>
        </dialog>
      )}
    </div>
  );
}
