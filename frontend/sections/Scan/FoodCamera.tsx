'use client';

import { useEffect, useRef, useState } from 'react';
import { foodPhotoCrop } from '../../../shared/foodCamera';

export default function FoodCamera({ onClose, onCapture, onGallery }: {
  onClose: () => void; onCapture: (file: File) => void; onGallery: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const nativeCapture = useRef<(() => void) | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [preview, setPreview] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onClose, onGallery });
  callbacks.current = { onClose, onGallery };

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    setReady(false);
    setError('');
    const bridge = (window as Window & { ReactNativeWebView?: { postMessage(message: string): void } }).ReactNativeWebView;
    if (bridge) {
      const requestId = `food-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let completed = false;
      const frame = () => {
        const r = viewport.current!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const receive = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (cancelled || completed || detail?.requestId !== requestId) return;
        if (detail.type === 'ready') { setReady(true); return; }
        completed = true;
        if (detail.type === 'error') { setReady(false); setError(detail.message || 'Could not open the camera.'); return; }
        if (detail.type === 'cancel') callbacks.current.onClose();
        else if (detail.type === 'manual') callbacks.current.onGallery();

        else if (detail.type === 'photo' && typeof detail.base64 === 'string' && detail.base64.length <= 24_000_000) {
          try {
            const photo = new Image();
            const capturedFrame = frame();
            photo.onload = () => {
              if (cancelled) return;
              const crop = foodPhotoCrop(photo.naturalWidth, photo.naturalHeight, capturedFrame.width, capturedFrame.height);
              const canvas = document.createElement('canvas');
              canvas.width = Math.min(1600, Math.round(crop.width));
              canvas.height = Math.round(canvas.width * crop.height / crop.width);
              canvas.getContext('2d')!.drawImage(photo,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
              canvas.toBlob(blob => { if (!cancelled && blob) setPreview(blob); }, 'image/jpeg', 0.9);
            };
            photo.onerror = () => { if (!cancelled) setError('Could not read the captured photo. Reopen the camera.'); };
            photo.src = 'data:image/jpeg;base64,' + detail.base64;
          } catch { setError('Could not read the captured photo. Close the camera and try again.'); }
        }
      };
      window.addEventListener('physiquequest-food-camera', receive);
      bridge.postMessage(JSON.stringify({ type: 'food-camera-start', requestId, frame: frame(), facing: facing === 'user' ? 'front' : 'back', mode: 'photo' }));
      nativeCapture.current = () => { setReady(false); bridge.postMessage(JSON.stringify({ type: 'food-camera-capture', requestId })); };
      const resize = new ResizeObserver(() => bridge.postMessage(JSON.stringify({ type: 'food-camera-frame', requestId, frame: frame() })));
      resize.observe(viewport.current!);
      return () => {
        cancelled = true;
        nativeCapture.current = null;
        resize.disconnect();
        window.removeEventListener('physiquequest-food-camera', receive);
        bridge.postMessage(JSON.stringify({ type: 'food-camera-stop', requestId }));
      };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable. Use a secure connection or choose a photo from your device.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then(async result => {
        if (cancelled) { result.getTracks().forEach(track => track.stop()); return; }
        stream = result;
        if (video.current) {
          video.current.srcObject = result;
          await video.current.play();
          if (!cancelled) setReady(true);
        }
      }).catch(() => {
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) setError('Could not open the camera. Check camera permission or choose a photo from your device.');
      });
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()); };
  }, [facing, preview]);

  useEffect(() => {
    if (!preview) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);


  const capture = () => {
    if (nativeCapture.current) { nativeCapture.current(); return; }
    const element = video.current;
    if (!element?.videoWidth || !element.videoHeight) return;
    const canvas = document.createElement('canvas');
    const rect = viewport.current!.getBoundingClientRect();
    const crop = foodPhotoCrop(element.videoWidth,element.videoHeight,rect.width,rect.height);
    canvas.width = Math.round(crop.width); canvas.height = Math.round(crop.height);
    const context = canvas.getContext('2d');
    if (!context) { setError('Could not capture the photo. Please try again.'); return; }
    context.drawImage(element,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob => { if (blob) setPreview(blob); else setError('Could not capture the photo. Please try again.'); }, 'image/jpeg', 0.9);
  };

  return <div className="food-camera-overlay" role="dialog" aria-modal="true" aria-labelledby="food-camera-title">
    <div className="food-camera">
      <header><button type="button" onClick={onClose} aria-label="Close camera">×</button><h2 id="food-camera-title">Food Scanner</h2><button type="button" disabled={!!preview} onClick={() => setFacing(value => value === 'environment' ? 'user' : 'environment')}>Switch</button></header>
      <div ref={viewport} className="food-camera-viewport">
        {previewUrl ? <img src={previewUrl} alt="Captured meal preview" /> : <video ref={video} playsInline muted aria-label="Live camera preview" />}
        {!preview && !error && <><div className="food-camera-scan-frame" aria-hidden="true" /><span className="food-camera-guide">Only food inside the frame is scanned.</span></>}
        {!ready && !error && !preview && <p role="status">Opening camera…</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="food-camera-actions">
        {preview && <p>Confirming sends this food photo to OpenAI for analysis.</p>}
        {preview ? <><button type="button" onClick={() => setPreview(null)}>Retake</button><button type="button" className="primary" onClick={() => onCapture(new File([preview], 'meal.jpg', { type: 'image/jpeg' }))}>Confirm and analyse</button></> : <><button type="button" onClick={onGallery}>Choose photo</button><button type="button" className="food-camera-shutter" disabled={!ready} onClick={capture} aria-label="Capture photo" /><button type="button" onClick={() => setFacing(value => value === 'environment' ? 'user' : 'environment')}>Switch camera</button></>}
      </div>
    </div>
  </div>;
}
