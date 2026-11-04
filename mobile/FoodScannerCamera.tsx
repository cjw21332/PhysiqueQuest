import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { barcodeInsideFoodFrame, type FoodPreviewFrame } from '../shared/foodCamera';

export type FoodCameraRequest = { requestId: string; mode: 'photo' | 'barcode'; frame: FoodPreviewFrame; facing: 'back' | 'front'; capture: number };
export type FoodCameraResult = { type: 'photo' | 'barcode' | 'cancel' | 'ready' | 'error'; base64?: string; code?: string; format?: string; message?: string };

/** Native surface only; scanner controls remain in the existing web layout. */
export default function FoodScannerCamera({ request, finish }: { request: FoodCameraRequest; finish: (result: FoodCameraResult) => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const ready = useRef(false), done = useRef(false), capturing = useRef(false);
  const finishRef = useRef(finish); finishRef.current = finish;
  const complete = (result: FoodCameraResult) => {
    if (done.current) return;
    done.current = true;
    finishRef.current(result);
  };
  useEffect(() => {
    done.current = false;
    void requestPermission().then(p => {
      if (!p.granted) complete({ type: 'error', message: 'Allow camera access in your phone settings, then reopen the scanner.' });
    }).catch(() => complete({ type: 'error', message: 'Could not request camera permission. Reopen the scanner to try again.' }));
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') complete({ type: 'cancel' });
    });
    return () => { done.current = true; listener.remove(); };
  }, []);
  useEffect(() => {
    if (!request.capture || !ready.current || capturing.current || done.current) return;
    capturing.current = true;
    void (async () => {
      try {
        const photo = await camera.current?.takePictureAsync({ base64: true, quality: 0.65 });
        if (!photo?.base64 || photo.base64.length > 24_000_000) throw new Error('Invalid photo');
        complete({ type: 'photo', base64: photo.base64 });
      } catch { complete({ type: 'error', message: 'Could not capture the photo. Reopen the camera and try again.' }); }
    })();
  }, [request.capture]);
  const { frame } = request;
  return <View pointerEvents="none" style={[styles.surface, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }]}>
    {permission?.granted && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={request.facing}
      onCameraReady={() => { ready.current = true; if (!done.current) finishRef.current({ type: 'ready' }); }}
      onMountError={() => complete({ type: 'error', message: 'Camera could not start. Close other camera apps and reopen the scanner.' })}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
      onBarcodeScanned={request.mode === 'barcode' ? result => {
        const format = ({ ean13: 'ean_13', ean8: 'ean_8', upc_a: 'upc_a', upc_e: 'upc_e' } as Record<string, string>)[result.type];
        if (format && /^\d{8,13}$/.test(result.data) && barcodeInsideFoodFrame(result.bounds, frame.width, frame.height)) complete({ type: 'barcode', code: result.data, format });
      } : undefined} />}
    <View style={styles.scanFrame} />
    <Text style={styles.guide}>{request.mode === 'barcode' ? 'Keep the barcode inside the frame' : 'Only food inside the frame is scanned'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  surface: { position: 'absolute', zIndex: 10, elevation: 10, overflow: 'hidden', borderRadius: 20, backgroundColor: '#0b0f15' },
  scanFrame: { position: 'absolute', left: '10%', top: '20%', width: '80%', height: '60%', borderWidth: 2, borderColor: '#22c55e', borderRadius: 12 },
  guide: { position: 'absolute', bottom: 16, alignSelf: 'center', color: '#fff', backgroundColor: '#000b', padding: 8, borderRadius: 12, fontSize: 12 },
});
