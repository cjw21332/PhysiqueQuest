'use client';
import { useEffect, useState } from 'react';
import { useCameraStream } from '../../hooks/useCameraStream';
import { useRepTracking } from '../../hooks/useRepTracking';
import { movementRules, type TrackingSide } from '../../../shared/repCounter';

// A separate local-only session: it does not create or change a saved workout.
export default function SquatFormPreview({ onExit }: { onExit: () => void }) {
  const [requestId] = useState(() => globalThis.crypto?.randomUUID?.() ?? `squat-${Date.now()}`);
  const [side, setSide] = useState<TrackingSide>('left');
  const [stage, setStage] = useState<'setup' | 'active' | 'summary'>('setup');
  const [visible, setVisible] = useState(true);
  const [finalReps, setFinalReps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const camera = useCameraStream({ screen: 'live-session', exerciseName: movementRules.squat.name, equipment: 'Bodyweight', elapsed: `${seconds}s`, tracking: { requestId, kind: 'squat', side, active: stage === 'active' && visible } });
  const tracking = useRepTracking({ kind: 'squat', side, active: stage === 'active' && visible && camera.status === 'on', native: camera.nativePreview, requestId, videoRef: camera.videoRef });
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', changed);
    changed();
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useEffect(() => {
    if (stage !== 'active' || !visible || camera.status !== 'on') return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [stage, visible, camera.status]);
  const finish = () => { setFinalReps(tracking.reps); camera.stop(true); setStage('summary'); };
  const label = camera.status !== 'on' || tracking.observation === 'unknown' ? 'Insufficient visual information' : tracking.observation === 'adjustment' ? 'Movement needs adjustment for the counter' : 'Movement detected';

  return <section className="coach-library squat-preview">
    <header className="coach-header library-header"><button className="coach-back" type="button" onClick={() => { camera.stop(true); onExit(); }} aria-label="Back to exercise library">←</button><h2>Squat movement preview</h2></header>
    <p>Experimental · partially supported. This checks one knee angle, not overall form or injury risk. It is not medical advice.</p>
    {stage !== 'summary' ? <>
      <p>Place the camera side-on. Keep your selected hip, knee and ankle in frame, start standing, then bend and stand at a comfortable pace.</p>
      <label className="tracking-side">Visible side <select value={side} disabled={camera.status === 'on' || camera.status === 'starting'} onChange={event => setSide(event.target.value as TrackingSide)}><option value="left">Left</option><option value="right">Right</option></select></label>
      <div ref={camera.frameRef} className="live-video"><video ref={camera.videoRef} className={`live-camera ${camera.facing === 'front' ? 'front-facing' : ''}`} autoPlay muted playsInline style={camera.nativePreview ? { opacity: 0 } : undefined}/>{camera.status !== 'on' && <div className="live-scene" aria-hidden="true"/>}</div>
      <div aria-live="polite" className="tracking-summary"><b>{tracking.reps} detected {tracking.reps === 1 ? 'rep' : 'reps'}</b><p>{label}</p><p>{camera.status === 'on' ? tracking.message : 'Enable the camera to begin.'}</p><small>{tracking.status}</small></div>
      {camera.message && <p role="alert">{camera.message}</p>}
      <div className="session-controls">
        {camera.status !== 'on' && <button type="button" className="secondary" disabled={!visible || camera.status === 'starting'} onClick={() => { setStage('active'); void camera.start(); }}>{camera.status === 'starting' ? 'Starting camera…' : 'Enable camera'}</button>}
        {camera.status === 'on' && <button type="button" className="secondary" onClick={() => { camera.stop(true); setStage('setup'); }}>Stop camera</button>}
        {stage === 'active' && <button type="button" className="primary" onClick={finish}>Finish preview</button>}
      </div>
      <p>Video is processed on this device. Nothing from this preview is uploaded or saved. Counts and feedback are experimental; check them yourself.</p>
    </> : <><p>Session summary</p><p><b>{finalReps}</b> detected {finalReps === 1 ? 'rep' : 'reps'} · {seconds} seconds with camera active.</p><p>This is not a form score. The preview cannot assess depth in 3D, alignment, pain, or overall technique.</p><button type="button" className="primary" onClick={() => { camera.stop(true); onExit(); }}>Return to library</button></>}
  </section>;
}
