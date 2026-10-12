'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import type { Exercise } from './exercises';
import { InactivityCountdown, EmergencyAlarm } from './InactivityViews';
import { api } from '../../lib/api';
import { COUNTDOWN_SECONDS } from '../../lib/inactivityConstants.mjs';

type NativeEvent =
  | { type: 'countdown-started' }
  | { type: 'cancelled'; reason: 'movement' | 'im-okay' }
  | { type: 'alarm'; location: { lat: number; lng: number; accuracyMeters: number; capturedAt: string } | null }
  | { type: 'stopped' }
  | { type: 'motion-status'; available: boolean };

type Phase = 'active' | 'countdown' | 'alarm';

type Props = {
  exercise: Exercise;
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
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [alert, setAlert] = useState<{ id: string; status: 'pending' | 'delivered' | 'failed' | 'cancelled'; errorCode?: string; locationShared: boolean; resolved: boolean } | null>(null);
  const [recordedAt, setRecordedAt] = useState('');
  const [motionAvailable, setMotionAvailable] = useState<boolean | null>(null);
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);

  // Countdown ticks down locally once the host reports it started; the host decides when it ends.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = window.setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Native host events arrive through the WebView bridge.
  useEffect(() => {
    const onNative = (event: Event) => {
      const detail = (event as CustomEvent<NativeEvent>).detail;
      if (!detail) return;
      if (detail.type === 'motion-status') setMotionAvailable(detail.available);
      if (detail.type === 'countdown-started') { setCountdown(COUNTDOWN_SECONDS); setPhase('countdown'); }
      if (detail.type === 'cancelled') {
        setPhase('active');
        void api.sendInactivityEvent({ idempotencyKey: newKey(), eventType: 'cancelled', workoutSessionId: workoutId }).catch(() => undefined);
      }
      if (detail.type === 'alarm') void raiseAlarm(detail.location);
      if (detail.type === 'stopped') stopSound();
    };
    window.addEventListener('physiquequest-inactivity', onNative);
    return () => window.removeEventListener('physiquequest-inactivity', onNative);
    // raiseAlarm and stopSound read refs and stable setters, so binding once is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

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

  const time = `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;

  // Creating the audio context inside the Start tap satisfies mobile autoplay rules.
  const primeAudio = () => {
    if (audio.current || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    audio.current = { ctx, osc, gain };
  };
  const playSound = () => {
    const a = audio.current;
    if (!a) return;
    void a.ctx.resume();
    a.gain.gain.value = 0.6;
  };
  function stopSound() {
    const a = audio.current;
    if (!a) return;
    a.gain.gain.value = 0;
  }

  async function raiseAlarm(location: Extract<NativeEvent, { type: 'alarm' }>['location']) {
    playSound();
    setPhase('alarm');
    setRecordedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    const key = newKey();
    try {
      const record = await api.sendInactivityEvent({
        idempotencyKey: key,
        eventType: 'inactivity',
        workoutSessionId: workoutId,
        exerciseId: exercise.name,
        ...(location ? { location } : {}),
      });
      setAlert({
        id: String(record._id ?? record.id),
        status: record.status,
        errorCode: record.errorCode,
        locationShared: Boolean(location),
        resolved: false,
      });
    } catch {
      setAlert({ id: '', status: 'failed', errorCode: 'DELIVERY_NOT_CONFIRMED', locationShared: Boolean(location), resolved: false });
    }
  }

  const holdComplete = async () => {
    postToHost({ type: 'inactivity-hold-stop' });
    stopSound();
    if (alert?.id) {
      try {
        await api.resolveSafetyAlert(alert.id);
        setAlert({ ...alert, resolved: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record the stop.');
      }
    }
    setPhase('active');
  };

  const imOkay = () => {
    postToHost({ type: 'inactivity-im-okay' });
    setPhase('active');
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
        onHoldComplete={() => void holdComplete()}
      />
    );
  }

  return (
    <section className="live-session">
      <header className="live-session-head"><span className="session-meta">Manual workout · form tracking unavailable</span><b className="session-time">{time}</b></header>
      <div className="live-video">
        <div className="live-scene"><span className="live-dumbbell">◆</span><div className="live-athlete"><i/><span/><b/><b/></div></div>
        <span className="form-score"><Icon name="shield" size={14}/> Form analysis unavailable</span>
        <div className="exercise-label"><small>{exercise.equipment}</small><b>{exercise.name}</b></div>
      </div>
      <p className="inactivity-notice-line" role="note">Keep the app open and the screen on during your workout. Detection pauses when the phone is locked.</p>
      {motionAvailable === false && <p className="scan-warning" role="status">Movement detection needs the phone app with an accelerometer. Countdown is off on this device.</p>}
      <div className="session-progress-label"><span>Elapsed time</span><b>{time}</b></div>
      <div className="session-progress-track"><i style={{width: `${Math.min(seconds / 1800 * 100, 100)}%`}}/></div>
      <div className="session-controls">
        <button className="pause-button" disabled={busy} onClick={() => void togglePause()}>{paused ? <Icon name="play" size={16}/> : <span className="pause-glyph" aria-hidden="true">II</span>}{paused ? 'Resume' : 'Pause'}</button>
        <button className="end-button" disabled={busy} onClick={() => void end()}>{busy ? 'Saving...' : 'End session'}</button>
      </div>
      {paused && <div className="paused-banner">Session paused</div>}
      {error && <p className="scan-warning" role="alert">{error}</p>}
      <button type="button" className="sr-only" onClick={primeAudio} aria-hidden="true" tabIndex={-1}>prime</button>
    </section>
  );
}
