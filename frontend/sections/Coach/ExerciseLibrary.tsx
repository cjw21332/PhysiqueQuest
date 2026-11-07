'use client';
import { titleCase } from '../../lib/titleCase';

import { useEffect, useRef, useState } from 'react';
import { api, getCoachApiBaseUrl, type ExerciseCatalog, type ExerciseRecord, type ExerciseFilters, type ExerciseDiscoveryQuery } from '../../lib/api';
import { cachedCatalog, cachedCount, cachedExercise, cachedFilters, readCatalogMetadata, saveCatalogMetadata, saveExercises } from '../../lib/exerciseCatalogDb';
import { exerciseMediaStatus } from '../../lib/exerciseMediaCache';
import { getCurrentUser } from '../../lib/auth';
import { Icon } from '../Home/icons';
import './libraryreference.css';
import { canTrack, resolveTrackingConfig, type TrackingConfig } from '../../../backend/src/pose-tracker/exercise-registry';
import PoseTrackerSession from './PoseTrackerSession';

const equipmentOptions = ['Any equipment', 'Dumbbells', 'Barbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Resistance bands'];
const metadata = (item: ExerciseRecord) => [item.targetMuscle || item.group, item.equipment, item.difficulty].filter(Boolean).join(' · ');

export default function ExerciseLibrary({ onBack, selectedEquipment = [] }: { onBack: () => void; selectedEquipment?: string[] }) {
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
  const [filters, setFilters] = useState<ExerciseFilters>({ bodyParts: [], equipments: [], targetMuscles: [], secondaryMuscles: [] });
  const [selected, setSelected] = useState<ExerciseRecord | null>(null);
  const [mediaError, setMediaError] = useState(false);
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
    void api.getExerciseFilters().then(value => { if (active && Array.isArray(value.bodyParts)) setFilters(value); }).catch(() => {});
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
      try { [local, hasLocalRecords] = await Promise.all([cachedCatalog(query), cachedCount().then(count => count > 0)]); if (current && hasLocalRecords) { setCatalog(local); setLoading(false); } } catch { /* Device storage is optional. */ }
      try {
        const result = await api.getExercises(query);
        const active = getCurrentUser();
        if (current && owner && active && owner.id === active.id && owner.sessionKey === active.sessionKey) { queryCache.current.set(key, { value: result, time: Date.now() }); setCatalog(result); setOffline(false); void saveExercises(result.items).then(() => { if (current && result.items.length) setStorageUnavailable(false); }).catch(() => { if (current) setStorageUnavailable(true); }); }
      } catch (err) {
        if (current && !hasLocalRecords) setError(err instanceof Error ? err.message : 'Could not load exercises.');
        else if (current) { setCatalog(local); setOffline(true); }
      } finally { if (current) setLoading(false); }
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [searchTerm, equipment, bodyPart, target, secondary, sort, page, retry]);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const synchronize = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`${getCoachApiBaseUrl()}/exercises/sync-status`, { cache: 'no-store', credentials: 'omit' });
        if (!response.ok) return;
        const status = await response.json();
        if (cancelled) return;
        if (status.status !== 'complete') return;
        const metadata = await readCatalogMetadata();
        if (metadata && metadata.source === getCoachApiBaseUrl() && metadata.version === status.lastSuccessfulSync && metadata.count === status.count && await cachedCount() >= status.count) return;
        const seen = new Set<string>();
        for (let page = 1; !cancelled; page++) {
          const result = await api.getExercises({ page, limit: 100 });
          for (const item of result.items) seen.add(item._id);
          await saveExercises(result.items);
          if (page >= result.pages || !result.items.length) break;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (!cancelled && seen.size === status.count && typeof status.lastSuccessfulSync === 'string') await saveCatalogMetadata({ source: getCoachApiBaseUrl(), version: status.lastSuccessfulSync, count: seen.size, savedAt: Date.now() });
      } catch (error) { if (!cancelled && error instanceof DOMException && ['QuotaExceededError', 'InvalidStateError', 'UnknownError'].includes(error.name)) setStorageUnavailable(true); }
      finally { busy = false; }
    };
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
    setDetail(selected); setDetailError(''); setMediaError(false); setPlaying(false); setFrameReady(false);
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
  const trackingLabel = (item: ExerciseRecord) => item.pose === 'missing' ? 'Manual' : item.trackingStatus || 'Manual';

  if (preview) return <PoseTrackerSession key={preview._id} exercise={preview} onExit={() => setPreview(null)}/>;

  return <div className="coach-library" ref={libraryRef}>
    <header className="coach-header library-header">
      <button className="coach-back" onClick={onBack} aria-label="Back to AI Coach"><Icon name="arrow" size={20}/></button>
      <h2 ref={headingRef} tabIndex={-1}>Exercise library</h2>
    </header>
    <p className="library-intro">Browse exercise instructions and available demonstrations.</p>
    {catalog && <p role="status">{offline ? 'Offline: showing saved exercises.' : 'Exercise library is ready.'}</p>}
    {storageUnavailable && <p role="status">Offline saving is unavailable.</p>}
    <label className="library-search">
      <Icon name="search" size={19}/>
      <input type="search" aria-label="Search Exercise" placeholder="Search Exercise" maxLength={100} value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }}/>
      {searchTerm && <button type="button" onClick={() => { setSearchTerm(''); setPage(1); }} aria-label="Clear search"><Icon name="close" size={16}/></button>}
    </label>
    <div className="library-filter-heading"><h3>Filters</h3>{(searchTerm || equipment !== 'Any equipment' || bodyPart || target || secondary || sort) && <button type="button" onClick={reset}>Clear filters</button>}</div>
    <div className="library-discovery-controls">
      <label>Body part<select value={bodyPart} onChange={event => { setBodyPart(event.target.value); setPage(1); }}><option value="">All body parts</option>{filters.bodyParts.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
      <label>Equipment type<select value={equipment} onChange={event => { setEquipment(event.target.value); setPage(1); }}>{[...new Set([...equipmentOptions, ...filters.equipments, equipment])].map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
      <label>Target muscle<select value={target} onChange={event => { setTarget(event.target.value); setPage(1); }}><option value="">All target muscles</option>{filters.targetMuscles.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
      <label>Secondary muscle<select value={secondary} onChange={event => { setSecondary(event.target.value); setPage(1); }}><option value="">All secondary muscles</option>{filters.secondaryMuscles.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
      <label>Sort by<select value={sort || ''} onChange={event => { setSort((event.target.value || undefined) as ExerciseDiscoveryQuery['sort']); setPage(1); }}><option value="">Default</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="body-part">Body part</option><option value="equipment">Equipment</option></select></label>
    </div>
    {loading && <p role="status">Loading exercises…</p>}
    {error && <div className="empty-library" role="alert"><p>{error}</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {!loading && catalog && <>
      <div className="library-caption library-results-heading"><p className="result-count" role="status">{catalog.total} {catalog.total === 1 ? 'exercise' : 'exercises'}</p><span>Open a guide</span></div>
      <div className="library-list">
        {catalog.items.map(item => <button type="button" className="library-item" key={item._id} aria-haspopup="dialog" onClick={event => { openerRef.current = event.currentTarget; setMediaError(false); setSelected(item); }}>
          <span className="exercise-thumb"><Icon name="library-dumbbells" size={24}/>{item.gifUrl && <i><Icon name="play" size={8}/></i>}</span>
          <span className="library-copy"><b>{titleCase(item.name)}</b><small>{metadata(item)}</small><span className="library-item-meta"><span className={`tracking-tag ${trackingLabel(item) === 'Caution' ? 'caution' : trackingLabel(item) === 'Manual' ? 'manual' : ''}`}>{trackingLabel(item)}</span>{item.gifUrl && <span className="library-demo-label">Demonstration</span>}<span className="library-demo-label">{canTrack(trackingConfigs[item._id] ?? resolveTrackingConfig(item)) ? "PoseTracker options available" : "PoseTracker configuration pending"}</span></span></span>
          <Icon name="arrow" size={16}/>
        </button>)}
        {!catalog.items.length && <div className="empty-library"><p>No exercises match those filters.</p><button type="button" className="secondary" onClick={reset}>Reset filters</button></div>}
      </div>
      {catalog.pages > 1 && <nav className="library-caption" aria-label="Exercise pages"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page} of {catalog.pages}</span><button type="button" className="secondary" disabled={page >= catalog.pages} onClick={() => setPage(value => value + 1)}>Next page</button></nav>}
      {catalog.coverageNote && <p className="library-preview-note">{catalog.coverageNote}</p>}
      <p className="library-preview-note">Exercise data by <a href="https://ascendapi.com" target="_blank" rel="noreferrer">AscendAPI</a>.</p>
    </>}
    {selected && <dialog ref={dialogRef} className="library-dialog" aria-labelledby="library-exercise-title" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <article className="exercise-sheet library-exercise-sheet">
        <header className="library-sheet-header"><div><h3 id="library-exercise-title">{titleCase(detail?.name || selected.name)}</h3><p>{metadata(detail || selected)}</p></div><button type="button" className="sheet-close" onClick={() => setSelected(null)} aria-label="Close exercise details" autoFocus><Icon name="close" size={18}/></button></header>
        {!detail && !detailError && <p role="status">Loading exercise details…</p>}
        {detailError && <div role="alert" className="empty-library"><p>{detailError}</p><button className="secondary" onClick={() => setDetailRetry(value => value + 1)}>Retry details</button></div>}
        {detail && <>
          <div className="library-demo">
            {detail.gifUrl && !mediaError ? <>
              <img ref={imageRef} src={detail.gifUrl} loading="lazy" alt={`Exercise demonstration - ${titleCase(detail.name)}`} style={{ visibility: playing || !frameReady ? 'visible' : 'hidden' }} onLoad={() => { freezeFrame(); const url = detail.gifUrl; if (url) void exerciseMediaStatus(url, true).then(cached => { if (imageRef.current?.src === url) setMediaCached(cached); }); }} onError={() => { setMediaError(true); setPlaying(false); }}/>
              <canvas ref={canvasRef} aria-hidden="true" style={{ visibility: !playing && frameReady ? 'visible' : 'hidden' }}/>
              <button type="button" className={`library-demo-toggle ${playing ? 'is-playing' : ''}`} aria-label={playing ? 'Pause exercise demonstration' : 'Play exercise demonstration'} onClick={() => { if (playing) freezeFrame(); setPlaying(value => !value); }}><Icon name={playing ? 'pause' : 'play'} size={22}/></button>
            </> : <span className="library-video-unavailable"><Icon name="library-dumbbells" size={40}/><small>{mediaError ? 'Could not load this demonstration.' : 'No demonstration available'}</small></span>}
          </div>
          {mediaError && <button type="button" className="secondary library-media-retry" onClick={() => setDetailRetry(value => value + 1)}>Retry demonstration</button>}
          {detail.gifUrl && !mediaError && <p className="library-preview-note">{mediaCached ? 'Demonstration available offline.' : 'Demonstration requires a connection.'}</p>}
          <div className="library-recommendation">{detail.recommended && <span>Recommended <b>{detail.recommended}</b></span>}<span className="library-manual-label">Manual tracking</span></div>
          <div className="library-preview-note"><p>Exercise-aware movement tracking with PoseTracker.</p><button type="button" className="secondary" onClick={() => { setSelected(null); setPreview(detail); }}>PoseTracker options</button></div>
          {detail.description && <p className="library-description">{detail.description}</p>}
          <section className="library-instructions"><h4>How to do it</h4>{detail.instructions?.length ? <ol>{detail.instructions.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step.replace(/^Step\s*\d+\s*[:.\-]?\s*/i, '')}</p></li>)}</ol> : <p>No instructions are available for this exercise.</p>}</section>
          {!!detail.checks?.length && <section className="library-form-checks"><h4>Form cues</h4><ul>{detail.checks.map((cue, index) => <li key={index}>{cue}</li>)}</ul></section>}
          <p className="library-preview-note">Exercise data by <a href="https://ascendapi.com" target="_blank" rel="noreferrer">AscendAPI</a>.</p>
        </>}
      </article>
    </dialog>}
  </div>;
}
