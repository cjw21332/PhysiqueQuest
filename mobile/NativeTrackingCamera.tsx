import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View, type ViewStyle } from 'react-native';
import type { PoseCameraViewProps, PoseFrame, PosePerformanceMetrics } from 'expo-mediapipe-pose';
import { jointIndices, type TrackingKind, type TrackingSide } from '../shared/repCounter';

export type NativeTrackingOptions = { requestId: string; kind: TrackingKind; side: TrackingSide; active: boolean };
export const nativePoseAvailable = !isRunningInExpoGo() && !!requireOptionalNativeModule('ExpoMediaPipePose');
// Expo Go keeps the normal camera usable without loading an unavailable native view.
const PoseCamera = nativePoseAvailable ? (require('expo-mediapipe-pose') as typeof import('expo-mediapipe-pose')).PoseCameraView : null;

export function poseScript(detail: Record<string, unknown>) {
  return `(function(){window.dispatchEvent(new CustomEvent('physiquequest-pose',{detail:${JSON.stringify(detail).replace(/</g, '\\u003c')}}));})();true;`;
}

export default function NativeTrackingCamera({ options, facing, style, emit, ready }: { options: NativeTrackingOptions; facing: 'front' | 'back'; style: ViewStyle[]; emit: (detail: Record<string, unknown>) => void; ready: () => void }) {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState(10);
  const optionsRef = useRef(options); optionsRef.current = options;
  const emitRef = useRef(emit); emitRef.current = emit;
  const isActive = options.active && foreground && !failed;
  const send = (detail: Record<string, unknown>) => emitRef.current({ ...detail, requestId: optionsRef.current.requestId, side: optionsRef.current.side });

  useEffect(() => {
    let active = true;
    Asset.fromModule(require('./assets/pose_landmarker_lite.task')).downloadAsync().then(asset => {
      if (!asset.localUri) throw new Error('Model unavailable');
      if (active) setModelPath(asset.localUri);
    }).catch(() => { if (active) { setFailed(true); send({ type: 'error', message: 'The tracking model could not load. Count reps manually.' }); } });
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      send({ type: 'reset' });
    });
    return () => { active = false; listener.remove(); };
  }, []);

  const onLandmark = (frame: PoseFrame) => {
    if (!isActive) return;
    const data = frame.additionalData;
    if (data.thermalState === 'critical') {
      setFailed(true); send({ type: 'error', message: 'Camera tracking paused because the phone is too warm. Count reps manually or let it cool down.' }); return;
    }
    if (data.thermalState === 'serious' || data.inferenceDurationMs > 80) setLimit(5);
    send({ type: 'frame', frame: {
      joints: frame.landmarks.length ? jointIndices(options.kind, options.side).map(index => frame.landmarks[index]) : [],
      aspect: data.width / data.height, timestamp: performance.now(),
    } });
  };
  const metrics = (data: PosePerformanceMetrics) => send({ type: 'metrics', fps: data.inferenceFps });
  if (!PoseCamera || !modelPath || failed) return <View style={style}><Text>{failed ? 'Camera tracking unavailable. Use manual counting.' : 'Loading camera tracking…'}</Text></View>;
  const props: PoseCameraViewProps = {
    cameraFacing: facing, isActive, poseModelVariant: 'lite', poseModelAssetPath: modelPath,
    previewFps: 30, frameLimit: limit, callbackFps: limit, maxPoses: 1,
    segmentationEnabled: false, skeleton: false,
    minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.6,
    onLandmark, onPerformanceMetrics: metrics,
    onCameraConfigured: () => { send({ type: 'reset' }); ready(); },
    onInferenceError: () => { setFailed(true); send({ type: 'error', message: 'Camera tracking failed. Restart the camera or count reps manually.' }); },
  };
  return <PoseCamera {...props} style={style}/>;
}
