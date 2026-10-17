'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeRecordedVideo, identifyRecordedVideo } from '../../lib/analyzeRecordedVideo';
import { api } from '../../lib/api';
import { operationKey } from '../../lib/operationKey';
import type { SetResult, WorkoutExercise } from '../../../shared/workouts';
import { accountScope, notifyDataChanged } from '../../hooks/useApiResource';
import type { WorkoutSessionRecord } from '../../lib/api';
import { trackingExercises, trackingGuidance, trackingPresets, type TrackingSide } from '../../../shared/repCounter';

export default function RecordedRepCounter({ file, onSaved, onChooseAnother, attachment, autoScan = true }: { file: File; onSaved?: (workout: WorkoutSessionRecord) => void; onChooseAnother: () => void; autoScan?: boolean; attachment?: { exercise: WorkoutExercise; setIndex: number; presetId: string; onReviewed: (result: SetResult) => Promise<void> } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const pending = useRef<Parameters<typeof api.saveRecordedWorkout>[0] | null>(null);
  const autoStarted = useRef(false);
  const [url, setUrl] = useState('');
  const [exerciseId, setExerciseId] = useState(attachment?.presetId ?? (autoScan ? '' : trackingPresets[0]._id));
  const [autoIdentify, setAutoIdentify] = useState(!attachment && autoScan);
  const [identifiedName, setIdentifiedName] = useState('');
  const [identifiedExerciseId, setIdentifiedExerciseId] = useState('');
  const [side, setSide] = useState<TrackingSide>('left');
  const [reps, setReps] = useState(0);
  const [duration, setDuration] = useState(0);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [counted, setCounted] = useState(false);
  const [detectedReps, setDetectedReps] = useState<number | undefined>();
  const [performedAt, setPerformedAt] = useState(() => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const kind = trackingExercises[exerciseId];
  const exercise = trackingPresets.find(item => item._id === exerciseId);
  const validFile = file.size <= 20 * 1024 * 1024 && /\.(mp4|mov)$/i.test(file.name);
  const validDuration = duration > 0 && duration <= 120;
  useEffect(() => {
    const next = URL.createObjectURL(file); setUrl(next);
    return () => { abortRef.current?.abort(); URL.revokeObjectURL(next); };
  }, [file]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) abortRef.current?.abort(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  const count = useCallback(async () => {
    if (!videoRef.current || abortRef.current || !validFile || !validDuration || (!autoIdentify && !kind)) return;
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setError(''); setCounted(false); setProgress(0); setReps(0); setDetectedReps(undefined); setIdentifiedName(''); setIdentifiedExerciseId('');
    if (autoIdentify) setExerciseId('');
    try {
      if (autoIdentify) {
        const result = await identifyRecordedVideo(videoRef.current, controller.signal, setProgress);
        setExerciseId(result.trackingPresetId); setIdentifiedName(result.name); setIdentifiedExerciseId(result.exerciseId); setSide(result.side);
        setReps(result.reps); setDetectedReps(result.reps);
      } else {
        const value = await analyzeRecordedVideo(videoRef.current, kind, side, controller.signal, setProgress);
        setReps(value); setDetectedReps(value);
      }
      setCounted(true);
    }
    catch (err) { setError(controller.signal.aborted ? 'Counting stopped. You can restart or enter reps manually.' : err instanceof Error ? err.message : 'Counting failed. Enter reps manually.'); }
    finally { abortRef.current = null; setBusy(false); }
  }, [autoIdentify, kind, side, validFile, validDuration]);
  useEffect(() => {
    if (autoIdentify && url && validFile && validDuration && !decodeFailed && !autoStarted.current && !document.hidden) {
      autoStarted.current = true;
      void count();
    }
  }, [autoIdentify, url, validFile, validDuration, decodeFailed, count]);
  const save = async () => {
    if (savingRef.current || busy || !validFile || !validDuration || !exerciseId) return;
    savingRef.current = true; setSaving(true); setError('');
    try {
      const savedExerciseId = attachment?.exercise.exerciseId ?? (identifiedExerciseId || exerciseId);
      const result: SetResult = { setId: `${savedExerciseId}:${attachment?.setIndex ?? 0}`, exerciseId: savedExerciseId, setIndex: attachment?.setIndex ?? 0, reps, status: 'completed', source: counted ? 'local-video' : 'manual', clipDurationSeconds: duration, ...(counted ? { detectedReps, side, algorithmVersion: identifiedName ? 'movement-rules-v1/rep-counter-v2' : 'rep-counter-v2', trackingPresetId: exerciseId } : {}) };
      if (attachment) { await attachment.onReviewed(result); return; }
      if (!pending.current) {
        pending.current = { requestKey: operationKey(), exercise: { exerciseId: savedExerciseId, name: identifiedName || exercise?.name || exerciseId, equipment: identifiedName && kind !== 'pushup' ? '' : exercise?.equipment ?? '', sets: 1 }, result, performedAt: new Date(performedAt).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
        localStorage.setItem(`physiquequest-draft:${accountScope()}:recorded`, JSON.stringify(pending.current));
      }
      const saved = await api.saveRecordedWorkout(pending.current);
      localStorage.removeItem(`physiquequest-draft:${accountScope()}:recorded`);
      notifyDataChanged('workouts', 'workout-history', 'workout-summary', 'activity', 'leaderboard');
      onSaved?.(saved);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const locked = busy || saving || !!pending.current;
  return <section className="recorded-counter">
    <video ref={videoRef} src={url || undefined} controls={!busy} playsInline preload="auto" onLoadedMetadata={event => { setDecodeFailed(false); setDuration(event.currentTarget.duration); }} onError={() => { setDecodeFailed(true); setDuration(0); setError('This video cannot be played on this device. Try an MP4 video or enter reps and clip length manually.'); }}/>
    <b className="recorded-file">{file.name}</b>
    {exerciseId && <h3 className="recorded-entry-title">{identifiedName || exercise?.name} · {reps} {reps === 1 ? 'rep' : 'reps'}</h3>}
    <p className="camera-note">Count reps on this device. Your video stays here; only reviewed results are saved.</p>
    {attachment ? <p>Saving to {attachment.exercise.name}, set {attachment.setIndex + 1}. Counting rule: {exercise?.name}.</p> : <><label>When did you perform this set?<input type="datetime-local" value={performedAt} disabled={locked} onChange={event => setPerformedAt(event.target.value)}/></label><p className="camera-note">This logs one recorded set. It does not complete a planned workout or award another training day.</p></>}
    {!validFile && <p role="alert" className="error">Choose an MP4 or MOV video up to 20 MB.</p>}
    {duration > 120 && <p role="alert" className="error">Choose a video up to 2 minutes long.</p>}
    {decodeFailed && <label>Clip length in seconds (manual logging)<input aria-label="Manual clip length" type="number" min={1} max={120} value={duration || ''} disabled={locked} onChange={event => setDuration(Math.max(0, Math.min(120, Number(event.target.value) || 0)))}/></label>}
    {!attachment && <label><input type="checkbox" checked={autoIdentify} disabled={locked} onChange={event => { setAutoIdentify(event.target.checked); autoStarted.current = false; setCounted(false); setReps(0); setIdentifiedName(''); setIdentifiedExerciseId(''); setExerciseId(''); }}/>Identify exercise automatically</label>}
    {!attachment && <p className="camera-note">Automatic suggestions support one squat, biceps curl or floor push-up exercise per clip. Variations and equipment need your confirmation.</p>}
    {identifiedName && <p role="status">Suggested movement: {identifiedName}. Review the exercise and reps before saving.</p>}
    <div className="recorded-options">
      <label>Exercise<select value={exerciseId} disabled={locked || !!attachment} onChange={event => { setExerciseId(event.target.value); setAutoIdentify(false); setIdentifiedName(''); setIdentifiedExerciseId(''); setCounted(false); setDetectedReps(undefined); setReps(0); setError(''); }}>
        {!attachment && <option value="">Choose an exercise if not identified</option>}
        {trackingPresets.map(exercise => <option key={exercise._id} value={exercise._id}>{identifiedName && exercise._id === exerciseId ? `${identifiedName} (suggested)` : exercise.name}</option>)}
      </select></label>
      <label>Side facing camera<select value={side} disabled={locked || autoIdentify} onChange={event => { setSide(event.target.value as TrackingSide); setCounted(false); setDetectedReps(undefined); setReps(0); }}><option value="left">Left</option><option value="right">Right</option></select></label>
    </div>
    <p className="camera-note">{exercise?.guidance ?? trackingGuidance[kind]} Counts are experimental; check the result before saving.</p>
    <button type="button" className="secondary" disabled={locked || decodeFailed || !validFile || !validDuration || (!autoIdentify && !kind)} onClick={() => void count()}>{busy ? `${autoIdentify ? 'Scanning' : 'Counting'}… ${progress}%` : autoIdentify ? 'Scan video again' : counted ? 'Count again' : 'Count reps locally'}</button>
    {busy && <><progress aria-label="Video counting progress" max={100} value={progress}/><button type="button" className="quiet-link" onClick={() => abortRef.current?.abort()}>Cancel counting</button></>}
    <label className="recorded-reps">{counted ? 'Review reps' : 'Manual reps'}<input aria-label="Reviewed reps" type="number" min={0} max={1000} step={1} value={reps} disabled={locked} onChange={event => setReps(Math.min(1000, Math.max(0, Math.floor(Number(event.target.value) || 0))))}/></label>
    {error && <p className="error" role="alert">{error}</p>}
    {pending.current && !saving && <p className="camera-note">Retry saves the same reviewed result.</p>}
    <button type="button" className="primary" disabled={busy || saving || !validFile || !validDuration || !exerciseId || (!attachment && !performedAt)} onClick={() => void save()}>{saving ? 'Saving…' : pending.current ? 'Retry save' : attachment ? 'Save reviewed set' : 'Save reviewed workout'}</button>
    <button type="button" className="quiet-link" disabled={saving} onClick={onChooseAnother}>Choose a different video</button>
  </section>;
}

