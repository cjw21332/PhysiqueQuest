'use client';
import { titleCase } from '../../lib/titleCase';

import { useEffect, useRef, useState } from 'react';
import { api, type ExerciseCatalog, type ExerciseRecord, type ExerciseFilters, type ExerciseDiscoveryQuery } from '../../lib/api';
import { prepareExerciseCatalog } from '../../lib/prepareExerciseCatalog';
import { cachedCatalog, cachedCount, cachedExercise, cachedFilters, readCatalogMetadata, saveExercises, trackingPriority } from '../../lib/exerciseCatalogDb';
import { exerciseMediaStatus } from '../../lib/exerciseMediaCache';
import exerciseVideoFallbacks from '../../lib/exerciseVideoFallbacks.json';
import exerciseGifFallbacks from '../../lib/exerciseGifFallbacks.json';
import { getCurrentUser } from '../../lib/auth';
import { Icon } from '../Home/icons';
import './libraryreference.css';
import { canTrack, resolveTrackingConfig, type TrackingConfig } from '../../../backend/src/pose-tracker/exercise-registry';
import PoseTrackerSession from './PoseTrackerSession';
import { readPersonalExercises, type PersonalExercise } from '../../lib/personalExercises';

const equipmentOptions = ['Any equipment', 'Dumbbells', 'Barbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Resistance bands'];
const metadata = (item: ExerciseRecord) => [item.targetMuscle || item.group, item.equipment, item.difficulty].filter(Boolean).join(' · ');
const videoFallbackById = exerciseVideoFallbacks as Record<string, { url: string; sourceName: string; relation: 'exact' | 'equivalent' | 'related' }>;
const gifFallbackById = exerciseGifFallbacks as Record<string, { url: string; sourceName: string; relation: 'exact' | 'equivalent' | 'related' }>;
const variationDescriptors: [RegExp, string][] = [
  [/\b(single[- ]arm|one[- ]arm)\b/i, 'Single arm'], [/\b(single[- ]leg|one[- ]leg)\b/i, 'Single leg'],
  [/\b(alternate|alternating)\b/i, 'Alternating'], [/\breverse[- ]grip\b/i, 'Reverse grip'],
  [/\bunderhand\b/i, 'Underhand grip'], [/\bwide[- ]grip\b/i, 'Wide grip'], [/\bclose[- ]grip\b/i, 'Close grip'],
  [/\bneutral[- ]grip\b/i, 'Neutral grip'], [/\bincline\b/i, 'Incline'], [/\bdecline\b/i, 'Decline'],
  [/\bseated\b/i, 'Seated'], [/\bstanding\b/i, 'Standing'], [/\bkneeling\b/i, 'Kneeling'], [/\blying\b/i, 'Lying'],
  [/\bassisted\b/i, 'Assisted'], [/\bbetween benches\b/i, 'Between benches'], [/\bon (?:an? )?exercise ball\b/i, 'On exercise ball'],
  [/\bon (?:an? )?box\b/i, 'On a box'], [/\bwall\b/i, 'Wall variation'],
];
const exerciseVariations = (name: string) => variationDescriptors.filter(([pattern]) => pattern.test(name)).map(([, label]) => label).slice(0, 2);

function FilterPicker({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  return <div className="library-picker">
    <span>{label}</span>
    <button ref={button} type="button" className="library-picker-trigger" aria-label={`${label}: ${options.find(option => option.value === value)?.label || value}`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>{options.find(option => option.value === value)?.label || value}<span aria-hidden="true">⌄</span></button>
    <dialog ref={dialog} className="library-picker-dialog" aria-label={label} onClose={() => button.current?.focus()} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="library-picker-panel"><header><h3>{label}</h3><button type="button" aria-label={`Close ${label}`} onClick={() => dialog.current?.close()}>×</button></header>
        <div className="library-picker-options">{options.map(option => <button key={option.value} type="button" className={value === option.value ? 'selected' : ''} aria-pressed={value === option.value} onClick={() => { onChange(option.value); dialog.current?.close(); }}>{option.label}{value === option.value && <span aria-hidden="true">✓</span>}</button>)}</div>
      </div>
    </dialog>
  </div>;
}

export default function ExerciseLibrary({ onBack, selectedEquipment = [], onStartPersonal }: { onBack: () => void; selectedEquipment?: string[]; onStartPersonal?: (item: PersonalExercise, mode: 'manual' | 'upload') => void }) {
  const [personal, setPersonal] = useState<PersonalExercise[]>([]);
  useEffect(() => { try { setPersonal(readPersonalExercises()); } catch { setPersonal([]); } }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [equipment, setEquipment] = useState(() => selectedEquipment.length === 1 ? equipmentOptions.find(option => option.toLowerCase().replace(/s$/, '') === selectedEquipment[0].toLowerCase().replace(/s$/, '')) || 'Any equipment' : 'Any equipment');
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<ExerciseCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [offline, setOffline] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [bodyPart, setBodyPart] = useState('');
  const [target, setTarget] = useState('');
  const [secondary, setSecondary] = useState('');
  const [sort, setSort] = useState<ExerciseDiscoveryQuery['sort']>();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ExerciseFilters>({ bodyParts: [], equipments: [], targetMuscles: [], secondaryMuscles: [] });
  const [selected, setSelected] = useState<ExerciseRecord | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [gifFallbackError, setGifFallbackError] = useState(false);
  const [detail, setDetail] = useState<ExerciseRecord | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [mediaCached, setMediaCached] = useState(false);
  const [preview, setPreview] = useState<ExerciseRecord | null>(null);
  const [trackingConfigs,setTrackingConfigs] = useState<Record<string,TrackingConfig>>({});
  useEffect(()=>{
    if(!catalog?.items.length)return;let active=true;
    void api.getPoseTrackerConfigs(catalog.items.map(r=>r._id)).then(rows=>{if(active&&Array.isArray(rows))setTrackingConfigs(Object.fromEntries(rows.map(r=>[r.exerciseId,r])));}).catch(()=>{});
    return()=>{active=false;};
  },[catalog]);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const queryCache = useRef(new Map<string, { value: ExerciseCatalog; time: number }>());
  const detailCache = useRef(new Map<string, { value: ExerciseRecord; time: number }>());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('physiquequest-exercise-preferences') || '{}');
      if (typeof saved.search === 'string') setSearchTerm(saved.search.slice(0, 100));
      if (typeof saved.equipment === 'string' && saved.equipment.length <= 100) setEquipment(saved.equipment);
      if (typeof saved.bodyPart === 'string') setBodyPart(saved.bodyPart);
      if (typeof saved.target === 'string') setTarget(saved.target);
      if (typeof saved.secondary === 'string') setSecondary(saved.secondary);
      if (['name-asc', 'name-desc', 'body-part', 'equipment'].includes(saved.sort)) setSort(saved.sort);
    } catch { /* Preferences are optional. */ }
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    try { localStorage.setItem('physiquequest-exercise-preferences', JSON.stringify({ search: searchTerm, equipment, bodyPart, target, secondary, sort })); } catch { /* Preferences are optional. */ }
  }, [preferencesReady, searchTerm, equipment, bodyPart, target, secondary, sort]);
  useEffect(() => {
    let active = true;
    void cachedFilters().then(value => { if (active) setFilters(value); }).catch(() => {});
    void api.getExerciseFilters().then(value => {
      if (!active) return;
      // An unavailable catalog service returns empty arrays. Do not replace
      // useful on-device filter choices with an empty server response.
      setFilters(current => ({
        bodyParts: value.bodyParts?.length ? value.bodyParts : current.bodyParts,
        equipments: value.equipments?.length ? value.equipments : current.equipments,
        targetMuscles: value.targetMuscles?.length ? value.targetMuscles : current.targetMuscles,
        secondaryMuscles: value.secondaryMuscles?.length ? value.secondaryMuscles : current.secondaryMuscles,
      }));
    }).catch(() => {});
    return () => { active = false; };
  }, [offline]);
  useEffect(() => {
    libraryRef.current?.closest('.coach-scroll')?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let current = true;
    const query = { search: searchTerm.trim() || undefined, equipment: equipment === 'Any equipment' ? undefined : equipment, bodyPart: bodyPart || undefined, target: target || undefined, secondary: secondary || undefined, sort, page, limit: 12 };
    const key = JSON.stringify(query);
    const hot = queryCache.current.get(key);
    if (hot && Date.now() - hot.time < 60000 && retry === 0) { setCatalog(hot.value); setLoading(false); setError(''); return () => { current = false; }; }
    const owner = getCurrentUser();
    let local: ExerciseCatalog | null = null;
    let hasLocalRecords = false;
    setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      let completeLocal = false;
      try { const [cached, count, metadata] = await Promise.all([cachedCatalog(query), cachedCount(), readCatalogMetadata()]); local = cached; hasLocalRecords = count > 0; completeLocal = !!metadata && count === metadata.count; if (current && hasLocalRecords) { setCatalog(local); setLoading(false); } } catch { /* Device storage is optional. */ }
      try {
        const result = await api.getExercises(query);
        const active = getCurrentUser();
        if (current && owner && active && owner.id === active.id && owner.sessionKey === active.sessionKey) { const shown = !sort && completeLocal && local && local.total === result.total ? { ...local, coverageNote: undefined } : !sort ? { ...result, items: [...result.items].sort((a, b) => trackingPriority(a) - trackingPriority(b)) } : result; queryCache.current.set(key, { value: shown, time: Date.now() }); setCatalog(shown); setOffline(false); void saveExercises(result.items).then(() => { if (current && result.items.length) setStorageUnavailable(false); }).catch(() => { if (current) setStorageUnavailable(true); }); }
      } catch (err) {
        if (current && !hasLocalRecords) setError('Could not load exercises. Check your connection and try again.');
        else if (current) { setCatalog(local); setOffline(true); }
      } finally { if (current) setLoading(false); }
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [searchTerm, equipment, bodyPart, target, secondary, sort, page, retry]);

  useEffect(() => {
    let cancelled = false;
    const synchronize = () => prepareExerciseCatalog().catch(error => {
      if (!cancelled && error instanceof DOMException && ['QuotaExceededError', 'InvalidStateError', 'UnknownError'].includes(error.name)) setStorageUnavailable(true);
    });
    void synchronize();
    const timer = window.setInterval(() => { void synchronize(); }, 60000);
    const reconnect = () => { setRetry(value => value + 1); void synchronize(); };
    const disconnect = () => { setOffline(true); setRetry(value => value + 1); };
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', disconnect);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('online', reconnect); window.removeEventListener('offline', disconnect); };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); openerRef.current?.focus(); };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let current = true;
    const owner = getCurrentUser();
    let refreshed = false;
    setDetail(selected); setDetailError(''); setMediaError(false); setFallbackError(false); setGifFallbackError(false); setPlaying(false); setFrameReady(false);
    const hot = detailCache.current.get(selected._id);
    if (hot && Date.now() - hot.time < 60000 && detailRetry === 0) { setDetail(hot.value); return () => { current = false; }; }
    void cachedExercise(selected._id).then(record => { if (current && record && !refreshed) setDetail(record); }).catch(() => {});
    api.getExercise(selected._id).then(record => { const active = getCurrentUser(); if (current && owner && active && owner.id === active.id && owner.sessionKey === active.sessionKey) { refreshed = true; detailCache.current.set(record._id, { value: record, time: Date.now() }); setDetail(record); void saveExercises([record]).catch(() => {}); } }).catch(err => { if (current) setDetailError(err instanceof Error ? err.message : 'Could not refresh exercise details.'); });
    return () => { current = false; };
  }, [selected, detailRetry]);

  useEffect(() => {
    let current = true;
    setMediaCached(false);
    if (detail?.gifUrl) void exerciseMediaStatus(detail.gifUrl).then(cached => { if (current) setMediaCached(cached); });
    return () => { current = false; };
  }, [detail?.gifUrl]);

  const freezeFrame = () => {
    const img = imageRef.current, canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    setFrameReady(true);
  };

  const reset = () => { setSearchTerm(''); setEquipment('Any equipment'); setBodyPart(''); setTarget(''); setSecondary(''); setSort(undefined); setPage(1); };
  const trackingLabel = (item: ExerciseRecord) => { const config = trackingConfigs[item._id] ?? resolveTrackingConfig(item); return canTrack(config) ? (config.validationStatus === 'verified' || config.nativeSupport === 'FULLY_SUPPORTED' ? 'Camera tracking' : 'Camera tracking · needs review') : 'Manual tracking'; };
  const personalMatches = personal.filter(item => item.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) && (equipment === 'Any equipment' || item.equipment.toLowerCase() === equipment.toLowerCase()) && (!target || item.targetMuscle.toLowerCase() === target.toLowerCase()) && (!bodyPart || item.targetMuscle.toLowerCase() === bodyPart.toLowerCase()) && !secondary).sort((a, b) => sort === 'name-desc' ? b.name.localeCompare(a.name) : sort === 'equipment' ? a.equipment.localeCompare(b.equipment) || a.name.localeCompare(b.name) : sort === 'body-part' ? a.targetMuscle.localeCompare(b.targetMuscle) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));

  if (preview) return <PoseTrackerSession key={preview._id} exercise={preview} onExit={() => setPreview(null)}/>;

  return <div className="coach-library" ref={libraryRef}>
    <header className="coach-header library-header pq-page-heading">
      <button type="button" className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button>
      <h2 ref={headingRef} tabIndex={-1}>Exercise library</h2>
    </header>
    <div className="library-discover-intro"><span aria-hidden="true"><Icon name="library-dumbbells" size={22}/></span><div><strong>Find your next exercise</strong><p>Explore movements, watch demonstrations and choose how to track.</p></div></div>
    {catalog && offline && <p className="library-offline-status" role="status">Offline: showing saved exercises.</p>}
    {storageUnavailable && <p role="status">Offline saving is unavailable.</p>}
    <label className="library-search">
      <Icon name="search" size={19}/>
      <input type="search" aria-label="Search Exercise" placeholder="Search Exercise" maxLength={100} value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }}/>
      {searchTerm && <button type="button" onClick={() => { setSearchTerm(''); setPage(1); }} aria-label="Clear search"><Icon name="close" size={16}/></button>}
    </label>
    <div className="library-filter-heading"><button type="button" className="library-filter-toggle" aria-expanded={filtersOpen} aria-controls="library-filter-controls" onClick={() => setFiltersOpen(value => !value)}><Icon name="filter" size={18}/><span>Filters &amp; sorting</span><Icon name="chevron-down" size={16}/></button></div>
    <div id="library-filter-controls" className="library-discovery-controls" hidden={!filtersOpen}>
      <FilterPicker label="Body part" value={bodyPart} options={[{ value: '', label: 'All body parts' }, ...filters.bodyParts.map(value => ({ value, label: titleCase(value) }))]} onChange={value => { setBodyPart(value); setPage(1); }}/>
      <FilterPicker label="Equipment type" value={equipment} options={[...new Map([...equipmentOptions, ...filters.equipments, equipment].map(value => [value.toLowerCase(), value])).values()].map(value => ({ value, label: titleCase(value) }))} onChange={value => { setEquipment(value); setPage(1); }}/>
      <FilterPicker label="Target muscle" value={target} options={[{ value: '', label: 'All target muscles' }, ...filters.targetMuscles.map(value => ({ value, label: titleCase(value) }))]} onChange={value => { setTarget(value); setPage(1); }}/>
      <FilterPicker label="Secondary muscle" value={secondary} options={[{ value: '', label: 'All secondary muscles' }, ...filters.secondaryMuscles.map(value => ({ value, label: titleCase(value) }))]} onChange={value => { setSecondary(value); setPage(1); }}/>
      <FilterPicker label="Sort by" value={sort || ''} options={[{ value: '', label: 'Camera options first' }, { value: 'name-asc', label: 'Name A–Z' }, { value: 'name-desc', label: 'Name Z–A' }, { value: 'body-part', label: 'Body part' }, { value: 'equipment', label: 'Equipment' }]} onChange={value => { setSort((value || undefined) as ExerciseDiscoveryQuery['sort']); setPage(1); }}/>
      <div className="library-filter-clear">{(searchTerm || equipment !== 'Any equipment' || bodyPart || target || secondary || sort) && <button type="button" onClick={reset}>Clear filters</button>}</div>
    </div>
    {personal.length > 0 && <section className="personal-library" aria-labelledby="personal-library-title"><div className="personal-library-heading"><div><h3 id="personal-library-title">My exercises</h3><p>Saved on this device · manual tracking</p></div><span>{personalMatches.length}</span></div>{personalMatches.length ? <div className="personal-library-list">{personalMatches.map(item => <article className="personal-exercise-card" key={item._id}><div className="personal-exercise-info"><span className="personal-exercise-icon" aria-hidden="true"><Icon name="library-dumbbells" size={20}/></span><div><h4>{titleCase(item.name)}</h4><p>{titleCase(item.targetMuscle)} · {titleCase(item.equipment)}</p><span className="tracking-tag manual">Manual tracking</span></div></div>{onStartPersonal && <div className="personal-exercise-actions"><button type="button" className="secondary" aria-label={`Log ${item.name} manually`} onClick={() => onStartPersonal(item, 'manual')}>Log manually</button><button type="button" className="secondary" aria-label={`Review a video for ${item.name}`} onClick={() => onStartPersonal(item, 'upload')}>Review a video</button></div>}</article>)}</div> : <p className="personal-library-empty">No personal exercises match these filters.</p>}</section>}
    {loading && <p role="status">Loading exercises…</p>}
    {error && <div className="empty-library" role="alert"><p>{error}</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {!loading && catalog && <>
      <div className="library-caption library-results-heading"><div><h3>Explore exercises</h3><p className="result-count" role="status">{catalog.total} {catalog.total === 1 ? 'exercise' : 'exercises'}</p></div><span>{sort ? 'Open a guide' : 'Camera options first on this page'}</span></div>
      <div className="library-list">
        {catalog.items.map(item => {
          const hasDemo = !!item.gifUrl || !!videoFallbackById[item._id] || !!gifFallbackById[item._id];
          const variations = exerciseVariations(item.name);
          return <button type="button" className="library-item" key={item._id} aria-haspopup="dialog" onClick={event => { openerRef.current = event.currentTarget; setMediaError(false); setFallbackError(false); setGifFallbackError(false); setSelected(item); }}>
          <span className="exercise-thumb"><Icon name="library-dumbbells" size={24}/>{hasDemo && <i><Icon name="play" size={8}/></i>}</span>
          <span className="library-copy"><b>{titleCase(item.name)}</b><small>{metadata(item)}</small>{variations.length > 0 && <span className="library-variation-tag">Variation · {variations.join(' · ')}</span>}<span className="library-item-meta"><span className={`tracking-tag ${trackingLabel(item) === 'Manual tracking' ? 'manual' : ''}`}>{trackingLabel(item)}</span>{hasDemo && <span className="library-demo-label">Demo</span>}</span></span>
          <Icon name="arrow" size={16}/>
        </button>})}
        {!catalog.items.length && <div className="empty-library"><p>No exercises match those filters.</p><button type="button" className="secondary" onClick={reset}>Reset filters</button></div>}
      </div>
      {catalog.pages > 1 && <nav className="library-caption" aria-label="Exercise pages"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page} of {catalog.pages}</span><button type="button" className="secondary" disabled={page >= catalog.pages} onClick={() => setPage(value => value + 1)}>Next page</button></nav>}
      {catalog.coverageNote && <p className="library-preview-note">{catalog.coverageNote}</p>}
      <p className="library-preview-note">Exercise data by <a href="https://ascendapi.com" target="_blank" rel="noreferrer">AscendAPI</a>.</p>
    </>}
    {selected && <dialog ref={dialogRef} className="library-dialog" aria-labelledby="library-exercise-title" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <article className="exercise-sheet library-exercise-sheet">
        <header className="library-sheet-header"><div><h3 id="library-exercise-title">{titleCase(detail?.name || selected.name)}</h3><p>{metadata(detail || selected)}</p>{exerciseVariations(detail?.name || selected.name).length > 0 && <span className="library-variation-tag">Movement variation · {exerciseVariations(detail?.name || selected.name).join(' · ')}</span>}</div><button type="button" className="sheet-close" onClick={() => setSelected(null)} aria-label="Close exercise details" autoFocus><Icon name="close" size={18}/></button></header>
        <div className="library-sheet-content">
        {!detail && !detailError && <p role="status">Loading exercise details…</p>}
        {detailError && <div role="alert" className="empty-library"><p>{detailError}</p><button type="button" className="secondary" onClick={() => setDetailRetry(value => value + 1)}>Retry details</button></div>}
        {detail && <>
          <div className="library-demo">
            {detail.gifUrl && !mediaError ? <>
              <img ref={imageRef} src={detail.gifUrl} loading="lazy" alt={`Exercise demonstration - ${titleCase(detail.name)}`} style={{ visibility: playing || !frameReady ? 'visible' : 'hidden' }} onLoad={() => { freezeFrame(); const url = detail.gifUrl; if (url) void exerciseMediaStatus(url, true).then(cached => { if (imageRef.current?.src === url) setMediaCached(cached); }); }} onError={() => { setMediaError(true); setPlaying(false); }}/>
              <canvas ref={canvasRef} aria-hidden="true" style={{ visibility: !playing && frameReady ? 'visible' : 'hidden' }}/>
              <button type="button" className={`library-demo-toggle ${playing ? 'is-playing' : ''}`} aria-label={playing ? 'Pause exercise demonstration' : 'Play exercise demonstration'} onClick={() => { if (playing) freezeFrame(); setPlaying(value => !value); }}><Icon name={playing ? 'pause' : 'play'} size={22}/></button>
            </> : videoFallbackById[detail._id] && !fallbackError ? <video className="library-fallback-video" controls playsInline preload="metadata" aria-label={`Exercise demonstration - ${titleCase(detail.name)}`} src={videoFallbackById[detail._id].url} onError={() => setFallbackError(true)} /> : gifFallbackById[detail._id] && !gifFallbackError ? <img className="library-fallback-gif" src={gifFallbackById[detail._id].url} loading="lazy" alt={`Exercise demonstration - ${titleCase(detail.name)}`} onError={() => setGifFallbackError(true)} /> : <span className="library-video-unavailable"><Icon name="library-dumbbells" size={40}/><small>{mediaError || fallbackError || gifFallbackError ? 'Could not load this demonstration.' : 'No demonstration available'}</small></span>}
          </div>
          {(!detail.gifUrl || mediaError) && videoFallbackById[detail._id] && <p className="library-preview-note">{videoFallbackById[detail._id].relation === 'related' ? `Related variation shown: ${videoFallbackById[detail._id].sourceName}. ` : `Movement shown: ${videoFallbackById[detail._id].sourceName}. `}<a href="https://github.com/harshvishu/free-exercise-db-with-videos" target="_blank" rel="noreferrer">Free Exercise DB with Videos</a>.</p>}
          {(!detail.gifUrl || mediaError) && !videoFallbackById[detail._id] && gifFallbackById[detail._id] && <p className="library-preview-note">{gifFallbackById[detail._id].relation === 'related' ? `Related variation shown: ${gifFallbackById[detail._id].sourceName}. ` : `Movement shown: ${gifFallbackById[detail._id].sourceName}. `}<a href="https://github.com/Alejor-Dev/ejercicios-dataset" target="_blank" rel="noreferrer">ExerciseDB media archive</a> (educational use).</p>}
          {(fallbackError || gifFallbackError || (mediaError && !videoFallbackById[detail._id] && !gifFallbackById[detail._id])) && <button type="button" className="secondary library-media-retry" onClick={() => { setFallbackError(false); setGifFallbackError(false); setDetailRetry(value => value + 1); }}>Retry demonstration</button>}
          {detail.gifUrl && !mediaError && <p className="library-preview-note">{mediaCached ? 'Demonstration available offline.' : 'Demonstration requires a connection.'}</p>}
          <div className="library-recommendation">{detail.recommended && <span>Recommended <b>{detail.recommended}</b></span>}<span className="library-manual-label">{trackingLabel(detail)}</span></div>
          {detail.description && <p className="library-description">{detail.description}</p>}
          <section className="library-instructions"><h4>How to do it</h4>{detail.instructions?.length ? <ol>{detail.instructions.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step.replace(/^Step\s*\d+\s*[:.\-]?\s*/i, '')}</p></li>)}</ol> : <p>No instructions are available for this exercise.</p>}</section>
          {!!detail.checks?.length && <section className="library-form-checks"><h4>Form cues</h4><ul>{detail.checks.map((cue, index) => <li key={index}>{cue}</li>)}</ul></section>}
          <p className="library-preview-note">Exercise data by <a href="https://ascendapi.com" target="_blank" rel="noreferrer">AscendAPI</a>.</p>
          <section className="library-tracking-cta" aria-label="Exercise tracking"><div><h4>Track your movement</h4><p>{canTrack(trackingConfigs[detail._id] ?? resolveTrackingConfig(detail)) ? 'Camera tracking is available as an estimate. Review the results after your session.' : 'Camera tracking for this movement is not ready yet. You can still log your workout manually.'}</p></div><button type="button" onClick={() => { setSelected(null); setPreview(detail); }}>View tracking options <Icon name="arrow" size={18}/></button></section>
        </>}
        </div>
      </article>
    </dialog>}
  </div>;
}
