'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createLandmarkFilter } from '../../shared/landmarkFilter';
import { createGenericRepCounter, type GeneratedAngleConfig, type PoseFrame } from '../../shared/genericRepCounter';
import { trackingFrameInterval, trackingPowerNotice, type BatteryReading } from '../lib/trackingPerformance.mjs';
import { createMovementTelemetry, type MovementTelemetry } from '../../shared/movementTelemetry';
import { createExerciseCounter, resolvePatternSpec, type PatternId, type ExerciseConfigOverride } from '../../shared/exerciseEngine';

type BatteryMonitor = BatteryReading & { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void };

export function useGenericRepTracking(config: GeneratedAngleConfig, active: boolean, videoRef: RefObject<HTMLVideoElement | null>, pattern?: PatternId, override?: ExerciseConfigOverride, exerciseName?: string, visualOptions = { skeleton: true, guides: true }, cameraGeneration = 0) {
  const visualRef = useRef(visualOptions); visualRef.current = visualOptions;
  const geometryRef = useRef(cameraGeneration); geometryRef.current = cameraGeneration;
  const movement = useMemo(() => { const spec = pattern ? resolvePatternSpec(pattern, override) : null; return createMovementTelemetry(spec?.startThreshold, spec?.peakThreshold, spec ? spec.mode === 'bilateral' : config.sideMode === 'bilateral'); }, [pattern, override, config.sideMode]);
  const [motion, setMotion] = useState<MovementTelemetry>(() => movement.snapshot());
  const resetMotion = () => { movement.reset(); setMotion(movement.snapshot()); };
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const counter = useMemo(() => {
    const generic = createGenericRepCounter(config);
    if (!pattern) return generic;
    const engine = createExerciseCounter(pattern, { override, exerciseName });
    const getProgress = () => {
      const snapshot = engine.snapshot();
      return { ...generic.getProgress(), measurementVisible: snapshot.visible, repCount: snapshot.reps, partialCount: snapshot.partials, currentProgress: snapshot.progress, currentAngle: snapshot.angle, cue: snapshot.faults[0]?.message ?? snapshot.cue, holdDurationMs: snapshot.holdMs };
    };
    return { getProgress, update: (frame: PoseFrame) => { engine.update(frame); return getProgress(); }, tick: (timestamp: number) => { engine.update({ landmarks: [], aspect: 1, timestamp }); return getProgress(); }, suspend: () => engine.suspend() };
  }, [config, pattern, override, exerciseName]);
  const [progress, setProgress] = useState(() => counter.getProgress());
  const [status, setStatus] = useState('Camera tracking is stopped.');
  const [powerNotice, setPowerNotice] = useState('');
  useEffect(() => {
    movement.reset(); setMotion(movement.snapshot());
    if (!active) return;
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) { setStatus('This browser cannot run local pose tracking.'); return; }
    let stopped = false, failed = false, ready = false, busy = false, sent = 0, lastVideoTime = -1, lastSent = 0, interval = 100, inferenceMs = 0, lastResult = 0;
    const filter = createLandmarkFilter(true);
    let visualGeneration = geometryRef.current, lastMotionUi = 0;
    let battery: BatteryMonitor | null = null;
    const updatePower = () => { if (!stopped) { interval=trackingFrameInterval(inferenceMs,battery); setPowerNotice(trackingPowerNotice(battery)); } };
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/pose.worker.ts', import.meta.url)); }
    catch { setStatus('Could not start the pose worker.'); return; }
    const getBattery = (navigator as Navigator & {getBattery?: () => Promise<BatteryMonitor>}).getBattery;
    if (getBattery) {
      try { void getBattery.call(navigator).then(result=>{if(stopped)return;battery=result;battery.addEventListener('levelchange',updatePower);battery.addEventListener('chargingchange',updatePower);updatePower();}).catch(()=>updatePower()); }
      catch { updatePower(); }
    } else updatePower();
    const fail = (message: string) => { if (stopped || failed) return; failed = true; setStatus(message); ready = false; worker.terminate(); };
    worker.onmessage = event => {
      if (stopped || failed) return;
      if (event.data.type === 'ready') { ready = true; setStatus('Position yourself in view.'); }
      if (event.data.type === 'error') fail('Camera tracking stopped. Try restarting it or count reps manually.');
      if (event.data.type === 'generic-result') {
        busy = false;
        lastResult = performance.now();
        if (event.data.subjectChanged) counter.suspend();
        if (event.data.subjectChanged) filter.reset();
        const pose = event.data.frame as PoseFrame;
        if (event.data.subjectChanged || visualGeneration !== geometryRef.current) { movement.reset(); filter.reset(); visualGeneration = geometryRef.current; }
        const next = counter.update(pose);
        const points = filter.update(pose.landmarks, pose.timestamp);
        const measured = 'measurementVisible' in next ? Boolean(next.measurementVisible) : next.currentAngle !== null && next.state !== 'VISIBILITY_LOST';
        const observed = movement.update({ ...pose, landmarks: points, progress: next.currentProgress, visible: measured, reps: next.repCount, partials: next.partialCount });
        if (performance.now() - lastMotionUi >= 200) { setMotion(observed); lastMotionUi = performance.now(); }
        const canvas = overlayRef.current, video = videoRef.current;
        const context = canvas?.getContext('2d');
        if (canvas && context && video) {
          if (canvas.width !== video.clientWidth) canvas.width = video.clientWidth;
          if (canvas.height !== video.clientHeight) canvas.height = video.clientHeight;
          context.clearRect(0, 0, canvas.width, canvas.height);
          const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
          const ox = (canvas.width - video.videoWidth * scale) / 2, oy = (canvas.height - video.videoHeight * scale) / 2;
          // Guides observe the same selected person as the counter.
          context.strokeStyle = '#7ef0b2'; context.lineWidth = 3; context.beginPath();
          for (const [a, b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]) {
            if (!visualRef.current.skeleton) break;
            const first = points[a], second = points[b];
            if (!first || !second || Math.min(first.visibility ?? 1, second.visibility ?? 1) < .5) continue;
            context.moveTo(ox + first.x * video.videoWidth * scale, oy + first.y * video.videoHeight * scale);
            context.lineTo(ox + second.x * video.videoWidth * scale, oy + second.y * video.videoHeight * scale);
          }
          context.stroke();
          if (visualRef.current.guides && observed.point) {
            const project = (p: { x: number; y: number }) => ({ x: ox + p.x * video.videoWidth * scale, y: oy + p.y * video.videoHeight * scale });
            if (observed.reference) {
              const reference = project(observed.reference);
              context.setLineDash([5, 7]); context.strokeStyle = '#ffffff80'; context.lineWidth = 1;
              context.beginPath(); context.moveTo(reference.x, 0); context.lineTo(reference.x, canvas.height); context.stroke(); context.setLineDash([]);
            }
            context.strokeStyle = '#ffd580'; context.lineWidth = 2; context.beginPath();
            observed.path.forEach((point, index) => { const p = project(point); if (index) context.lineTo(p.x, p.y); else context.moveTo(p.x, p.y); }); context.stroke();
            const point = project(observed.point); context.fillStyle = '#fff'; context.beginPath(); context.arc(point.x, point.y, 4, 0, Math.PI * 2); context.fill();
          }
        }
        setProgress(next);
        inferenceMs = event.data.durationMs;
        interval = trackingFrameInterval(inferenceMs, battery);
        setStatus('Experimental tracking active.');
      }
    };
    worker.onerror = () => fail('Pose tracking failed. Stop and retry.');
    worker.postMessage({type:'init',baseUrl:window.location.origin});
    setStatus('Loading local pose model…');
    const timeout = window.setTimeout(() => { if (!ready) fail('Pose model initialization timed out.'); }, 30000);
    const timer = window.setInterval(async () => {
      const now = performance.now();
      // Give slow/battery-conserving inference time to finish before declaring a stall.
      if (lastResult && now-lastResult > Math.max(750, interval*2+500)) {
        setProgress(counter.tick(now));
        movement.reset(); setMotion(movement.snapshot());
        const canvas = overlayRef.current;
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (busy && now - sent > 5000) { fail('Pose tracking stopped responding.'); return; }
      const video = videoRef.current;
      if (stopped || failed || !ready || busy || !video || video.readyState < 2 || !video.videoWidth || now-lastSent < interval || video.currentTime === lastVideoTime) return;
      busy = true; sent = now; lastSent = now; lastVideoTime = video.currentTime;
      try {
        const width = Math.min(480,video.videoWidth);
        const bitmap = await createImageBitmap(video,{resizeWidth:width,resizeHeight:Math.max(1,Math.round(video.videoHeight*width/video.videoWidth))});
        if(stopped || failed || !ready) { bitmap.close(); return; }
        worker.postMessage({type:'generic-frame',bitmap,timestamp:now},[bitmap]);
      } catch { fail('Could not process the camera frame.'); }
    },50);
    return () => { stopped=true; battery?.removeEventListener('levelchange',updatePower); battery?.removeEventListener('chargingchange',updatePower); window.clearInterval(timer); window.clearTimeout(timeout); worker.terminate(); };
  },[active,counter,videoRef,movement]);
  return { ...progress, status, powerNotice, overlayRef, motion, resetMotion };
}
