import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { jointIndices, type TrackingKind, type TrackingSide } from '../../shared/repCounter';

type Command = { type: 'init'; baseUrl: string } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number; kind: TrackingKind; side: TrackingSide };
const scope = self as unknown as { onmessage: ((event: MessageEvent<Command>) => void) | null; postMessage: (data: unknown) => void };
let detector: PoseLandmarker | undefined;
scope.onmessage = async event => {
  const command = event.data;
  if (command.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(`${command.baseUrl}/pose/wasm`);
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${command.baseUrl}/pose/pose_landmarker_lite.task`, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      scope.postMessage({ type: 'ready' });
    } catch { scope.postMessage({ type: 'error', message: 'Camera tracking could not load. You can count reps manually.' }); }
    return;
  }
  try {
    if (!detector) throw new Error('Detector unavailable');
    const start = performance.now();
    const result = detector.detectForVideo(command.bitmap, command.timestamp);
    const landmarks = result.landmarks[0] ?? [];
    scope.postMessage({ type: 'frame', frame: {
      joints: landmarks.length ? jointIndices(command.kind, command.side).map(index => landmarks[index]) : [],
      aspect: command.bitmap.width / command.bitmap.height, timestamp: command.timestamp,
    }, durationMs: performance.now() - start });
  } catch { scope.postMessage({ type: 'error', message: 'Camera tracking stopped. Try restarting it or count reps manually.' }); }
  finally { command.bitmap.close(); }
};
