'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'on' | 'denied' | 'unavailable';
export type CameraFacing = 'back' | 'front';
export type CameraPreviewContext =
  | { screen: 'camera-check' }
  | { screen: 'live-session'; exerciseName: string; equipment: string; elapsed: string };

let preferredFacing: CameraFacing = 'back';
let cameraWasEnabled = false;

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

type CameraEvent =
  | { type: 'status'; status: CameraStatus; message?: string }
  | { type: 'readiness-frame'; requestId: string; mediaBase64: string }
  | { type: 'readiness-error'; requestId: string; message: string }
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
  const captureRequestRef = useRef(0);
  const captureWaiterRef = useRef<{
    requestId: string;
    resolve: (mediaBase64: string) => void;
    reject: (error: Error) => void;
    timeout: number;
  } | null>(null);
  const previewContextRef = useRef(previewContext);
  previewContextRef.current = previewContext;
  const previewContextKey = JSON.stringify(previewContext);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [message, setMessage] = useState('');
  const [nativePreview, setNativePreview] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>(preferredFacing);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback((resetAutoStart = false) => {
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
    const waiter = captureWaiterRef.current;
    if (waiter) {
      window.clearTimeout(waiter.timeout);
      waiter.reject(new Error('Camera preview stopped before an image could be captured.'));
      captureWaiterRef.current = null;
    }
  }, [release]);

  const start = useCallback(async (requestedFacing: CameraFacing = facing) => {
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
      bridge.postMessage(JSON.stringify({ type: 'camera-start', frame, facing: requestedFacing, previewContext: previewContextRef.current }));
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
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setFacing(requestedFacing);
      setStatus('on');
    } catch (error) {
      if (requestId !== startRequestRef.current) return;
      cameraWasEnabled = false;
      const blocked = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setStatus(blocked ? 'denied' : 'unavailable');
      setMessage(blocked
        ? 'Camera access is blocked. Allow the camera in your browser or phone settings, then tap Enable camera again.'
        : 'No camera was found or it could not start.');
    }
  }, [facing, release]);

  const switchFacing = useCallback(() => {
    const nextFacing: CameraFacing = facing === 'back' ? 'front' : 'back';
    preferredFacing = nextFacing;
    setFacing(nextFacing);
    if (status === 'on') void start(nextFacing);
  }, [facing, start, status]);

  const captureFrame = useCallback(async () => {
    const bridge = nativeBridge();
    if (bridge) {
      if (!nativeActiveRef.current || status !== 'on') throw new Error('Wait for the camera preview to become ready.');
      if (captureWaiterRef.current) throw new Error('A camera image is already being captured.');
      const requestId = `readiness-${++captureRequestRef.current}`;
      return await new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          if (captureWaiterRef.current?.requestId !== requestId) return;
          captureWaiterRef.current = null;
          reject(new Error('The camera image could not be captured. Check camera access and try again.'));
        }, 10_000);
        captureWaiterRef.current = { requestId, resolve, reject, timeout };
        bridge.postMessage(JSON.stringify({ type: 'camera-capture-readiness', requestId }));
      });
    }
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error('Wait for the camera preview to become ready.');
    }
    const width = Math.min(video.videoWidth, 640);
    const height = Math.round(video.videoHeight * width / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot capture a camera image.');
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.55).split(',')[1] ?? '';
  }, [status]);

  useEffect(() => {
    const handleCameraEvent = (event: Event) => {
      const detail = (event as CustomEvent<CameraEvent>).detail;
      if (!detail) return;
      if (detail.type === 'readiness-frame') {
        const waiter = captureWaiterRef.current;
        if (!waiter || waiter.requestId !== detail.requestId) return;
        window.clearTimeout(waiter.timeout);
        captureWaiterRef.current = null;
        waiter.resolve(detail.mediaBase64);
        return;
      }
      if (detail.type === 'readiness-error') {
        const waiter = captureWaiterRef.current;
        if (!waiter || waiter.requestId !== detail.requestId) return;
        window.clearTimeout(waiter.timeout);
        captureWaiterRef.current = null;
        waiter.reject(new Error(detail.message));
        return;
      }
      if (detail.type === 'facing') {
        preferredFacing = detail.facing;
        setFacing(detail.facing);
        return;
      }
      if (!nativeActiveRef.current) return;
      setStatus(detail.status);
      setMessage(detail.message ?? '');
      if (detail.status === 'unavailable' || detail.status === 'denied') {
        cameraWasEnabled = false;
        nativeActiveRef.current = false;
        setNativePreview(false);
      }
      if (detail.status === 'idle') {
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
        previewContext: previewContextRef.current,
      }));
    };
    const resizeObserver = frameRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateFrame)
      : null;
    if (frameRef.current) resizeObserver?.observe(frameRef.current);
    window.addEventListener('physiquequest-camera', handleCameraEvent);
    window.addEventListener('resize', updateFrame);
    window.addEventListener('scroll', updateFrame, true);
    window.visualViewport?.addEventListener('resize', updateFrame);
    window.visualViewport?.addEventListener('scroll', updateFrame);
    return () => {
      window.removeEventListener('physiquequest-camera', handleCameraEvent);
      window.removeEventListener('resize', updateFrame);
      window.removeEventListener('scroll', updateFrame, true);
      window.visualViewport?.removeEventListener('resize', updateFrame);
      window.visualViewport?.removeEventListener('scroll', updateFrame);
      resizeObserver?.disconnect();
      if (nativeActiveRef.current) nativeBridge()?.postMessage(JSON.stringify({ type: 'camera-stop' }));
      nativeActiveRef.current = false;
      release();
      const waiter = captureWaiterRef.current;
      if (waiter) {
        window.clearTimeout(waiter.timeout);
        waiter.reject(new Error('Camera preview closed before an image could be captured.'));
        captureWaiterRef.current = null;
      }
    };
  }, [release]);

  useEffect(() => {
    if (!nativeActiveRef.current) return;
    nativeBridge()?.postMessage(JSON.stringify({
      type: 'camera-update-overlay',
      previewContext: previewContextRef.current,
    }));
  }, [nativePreview, previewContextKey]);

  return {
    videoRef,
    frameRef,
    status,
    message,
    start,
    stop,
    facing,
    switchFacing,
    captureFrame,
    nativePreview,
    shouldAutoStart: cameraWasEnabled,
  };
}
