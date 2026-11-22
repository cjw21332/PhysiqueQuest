'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackingKind, TrackingSide } from '../../shared/repCounter';
import { readinessSessionId, type NativeReadinessContext } from '../../shared/cameraReadiness';
import { createCameraRecovery, cameraRecoveryMessage, type CameraRecoveryState, type CameraFailure } from '../../shared/cameraRecovery';

export type CameraStatus = 'idle' | 'starting' | 'on' | 'denied' | 'unavailable';
export type CameraFacing = 'back' | 'front';
export type CameraPreviewContext =
  | { screen: 'camera-check'; readiness?: NativeReadinessContext }
  | { screen: 'live-session'; exerciseName: string; equipment: string; elapsed: string; tracking?: { requestId: string; kind: TrackingKind; side: TrackingSide; active: boolean } };

let preferredFacing: CameraFacing = 'back';
let cameraWasEnabled = false;
let cameraGeneration = 0;

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

type CameraEvent =
  | { type: 'status'; status: CameraStatus; message?: string; reason?: CameraFailure; generation?: number }
  | { type: 'facing'; facing: CameraFacing };

function nativeBridge() {
  return typeof window !== 'undefined' ? window.ReactNativeWebView : undefined;
}

function getCameraFrame(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export function useCameraStream(previewContext: CameraPreviewContext = { screen: 'camera-check' }, autoRecover = false) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeActiveRef = useRef(false);
  const startRequestRef = useRef(0);
  const [generation, setGeneration] = useState(()=>++cameraGeneration);
  const generationRef = useRef(generation);
  const invalidate = useCallback(() => { generationRef.current = ++cameraGeneration; setGeneration(generationRef.current); }, []);
  const trackCleanupRef = useRef<(() => void) | null>(null);
  const previewContextRef = useRef(previewContext);
  previewContextRef.current = previewContext;
  const previewContextKey = JSON.stringify(previewContext);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [message, setMessage] = useState('');
  const [nativePreview, setNativePreview] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>(preferredFacing);
  const [recoveryState,setRecoveryState]=useState<CameraRecoveryState>({phase:'idle',attempt:0});
  const selectedFacing=useRef(facing);
  const mounted=useRef(true);
  const acquireRef=useRef<(facing: CameraFacing, ticket?:number)=>Promise<void>>(async()=>{});
  const recoveryTicket=useRef(0);
  const recovery=useRef<ReturnType<typeof createCameraRecovery>|null>(null);
  const nativeContext = useCallback((): CameraPreviewContext => {
    const context=previewContextRef.current, rect=frameRef.current?.getBoundingClientRect();
    return context.screen==='camera-check' ? {screen:'camera-check',readiness:{mode:'readiness',sessionId:readinessSessionId(generationRef.current),
      geometryGeneration:generationRef.current,previewWidth:rect?.width??0,previewHeight:rect?.height??0,active:true}} : context;
  },[]);

  const release = useCallback(() => {
    trackCleanupRef.current?.(); trackCleanupRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  if(!recovery.current)recovery.current=createCameraRecovery({
    setTimer:setTimeout,clearTimer:clearTimeout,
    eligible:()=>mounted.current && (typeof document==='undefined' || document.visibilityState!=='hidden'),
    release:()=>{startRequestRef.current++;release();if(nativeActiveRef.current){nativeActiveRef.current=false;nativeBridge()?.postMessage(JSON.stringify({type:'camera-stop'}));}if(mounted.current)setNativePreview(false);},
    start:ticket=>{recoveryTicket.current=ticket;void acquireRef.current(selectedFacing.current,ticket);},
    changed:state=>{if(!mounted.current)return;setRecoveryState(state);setStatus(state.phase==='ready'?'on':state.phase==='acquiring'||state.phase==='recovering'?'starting':state.phase==='idle'?'idle':state.reason==='permission_denied'?'denied':'unavailable');},
  });

  const stop = useCallback((resetAutoStart = false) => {
    if(autoRecover)recovery.current?.stop();
    invalidate();
    startRequestRef.current += 1;
    if (nativeActiveRef.current) {
      nativeActiveRef.current = false;
      nativeBridge()?.postMessage(JSON.stringify({ type: 'camera-stop' }));
    }
    release();
    setNativePreview(false);
    setStatus('idle');
    setMessage('');
    if (resetAutoStart) cameraWasEnabled = false;
  }, [release, invalidate, autoRecover]);

  // A pending acquisition belongs to one exercise job. Display-only elapsed
  // updates must not restart the camera, but a replacement job must cancel it.
  const streamContextKey = JSON.stringify(previewContext.screen === 'live-session'
    ? [previewContext.screen, previewContext.exerciseName, previewContext.equipment,
      previewContext.tracking?.requestId, previewContext.tracking?.kind, previewContext.tracking?.side]
    : [previewContext.screen]);
  const previousStreamContext = useRef(streamContextKey);
  useEffect(() => {
    if (previousStreamContext.current === streamContextKey) return;
    previousStreamContext.current = streamContextKey;
    stop(true);
  }, [streamContextKey, stop]);

  const start = useCallback(async (requestedFacing: CameraFacing = facing, ticket?: number) => {
    selectedFacing.current=requestedFacing;
    setFacing(requestedFacing);
    if(autoRecover && ticket===undefined){recovery.current?.start();return;}
    invalidate();
    const requestId = ++startRequestRef.current;
    preferredFacing = requestedFacing;
    cameraWasEnabled = true;
    setStatus('starting');
    setMessage('');
    const bridge = nativeBridge();
    if (bridge) {
      setFacing(requestedFacing);
      nativeActiveRef.current = true;
      setNativePreview(true);
      let frame = { x: 0, y: 0, width: 0, height: 0 };
      for (let attempt = 0; attempt < 30 && requestId === startRequestRef.current; attempt += 1) {
        await nextFrame();
        const element = frameRef.current;
        if (element) frame = getCameraFrame(element);
        if (frame.width > 0 && frame.height > 0) break;
      }
      if (requestId !== startRequestRef.current) return;
      if (frame.width <= 0 || frame.height <= 0) {
        if(autoRecover){recovery.current?.error(ticket!,'no_camera');return;}
        nativeActiveRef.current = false;
        setNativePreview(false);
        setStatus('unavailable');
        cameraWasEnabled = false;
        setMessage('The camera view could not be laid out. Return to Camera Check and try again.');
        return;
      }
      bridge.postMessage(JSON.stringify({ type: 'camera-start', frame, facing: requestedFacing, generation:requestId, previewContext: nativeContext() }));
      return;
    }
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if(autoRecover){recovery.current?.error(ticket!,'no_camera');return;}
      setStatus('unavailable');
      cameraWasEnabled = false;
      setMessage(typeof window !== 'undefined' && window.isSecureContext === false
        ? 'Camera access isn’t available on this page. Open the app or use a secure connection and try again.'
        : 'This browser cannot open the camera.');
      return;
    }
    try {
      release();
      let stream: MediaStream;
      const facingMode = requestedFacing === 'front' ? 'user' : 'environment';
      const context = previewContextRef.current;
      const trackingConstraints = context.screen === 'live-session'
        ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }
        : {};
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, ...trackingConstraints }, audio: false });
      } catch (error) {
        // Laptops have no rear camera, so retry with any camera before giving up.
        if (error instanceof DOMException && error.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw error;
        }
      }
      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const lost = () => {
        if (requestId !== startRequestRef.current) return;
        if(autoRecover){recovery.current?.error(ticket!);return;}
        invalidate(); startRequestRef.current += 1; release(); setStatus('unavailable');
        setMessage('Camera delivery stopped. Enable the camera again or continue without it.');
      };
      const tracks = stream.getVideoTracks();
      let frameWatchdog: ReturnType<typeof setInterval> | undefined;
      let frameCallback: number | undefined;
      let lastDeliveredFrameAt = performance.now();
      let lastObservedVideoTime = videoRef.current?.currentTime ?? 0;
      const video = videoRef.current;
      const supportsVideoFrameCallback = video
        ? typeof (video as unknown as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function'
        : false;
      const observeVideoFrame = () => {
        lastDeliveredFrameAt = performance.now();
        if (video && supportsVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(observeVideoFrame);
      };
      // Mute is commonly transient during exposure changes or camera switching.
      // Give delivery time to recover instead of stopping the stream immediately.
      let muteTimer: ReturnType<typeof setTimeout> | undefined;
      const muted = () => { clearTimeout(muteTimer); muteTimer = setTimeout(() => { if (tracks.some(track => track.muted)) lost(); }, 5000); };
      const unmuted = () => { clearTimeout(muteTimer); };
      tracks.forEach(track => { track.addEventListener('ended', lost); track.addEventListener('mute', muted); track.addEventListener('unmute', unmuted); });
      trackCleanupRef.current = () => {
        clearTimeout(muteTimer);
        if (frameWatchdog) clearInterval(frameWatchdog);
        if (video && frameCallback !== undefined) video.cancelVideoFrameCallback(frameCallback);
        tracks.forEach(track => { track.removeEventListener('ended', lost); track.removeEventListener('mute', muted); track.removeEventListener('unmute', unmuted); });
      };
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (requestId !== startRequestRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      if (context.screen === 'live-session' && video && (supportsVideoFrameCallback || Number.isFinite(video.currentTime))) {
        if (supportsVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(observeVideoFrame);
        frameWatchdog = setInterval(() => {
          if (supportsVideoFrameCallback) {
            if (performance.now() - lastDeliveredFrameAt > 6000) lost();
            return;
          }
          if (video.currentTime !== lastObservedVideoTime) {
            lastObservedVideoTime = video.currentTime;
            lastDeliveredFrameAt = performance.now();
          } else if (performance.now() - lastDeliveredFrameAt > 6000) lost();
        }, 1500);
      }
      setFacing(requestedFacing);
      setStatus('on');
      if(autoRecover)recovery.current?.ready(ticket!);
    } catch (error) {
      if (requestId !== startRequestRef.current) return;
      if(autoRecover){const denied=error instanceof DOMException && ['NotAllowedError','SecurityError'].includes(error.name);recovery.current?.error(ticket!,denied?'permission_denied':error instanceof DOMException && error.name==='NotFoundError'?'no_camera':'interrupted_too_often');return;}
      invalidate(); release();
      cameraWasEnabled = false;
      const blocked = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setStatus(blocked ? 'denied' : 'unavailable');
      setMessage(blocked
        ? 'Camera access is blocked. Allow the camera in your browser or phone settings, then tap Enable camera again.'
        : 'No camera was found or it could not start.');
    }
  }, [facing, release, invalidate, nativeContext, autoRecover]);
  acquireRef.current=start;

  const switchFacing = useCallback(() => {
    const nextFacing: CameraFacing = facing === 'back' ? 'front' : 'back';
    preferredFacing = nextFacing;
    selectedFacing.current=nextFacing;
    setFacing(nextFacing);
    if (status === 'on' || status === 'starting') void start(nextFacing);
  }, [facing, start, status]);

  useEffect(() => {
    const handleCameraEvent = (event: Event) => {
      const detail = (event as CustomEvent<CameraEvent>).detail;
      if (!detail) return;
      if(autoRecover && (detail as {type:string}).type==='interruption'){
        const active=(detail as unknown as {active:unknown}).active;if(typeof active==='boolean')recovery.current?.activity(active);return;
      }
      if (detail.type === 'facing') {
        if(detail.facing!=='front' && detail.facing!=='back')return;
        invalidate();
        preferredFacing = detail.facing;
        setFacing(detail.facing);
        return;
      }
      if (!nativeActiveRef.current) return;
      if(autoRecover && detail.type==='status' && detail.status!=='idle' && detail.generation!==startRequestRef.current)return;
      if (!['idle','starting','on','denied','unavailable'].includes(detail.status)) return;
      if(autoRecover){if(detail.status==='on')recovery.current?.ready(recoveryTicket.current);else if(detail.status==='denied'||detail.status==='unavailable')recovery.current?.error(recoveryTicket.current,detail.status==='denied'?'permission_denied':detail.reason && ['timeout','no_camera','interrupted_too_often','thermal'].includes(detail.reason)?detail.reason:'interrupted_too_often');return;}
      if (detail.status !== 'on' && detail.status !== 'starting') invalidate();
      setStatus(detail.status);
      setMessage(detail.message ?? '');
      if (detail.status === 'unavailable' || detail.status === 'denied') {
        cameraWasEnabled = false;
        nativeActiveRef.current = false;
        setNativePreview(false);
      }
      if (detail.status === 'idle') {
        cameraWasEnabled = false;
        nativeActiveRef.current = false;
        setNativePreview(false);
      }
    };
    const updateFrame = () => {
      const element = frameRef.current;
      if (!nativeActiveRef.current || !element) return;
      nativeBridge()?.postMessage(JSON.stringify({
        type: 'camera-update-frame',
        frame: getCameraFrame(element),
        previewContext: nativeContext(),
      }));
    };
    let lastGeometry = '';
    const geometryChanged = () => {
      const element=frameRef.current;
      if(element) {
        const {width,height}=element.getBoundingClientRect();
        const key=`${width}:${height}`;
        if(lastGeometry && key!==lastGeometry) invalidate();
        lastGeometry=key;
      }
      updateFrame();
    };
    mounted.current=true;
    const lifecycleLost = () => { if(autoRecover)recovery.current?.activity(document.visibilityState!=='hidden');else if(document.visibilityState==='hidden') stop(true); };
    const resizeObserver = frameRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(geometryChanged)
      : null;
    if (frameRef.current) resizeObserver?.observe(frameRef.current);
    window.addEventListener('physiquequest-camera', handleCameraEvent);
    window.addEventListener('resize', geometryChanged);
    videoRef.current?.addEventListener('resize', invalidate);
    document.addEventListener('visibilitychange', lifecycleLost);
    window.addEventListener('scroll', updateFrame, true);
    window.visualViewport?.addEventListener('resize', updateFrame);
    window.visualViewport?.addEventListener('scroll', updateFrame);
    return () => {
      mounted.current=false;if(autoRecover)recovery.current?.stop();
      window.removeEventListener('physiquequest-camera', handleCameraEvent);
      startRequestRef.current += 1;
      generationRef.current += 1;
      window.removeEventListener('resize', geometryChanged);
      videoRef.current?.removeEventListener('resize', invalidate);
      document.removeEventListener('visibilitychange', lifecycleLost);
      window.removeEventListener('scroll', updateFrame, true);
      window.visualViewport?.removeEventListener('resize', updateFrame);
      window.visualViewport?.removeEventListener('scroll', updateFrame);
      resizeObserver?.disconnect();
      if (nativeActiveRef.current) nativeBridge()?.postMessage(JSON.stringify({ type: 'camera-stop' }));
      nativeActiveRef.current = false;
      release();
    };
  }, [release, invalidate, stop, nativeContext, autoRecover]);

  useEffect(() => {
    if (!nativeActiveRef.current) return;
    nativeBridge()?.postMessage(JSON.stringify({
      type: 'camera-update-overlay',
      previewContext: nativeContext(),
    }));
  }, [nativePreview, previewContextKey, generation, nativeContext]);

  return {
    videoRef,
    frameRef,
    status,
    message: autoRecover ? cameraRecoveryMessage(recoveryState) : message,
    recoveryState,
    start,
    stop,
    facing,
    switchFacing,
    nativePreview,
    shouldAutoStart: cameraWasEnabled,
    generation,
    generationRef,
  };
}
