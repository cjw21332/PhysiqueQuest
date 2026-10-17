'use client';

import { useEffect, useState } from 'react';
import { useCameraStream } from '../../hooks/useCameraStream';
import { useRepTracking } from '../../hooks/useRepTracking';
import { trackingExercises, trackingGuidance, type TrackingExercise, type TrackingSide } from '../../../shared/repCounter';

export default function TrackingSession({ exercise, onFinish, onPause }: { exercise: TrackingExercise; onFinish: (seconds: number, reps: number, endedAt: string) => Promise<void>; onPause: (paused: boolean) => Promise<void> }) {
  const kind = trackingExercises[exercise._id];
  const [requestId] = useState(() => globalThis.crypto?.randomUUID?.() ?? `pose-${Date.now()}-${Math.random()}`);
  const [side, setSide] = useState<TrackingSide>('left');
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [review, setReview] = useState(false);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const intent = !paused && visible && !review;
  const camera = useCameraStream({ screen: 'live-session', exerciseName: exercise.name, equipment: exercise.equipment, elapsed: `${seconds}s`, tracking: { requestId, kind, side, active: intent } });
  const tracking = useRepTracking({ kind, side, active: intent && camera.status === 'on', native: camera.nativePreview, requestId, videoRef: camera.videoRef });

  useEffect(() => {
    const listener = () => setVisible(!document.hidden);
    listener(); document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, []);
  useEffect(() => { if (!intent) camera.stop(); }, [intent, camera.stop]);
  useEffect(() => {
    if (!intent) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [intent]);

  const finish = async () => {
    if (!endedAt || busy) return;
    setBusy(true); setError('');
    try { await onFinish(seconds, count, endedAt); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save this workout. Try again.'); }
    finally { setBusy(false); }
  };
  const togglePause = async () => {
    setBusy(true); setError('');
    try { await onPause(!paused); setPaused(value => !value); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the workout.'); }
    finally { setBusy(false); }
  };

  return <section className="live-session">
    <header className="coach-header"><h2>{review ? 'Review your reps' : exercise.name}</h2></header>
    {!review && <>
      <p className="live-notice">{trackingGuidance[kind]}</p>
      <label className="tracking-side">Track side <select value={side} disabled={camera.status === 'on'} onChange={event => setSide(event.target.value as TrackingSide)}><option value="left">Left</option><option value="right">Right</option></select></label>
      <div ref={camera.frameRef} className="live-video">
        <video ref={camera.videoRef} className={`live-camera ${camera.facing === 'front' ? 'front-facing' : ''}`} autoPlay muted playsInline style={camera.nativePreview ? { opacity: 0 } : undefined}/>
        {camera.status !== 'on' && <div className="live-scene" aria-hidden="true"/>}
      </div>
      <div className="tracking-summary" aria-live="polite"><b>{tracking.reps} reps</b><p>{tracking.status}</p><p>{tracking.message}</p></div>
      {tracking.rate > 0 && <small>Processing target: {tracking.rate} frames/sec</small>}
      {camera.message && <p role="alert">{camera.message}</p>}
      <div className="session-controls">
        {camera.status !== 'on' && <button type="button" className="secondary" disabled={paused || !visible || camera.status === 'starting'} onClick={() => void camera.start()}>{camera.status === 'starting' ? 'Starting camera…' : 'Enable camera'}</button>}
        {camera.status === 'on' && !camera.nativePreview && <button type="button" className="secondary" onClick={camera.switchFacing}>Switch camera</button>}
        <button type="button" className="secondary" disabled={busy} onClick={() => void togglePause()}>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="end-button" disabled={busy} onClick={() => {
          // Completion carries this timestamp, avoiding a separate pause write for review.
          setEndedAt(new Date().toISOString()); setCount(tracking.reps); setError(''); setReview(true);
        }}>Finish and review</button>
      </div>
      <p className="live-notice">Prototype rep counting · counts may need correction. Camera frames stay on this device. Tracking pauses when the app is hidden.</p>
    </>}
    {review && <>
      <p>{exercise.name} · {seconds} seconds</p>
      <label className="tracking-side">Reps <input aria-label="Final rep count" type="number" min={0} max={1000} step={1} value={count} onChange={event => setCount(Math.min(1000, Math.max(0, Math.floor(Number(event.target.value) || 0))))}/></label>
      <p className="live-notice">Check the count before saving. You can also enter reps manually.</p>
      <button type="button" className="primary" disabled={busy} onClick={() => void finish()}>{busy ? 'Saving…' : 'Save workout'}</button>
    </>}
    {error && <p role="alert" className="scan-warning">{error}</p>}
  </section>;
}
