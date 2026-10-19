'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { InactivityCountdown, EmergencyAlarm } from './InactivityViews';
import { api, type CoachExercise } from '../../lib/api';
import { useCameraStream } from '../../hooks/useCameraStream';
import { startAlarm, stopAlarm } from '../../lib/alarmAudio';
import { COUNTDOWN_SECONDS } from '../../lib/inactivityConstants.mjs';

type NativeEvent =
  | { type: 'countdown-started' }
  | { type: 'cancelled'; reason: 'movement' | 'im-okay' }
  | { type: 'alarm-started'; nativeAudio: boolean }
  | { type: 'alarm'; location: { lat: number; lng: number; accuracyMeters: number; capturedAt: string } | null; nativeAudio?: boolean }
  | { type: 'stopped' }
  | { type: 'motion-status'; available: boolean };

type Phase = 'active' | 'countdown' | 'alarm';

type Props = {
  exercise: Pick<CoachExercise, 'exerciseId' | 'name' | 'equipment'>;
  workoutId: string;
  thresholdSeconds: number;
  contactName: string;
  contactPhone: string;
  onEnd: (seconds: number) => Promise<void>;
  onPause: (paused: boolean) => Promise<void>;
};

/** Posts a command to the Expo host. Does nothing in a plain browser. */
function postToHost(message: Record<string, unknown>) {
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage: (data: string) => void } }).ReactNativeWebView;
  bridge?.postMessage(JSON.stringify(message));
}

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `inactivity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LiveSession({ exercise, workoutId, thresholdSeconds, contactName, contactPhone, onEnd, onPause }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('active');
  const phaseRef = useRef<Phase>('active');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [alert, setAlert] = useState<{ id: string; status: 'pending' | 'delivered' | 'failed' | 'cancelled'; errorCode?: string; locationShared: boolean; resolved: boolean } | null>(null);
  const [recordedAt, setRecordedAt] = useState('');
  const [motionAvailable, setMotionAvailable] = useState<boolean | null>(null);
  const [canViewAdmin, setCanViewAdmin] = useState(false);
  const [adminAccessError, setAdminAccessError] = useState('');
  const [stopError, setStopError] = useState('');
  const [stopPending, setStopPending] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const alarmStopRequested = useRef(false);
  const time = `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  const changePhase = (nextPhase: Phase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };
  const camera = useCameraStream({
    screen: 'live-session',
    exerciseName: exercise.name,
    equipment: exercise.equipment,
    elapsed: time,
  });

  useEffect(() => {
    if (paused || phase !== 'active') return;
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused, phase]);

  // Countdown ticks down locally once the host reports it started; the host decides when it ends.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = window.setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    let active = true;
    api.getAuthMe()
      .then(user => {
        if (!active) return;
        setCanViewAdmin(user.role === 'admin');
        setAdminAccessError('');
      })
      .catch(() => {
        if (!active) return;
        setCanViewAdmin(false);
        setAdminAccessError('Administrator access could not be verified. The alert log is unavailable.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (phase !== 'active') camera.stop();
    else if (camera.shouldAutoStart && camera.status === 'idle') void camera.start();
  }, [camera.start, camera.status, camera.stop, camera.shouldAutoStart, phase]);

  // Native host events arrive through the WebView bridge.
  useEffect(() => {
    const onNative = (event: Event) => {
      const detail = (event as CustomEvent<NativeEvent>).detail;
      if (!detail) return;
      if (detail.type === 'motion-status') setMotionAvailable(detail.available);
      if (detail.type === 'countdown-started' && phaseRef.current === 'active') {
        camera.stop();
        setCountdown(COUNTDOWN_SECONDS);
        changePhase('countdown');
      }
      if (detail.type === 'cancelled') {
        if (phaseRef.current !== 'countdown') return;
        changePhase('active');
        void api.sendInactivityEvent({ idempotencyKey: newKey(), eventType: 'cancelled', workoutSessionId: workoutId }).catch(() => undefined);
      }
      // The host owns the transition: a cancellation tap may arrive after its
      // countdown expires. Always reveal the stop control once sound starts.
      if (detail.type === 'alarm-started' && phaseRef.current !== 'alarm') beginAlarm(detail.nativeAudio);
      if (detail.type === 'alarm') {
        if (phaseRef.current !== 'alarm') beginAlarm(detail.nativeAudio);
        void raiseAlarm(detail.location);
      }
      if (detail.type === 'stopped') stopSound();
    };
    window.addEventListener('physiquequest-inactivity', onNative);
    return () => window.removeEventListener('physiquequest-inactivity', onNative);
    // raiseAlarm and stopSound read refs and stable setters; camera.stop is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.stop, workoutId]);

  // Start the host's inactivity monitor when the session mounts; stop it on unmount.
  useEffect(() => {
    postToHost({ type: 'inactivity-start', thresholdMs: thresholdSeconds * 1000 });
    postToHost({ type: 'inactivity-request-motion-status' });
    return () => {
      postToHost({ type: 'inactivity-stop' });
      stopSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdSeconds]);

  const playSound = () => startAlarm();
  const stopSound = () => stopAlarm();

  function beginAlarm(nativeAudio = false) {
    alarmStopRequested.current = false;
    if (!nativeAudio) playSound();
    changePhase('alarm');
    setRecordedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  }

  async function raiseAlarm(location: Extract<NativeEvent, { type: 'alarm' }>['location']) {
    const key = newKey();
    try {
      const record = await api.sendInactivityEvent({
        idempotencyKey: key,
        eventType: 'inactivity',
        workoutSessionId: workoutId,
        exerciseId: exercise.exerciseId ?? exercise.name,
        ...(location ? { location } : {}),
      });
      setAlert({
        id: record._id ?? record.id ?? '',
        status: record.status,
        errorCode: record.errorCode,
        locationShared: Boolean(location),
        resolved: false,
      });
      if (alarmStopRequested.current) await resolveAlert(record._id ?? record.id ?? '');
    } catch {
      setAlert({ id: '', status: 'failed', errorCode: 'DELIVERY_NOT_CONFIRMED', locationShared: Boolean(location), resolved: false });
      if (alarmStopRequested.current) {
        setStopPending(false);
        setStopError('The alert could not be confirmed by the server. Keep this screen open and contact your administrator.');
      }
    }
  }

  const resolveAlert = async (alertId: string) => {
    if (!alertId) {
      setStopPending(false);
      setStopError('The alert could not be confirmed by the server. Keep this screen open and contact your administrator.');
      return;
    }
    try {
      await api.resolveSafetyAlert(alertId);
      setAlert(current => current ? { ...current, resolved: true } : current);
      setStopError('');
    } catch (err) {
      setStopError(err instanceof Error ? err.message : 'Could not record the stop. Hold again to retry.');
    } finally {
      setStopPending(false);
    }
  };

  const holdComplete = async () => {
    postToHost({ type: 'inactivity-hold-stop' });
    stopSound();
    alarmStopRequested.current = true;
    setStopPending(true);
    setStopError('');
    if (alert?.id) await resolveAlert(alert.id);
  };

  const finishSession = async () => {
    setFinishBusy(true);
    setStopError('');
    try {
      await onEnd(seconds);
    } catch (err) {
      setStopError(err instanceof Error ? err.message : 'Could not save the workout.');
    } finally {
      setFinishBusy(false);
    }
  };

  const imOkay = () => {
    postToHost({ type: 'inactivity-im-okay' });
    changePhase('active');
    void api.sendInactivityEvent({ idempotencyKey: newKey(), eventType: 'cancelled', workoutSessionId: workoutId }).catch(() => undefined);
  };

  const togglePause = async () => {
    setBusy(true); setError('');
    try { await onPause(!paused); setPaused(value => !value); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the workout.'); }
    finally { setBusy(false); }
  };
  const end = async () => {
    setBusy(true); setError('');
    try { await onEnd(seconds); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the workout.'); }
    finally { setBusy(false); }
  };

  if (phase === 'countdown') {
    return <InactivityCountdown remainingSeconds={countdown} thresholdSeconds={thresholdSeconds} exerciseName={exercise.name} contactName={contactName} onImOkay={imOkay} />;
  }
  if (phase === 'alarm') {
    return (
      <EmergencyAlarm
        exerciseName={exercise.name}
        recordedAt={recordedAt}
        contactName={contactName}
        contactPhone={contactPhone}
        status={alert?.status ?? 'pending'}
        errorCode={alert?.errorCode}
        locationShared={alert?.locationShared ?? false}
        resolved={alert?.resolved ?? false}
        canViewAdmin={canViewAdmin}
        adminAccessError={adminAccessError}
        stopError={stopError}
        finishing={finishBusy}
        stopping={stopPending}
        onHoldComplete={() => void holdComplete()}
        onFinishSession={finishSession}
      />
    );
  }

  return (
    <section className="live-session">
      <header className="live-session-head">
        <span className="session-meta">{exercise.name}</span>
        <b className="session-time" aria-label="Elapsed time">{time}</b>
      </header>
      <div ref={camera.frameRef} className="live-video">
        <video ref={camera.videoRef} className={`live-camera ${camera.facing === 'front' ? 'front-facing' : ''}`} autoPlay muted playsInline style={camera.nativePreview ? { opacity: 0 } : undefined} />
        {camera.status !== 'on' && <div className="live-scene" aria-hidden="true" />}
        {!camera.nativePreview && <>
          <span className="form-score"><Icon name="shield" size={14}/> Form analysis unavailable</span>
          <div className="live-time-card"><small>Elapsed</small><b>{time}</b></div>
          <div className="exercise-label"><small>{exercise.equipment}</small><b>{exercise.name}</b></div>
        </>}
        {camera.status === 'on' && !camera.nativePreview && (
          <button type="button" className="camera-facing-toggle" onClick={camera.switchFacing} aria-label={`Switch to ${camera.facing === 'back' ? 'front' : 'back'} camera`}>
            {camera.facing === 'back' ? 'Front camera' : 'Back camera'}
          </button>
        )}
      </div>
      {camera.status !== 'on' && (
        <div className="live-camera-action">
          <button type="button" className="secondary" disabled={camera.status === 'starting'} onClick={() => void camera.start()}>
            {camera.status === 'starting' ? 'Starting camera...' : 'Enable camera'}
          </button>
          {camera.message && <p role="alert">{camera.message}</p>}
        </div>
      )}
      <p className="live-notice" role="note">Keep the app open and the screen on during your workout. Detection pauses when the phone is locked.</p>
      {motionAvailable === false && <p className="scan-warning" role="status">Movement detection needs the phone app with an accelerometer. Countdown is off on this device.</p>}
      <div className="session-progress-label"><span>Elapsed time</span><b>{time}</b></div>
      <div className="session-progress-track"><i style={{width: `${Math.min(seconds / 1800 * 100, 100)}%`}}/></div>
      <div className="session-controls">
        <button type="button" className="pause-button" aria-label={paused ? 'Resume workout' : 'Pause workout'} disabled={busy} onClick={() => void togglePause()}>{paused ? <Icon name="play" size={16}/> : <Icon name="pause" size={16}/>}{paused ? 'Resume' : 'Pause'}</button>
        <button className="end-button" disabled={busy} onClick={() => void end()}>{busy ? 'Saving...' : 'End session'}</button>
      </div>
      {paused && <div className="paused-banner">Session paused</div>}
      {error && <p className="scan-warning" role="alert">{error}</p>}
    </section>
  );
}
