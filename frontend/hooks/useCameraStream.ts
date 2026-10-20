'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackingKind, TrackingSide } from '../../shared/repCounter';
import { readinessSessionId, type NativeReadinessContext } from '../../shared/cameraReadiness';

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
  | { type: 'status'; status: CameraStatus; message?: string }
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

export function useCameraStream(previewContext: CameraPreviewContext = { screen: 'camera-check' }) {
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

  const stop = useCallback((resetAutoStart = false) => {
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
  }, [release, invalidate]);

  const start = useCallback(async (requestedFacing: CameraFacing = facing) => {
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
        nativeActiveRef.current = false;
        setNativePreview(false);
        setStatus('unavailable');
        cameraWasEnabled = false;
        setMessage('The camera view could not be laid out. Return to Camera Check and try again.');
        return;
      }
      bridge.postMessage(JSON.stringify({ type: 'camera-start', frame, facing: requestedFacing, previewContext: nativeContext() }));
      return;
    }
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      cameraWasEnabled = false;
      setMessage(typeof window !== 'undefined' && window.isSecureContext === false
        ? 'Camera access in a browser requires HTTPS or localhost. Use a secure browser address or open the native app.'
        : 'This browser cannot open the camera.');
      return;
    }
    try {
      release();
      let stream: MediaStream;
      const facingMode = requestedFacing === 'front' ? 'user' : 'environment';
      const context = previewContextRef.current;
      const trackingConstraints = context.screen === 'live-session' && context.tracking
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
        invalidate(); startRequestRef.current += 1; release(); setStatus('unavailable');
        setMessage('Camera delivery stopped. Enable the camera again or continue without it.');
      };
      const tracks = stream.getVideoTracks();
      tracks.forEach(track => { track.addEventListener('ended', lost); track.addEventListener('mute', lost); });
      trackCleanupRef.current = () => tracks.forEach(track => { track.removeEventListener('ended', lost); track.removeEventListener('mute', lost); });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (requestId !== startRequestRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      setFacing(requestedFacing);
      setStatus('on');
    } catch (error) {
      if (requestId !== startRequestRef.current) return;
      invalidate(); release();
      cameraWasEnabled = false;
      const blocked = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setStatus(blocked ? 'denied' : 'unavailable');
      setMessage(blocked
        ? 'Camera access is blocked. Allow the camera in your browser or phone settings, then tap Enable camera again.'
        : 'No camera was found or it could not start.');
    }
  }, [facing, release, invalidate, nativeContext]);

  const switchFacing = useCallback(() => {
    const nextFacing: CameraFacing = facing === 'back' ? 'front' : 'back';
    preferredFacing = nextFacing;
    setFacing(nextFacing);
    if (status === 'on' || status === 'starting') void start(nextFacing);
  }, [facing, start, status]);

  useEffect(() => {
    const handleCameraEvent = (event: Event) => {
      const detail = (event as CustomEvent<CameraEvent>).detail;
      if (!detail) return;
      if (detail.type === 'facing') {
        if(detail.facing!=='front' && detail.facing!=='back')return;
        invalidate();
        preferredFacing = detail.facing;
        setFacing(detail.facing);
        return;
      }
      if (!nativeActiveRef.current) return;
      if (!['idle','starting','on','denied','unavailable'].includes(detail.status)) return;
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
    const lifecycleLost = () => { if(document.visibilityState==='hidden' || !document.hasFocus()) stop(true); };
    const blurred = () => stop(true);
    const resizeObserver = frameRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(geometryChanged)
      : null;
    if (frameRef.current) resizeObserver?.observe(frameRef.current);
    window.addEventListener('physiquequest-camera', handleCameraEvent);
    window.addEventListener('resize', geometryChanged);
    videoRef.current?.addEventListener('resize', invalidate);
    window.addEventListener('blur', blurred);
    document.addEventListener('visibilitychange', lifecycleLost);
    window.addEventListener('scroll', updateFrame, true);
    window.visualViewport?.addEventListener('resize', updateFrame);
    window.visualViewport?.addEventListener('scroll', updateFrame);
    return () => {
      window.removeEventListener('physiquequest-camera', handleCameraEvent);
      startRequestRef.current += 1;
      generationRef.current += 1;
      window.removeEventListener('resize', geometryChanged);
      videoRef.current?.removeEventListener('resize', invalidate);
      window.removeEventListener('blur', blurred);
      document.removeEventListener('visibilitychange', lifecycleLost);
      window.removeEventListener('scroll', updateFrame, true);
      window.visualViewport?.removeEventListener('resize', updateFrame);
      window.visualViewport?.removeEventListener('scroll', updateFrame);
      resizeObserver?.disconnect();
      if (nativeActiveRef.current) nativeBridge()?.postMessage(JSON.stringify({ type: 'camera-stop' }));
      nativeActiveRef.current = false;
      release();
    };
  }, [release, invalidate, stop, nativeContext]);

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
    message,
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
