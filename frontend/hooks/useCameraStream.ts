'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'on' | 'denied' | 'unavailable';

/**
 * Opens the device camera into a <video> element.
 *
 * Browsers only expose the camera in a secure context (https or localhost). A phone
 * that loads the app over a plain http LAN address gets no camera; the hook reports
 * that instead of failing silently.
 */
export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [message, setMessage] = useState('');

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus('idle');
    setMessage('');
  }, [release]);

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      setMessage(window.isSecureContext === false
        ? 'The camera needs a secure (https) connection. Open the app over https or through the Expo app.'
        : 'This browser cannot open the camera.');
      return;
    }
    setStatus('starting');
    setMessage('');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (error) {
        // Laptops have no rear camera, so retry with any camera before giving up.
        if (error instanceof DOMException && error.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw error;
        }
      }
      release();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus('on');
    } catch (error) {
      const blocked = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setStatus(blocked ? 'denied' : 'unavailable');
      setMessage(blocked
        ? 'Camera access is blocked. Allow the camera in your browser or phone settings, then tap Enable camera again.'
        : 'No camera was found or it could not start.');
    }
  }, [release]);

  useEffect(() => release, [release]);

  return { videoRef, status, message, start, stop };
}
