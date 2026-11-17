import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import type { FoodPreviewFrame } from '../shared/foodCamera';

export type FoodCameraRequest = { requestId: string; mode: 'photo'; frame: FoodPreviewFrame; facing: 'back' | 'front'; capture: number };
export type FoodCameraResult = { type: 'photo' | 'cancel' | 'ready' | 'error'; base64?: string; message?: string };

/** Native surface only; scanner controls remain in the existing web layout. */
export default function FoodScannerCamera({ request, finish }: { request: FoodCameraRequest; finish: (result: FoodCameraResult) => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const ready = useRef(false), done = useRef(false), capturing = useRef(false), requestingPermission = useRef(false);
  const finishRef = useRef(finish); finishRef.current = finish;
  const complete = (result: FoodCameraResult) => {
    if (done.current) return;
    done.current = true;
    finishRef.current(result);
  };
  useEffect(() => {
    done.current = false;
    requestingPermission.current = true;
    void requestPermission().then(p => {
      if (!p.granted) complete({ type: 'error', message: 'Allow camera access in your phone settings, then reopen the scanner.' });
    }).catch(() => complete({ type: 'error', message: 'Could not request camera permission. Reopen the scanner to try again.' })).finally(() => {
      requestingPermission.current = false;
      if (AppState.currentState === 'background') complete({ type: 'cancel' });
    });
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background' && !requestingPermission.current) complete({ type: 'cancel' });
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
      onMountError={() => complete({ type: 'error', message: 'Camera could not start. Close other camera apps and reopen the scanner.' })} />}
    <View style={styles.scanFrame} />
    <Text style={styles.guide}>Only food inside the frame is scanned</Text>
  </View>;
}
const styles = StyleSheet.create({
  surface: { position: 'absolute', zIndex: 10, elevation: 10, overflow: 'hidden', borderRadius: 20, backgroundColor: '#0b0f15' },
  scanFrame: { position: 'absolute', left: '10%', top: '20%', width: '80%', height: '60%', borderWidth: 2, borderColor: '#22c55e', borderRadius: 12 },
  guide: { position: 'absolute', bottom: 16, alignSelf: 'center', color: '#fff', backgroundColor: '#000b', padding: 8, borderRadius: 12, fontSize: 12 },
});
