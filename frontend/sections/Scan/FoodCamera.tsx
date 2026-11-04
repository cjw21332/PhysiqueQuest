'use client';

import { useEffect, useRef, useState } from 'react';
import { foodPhotoCrop } from '../../../shared/foodCamera';

export default function FoodCamera({ onClose, onCapture, onGallery, onBarcode }: {
  onBarcode?: (code:string,format:string) => void;
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
  const callbacks = useRef({ onClose, onGallery, onBarcode });
  callbacks.current = { onClose, onGallery, onBarcode };

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
        else if (detail.type === 'barcode' && typeof detail.code === 'string' && typeof detail.format === 'string') callbacks.current.onBarcode?.(detail.code, detail.format);
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
      bridge.postMessage(JSON.stringify({ type: 'food-camera-start', requestId, frame: frame(), facing: facing === 'user' ? 'front' : 'back', mode: callbacks.current.onBarcode ? 'barcode' : 'photo' }));
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

  useEffect(() => {
    if (!onBarcode || !ready) return;
    if (nativeCapture.current) return;
    type Reader = { detect(video:HTMLCanvasElement):Promise<{rawValue:string;format:string}[]> };
    const Detector = (window as Window & {BarcodeDetector?:{new(options:{formats:string[]}):Reader;getSupportedFormats():Promise<string[]>}}).BarcodeDetector;
    let stopped = false;
    let timer:ReturnType<typeof setTimeout>;
    async function fallbackReader():Promise<Reader> {
      const {default:quagga}=await import('@ericblade/quagga2');
      const canvas=document.createElement('canvas');
      return { async detect(frame) {
        if (!frame.width) return [];
        canvas.width=Math.min(800,frame.width);
        canvas.height=Math.round(frame.height*canvas.width/frame.width);
        canvas.getContext('2d')!.drawImage(frame,0,0,canvas.width,canvas.height);
        const result=await quagga.decodeSingle({src:canvas.toDataURL('image/jpeg'),numOfWorkers:0,decoder:{readers:['ean_reader','ean_8_reader','upc_reader','upc_e_reader']}});
        const hit=result?.codeResult;
        const names:Record<string,string>={ean_13:'ean_13',ean_8:'ean_8',upc_a:'upc_a',upc_e:'upc_e'};
        return hit?.code && names[hit.format] ? [{rawValue:hit.code,format:names[hit.format]}] : [];
      }};
    }
    async function start() {

      const formats = (await Detector?.getSupportedFormats().catch(()=>[]) ?? []).filter(f=>['ean_13','ean_8','upc_a','upc_e'].includes(f));
      const reader = Detector && formats.length === 4 ? new Detector({formats}) : await fallbackReader();
      if (stopped) return;
      const scan = async () => {
        if (stopped || !video.current) return;
        const source=video.current;
        if (!source.videoWidth || !viewport.current) { timer=setTimeout(()=>void scan().catch(fail),250); return; }
        const rect=viewport.current.getBoundingClientRect();
        const crop=foodPhotoCrop(source.videoWidth,source.videoHeight,rect.width,rect.height);
        const region=document.createElement('canvas');
        region.width=Math.round(crop.width);region.height=Math.round(crop.height);
        region.getContext('2d')!.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,region.width,region.height);
        const [hit] = await reader.detect(region);
        if (stopped) return;
        if (hit?.rawValue) onBarcode!(hit.rawValue,hit.format);
        else timer=setTimeout(()=>void scan().catch(fail),250);
      };
      await scan();
    }
    function fail() { if (!stopped) setError('Automatic detection unavailable. Enter the barcode below.'); }
    void start().catch(fail);
    return ()=>{ stopped=true; clearTimeout(timer); };
  },[onBarcode,ready]);

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
        {!preview && !error && <><div className="food-camera-scan-frame" aria-hidden="true" /><span className="food-camera-guide">{onBarcode ? 'Keep the barcode inside the frame.' : 'Only food inside the frame is scanned.'}</span></>}
        {!ready && !error && !preview && <p role="status">Opening camera…</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="food-camera-actions">
        {onBarcode ? <button type="button" onClick={onGallery}>Enter barcode manually</button> : preview ? <><button type="button" onClick={() => setPreview(null)}>Retake</button><button type="button" className="primary" onClick={() => onCapture(new File([preview], 'meal.jpg', { type: 'image/jpeg' }))}>Confirm and analyse</button></> : <><button type="button" onClick={onGallery}>Choose photo</button><button type="button" className="food-camera-shutter" disabled={!ready} onClick={capture} aria-label="Capture photo" /><button type="button" onClick={() => setFacing(value => value === 'environment' ? 'user' : 'environment')}>Switch camera</button></>}
      </div>
    </div>
  </div>;
}
