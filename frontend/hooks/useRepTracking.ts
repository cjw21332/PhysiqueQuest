'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { createRepCounter, type TrackingFrame, type TrackingKind, type TrackingSide } from '../../shared/repCounter';

export function useRepTracking(options: { kind: TrackingKind; side: TrackingSide; active: boolean; native: boolean; requestId: string; videoRef: RefObject<HTMLVideoElement | null> }) {
  const { kind, side, active, native, requestId, videoRef } = options;
  // Side changes preserve the total but discard the unfinished movement.
  const counter = useMemo(() => createRepCounter(kind), [kind, requestId]);
  const [snapshot, setSnapshot] = useState(counter.snapshot());
  const [status, setStatus] = useState('Enable camera to start tracking.');
  const [rate, setRate] = useState(0);

  useEffect(() => {
    setSnapshot(counter.resetMotion());
    if (!active) { setStatus('Tracking paused.'); setRate(0); return; }
    let stopped = false;
    let lastResult = performance.now();
    const receive = (frame: TrackingFrame) => {
      if (stopped) return;
      lastResult = performance.now();
      const next = counter.update(frame);
      setSnapshot(previous => previous.reps === next.reps && previous.phase === next.phase ? previous : next);
      setStatus('Camera tracking · prototype');
    };
    const staleTimer = window.setInterval(() => {
      if (performance.now() - lastResult > 700) {
        setSnapshot(counter.resetMotion());
      }
    }, 750);
    if (native) {
      const listener = (event: Event) => {
        const data = (event as CustomEvent).detail;
        if (data?.requestId !== requestId || data?.side !== side) return;
        if (data.type === 'frame' && Array.isArray(data.frame?.joints)) receive(data.frame);
        if (data.type === 'error') setStatus(data.message || 'Camera tracking unavailable. Count reps manually.');
        if (data.type === 'metrics') setRate(Math.round(data.fps));
        if (data.type === 'reset') setSnapshot(counter.resetMotion());
      };
      window.addEventListener('physiquequest-pose', listener);
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'pose-status', requestId, side }));
      return () => { stopped = true; clearInterval(staleTimer); window.removeEventListener('physiquequest-pose', listener); counter.resetMotion(); };
    }

    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) {
      setStatus('This browser cannot run camera tracking. Count reps manually.');
      clearInterval(staleTimer);
      return;
    }
    setStatus('Loading camera tracking…');
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/pose.worker.ts', import.meta.url)); }
    catch { setStatus('Camera tracking could not start. Count reps manually.'); clearInterval(staleTimer); return; }
    let ready = false, busy = false, lastSent = 0, lastVideoTime = -1, sentAt = 0, interval = 100;
    const fail = (message: string) => { setStatus(message); ready = false; busy = false; clearInterval(staleTimer); worker.terminate(); };
    worker.onmessage = event => {
      if (stopped) return;
      if (event.data.type === 'ready') { ready = true; setStatus('Position yourself to begin.'); }
      if (event.data.type === 'frame') {
        busy = false;
        receive(event.data.frame);
        interval = Math.max(100, Math.min(500, event.data.durationMs * 2));
        setRate(Math.round(1000 / interval));
      }
      if (event.data.type === 'error') fail(event.data.message);
    };
    worker.onerror = () => fail('Camera tracking failed. Count reps manually or restart the camera.');
    worker.postMessage({ type: 'init', baseUrl: window.location.origin });
    const initTimeout = window.setTimeout(() => { if (!ready && !stopped) fail('Camera tracking took too long to load. Restart the camera or count reps manually.'); }, 30_000);
    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      const now = performance.now();
      if (busy && now - sentAt > 5000) { fail('Camera tracking stopped responding. Restart the camera or count reps manually.'); return; }
      if (stopped || !ready || busy || !video || video.readyState < 2 || now - lastSent < interval || video.currentTime === lastVideoTime) return;
      busy = true; lastSent = now; sentAt = now; lastVideoTime = video.currentTime;
      try {
        const width = Math.min(480, video.videoWidth);
        const bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: Math.max(1, Math.round(video.videoHeight * width / video.videoWidth)) });
        if (stopped || !ready) { bitmap.close(); return; }
        worker.postMessage({ type: 'frame', bitmap, timestamp: now, kind, side }, [bitmap]);
      } catch { if (!stopped) fail('The camera frame could not be analyzed. Count reps manually.'); }
    }, 50);
    return () => { stopped = true; clearInterval(timer); clearInterval(staleTimer); clearTimeout(initTimeout); worker.terminate(); counter.resetMotion(); };
  }, [active, native, kind, side, requestId, videoRef, counter]);

  return { ...snapshot, status, rate };
}
