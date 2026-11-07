'use client';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { createGenericRepCounter, type GeneratedAngleConfig, type PoseFrame } from '../../shared/genericRepCounter';
import { trackingFrameInterval, trackingPowerNotice, type BatteryReading } from '../lib/trackingPerformance.mjs';

type BatteryMonitor = BatteryReading & { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void };

export function useGenericRepTracking(config: GeneratedAngleConfig, active: boolean, videoRef: RefObject<HTMLVideoElement | null>) {
  const counter = useMemo(() => createGenericRepCounter(config), [config]);
  const [progress, setProgress] = useState(() => counter.getProgress());
  const [status, setStatus] = useState('Camera tracking is stopped.');
  const [powerNotice, setPowerNotice] = useState('');
  useEffect(() => {
    if (!active) return;
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) { setStatus('This browser cannot run local pose tracking.'); return; }
    let stopped = false, failed = false, ready = false, busy = false, sent = 0, lastVideoTime = -1, lastSent = 0, interval = 100, inferenceMs = 0, lastResult = 0;
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
        setProgress(counter.update(event.data.frame as PoseFrame));
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
      if (lastResult && now-lastResult > Math.max(750, interval*2+500)) setProgress(counter.tick(now));
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
  },[active,counter,videoRef]);
  return { ...progress, status, powerNotice };
}
