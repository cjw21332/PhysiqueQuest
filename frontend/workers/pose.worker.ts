import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { jointIndices, type TrackingKind, type TrackingSide } from '../../shared/repCounter';

type Command = { type: 'init'; baseUrl: string } | { type: 'dispose' } |
  { type: 'frame'; bitmap: ImageBitmap; timestamp: number; kind: TrackingKind; side: TrackingSide } |
  { type: 'readiness-frame'; bitmap: ImageBitmap; timestamp: number; sessionId: string; frameId: number };
const scope = self as unknown as { onmessage: ((event: MessageEvent<Command>) => void) | null; postMessage: (data: unknown) => void };
let detector: PoseLandmarker | undefined;
let generation = 0;
scope.onmessage = async event => {
  const command = event.data;
  if (command.type === 'dispose') { generation++; detector?.close(); detector=undefined; return; }
  if (command.type === 'init') {
    const current=++generation;
    detector?.close(); detector=undefined;
    try {
      const files = await FilesetResolver.forVisionTasks(`${command.baseUrl}/pose/wasm`);
      const created = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${command.baseUrl}/pose/pose_landmarker_lite.task`, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      if(current!==generation) { created.close(); return; }
      detector=created;
      scope.postMessage({ type: 'ready' });
    } catch { scope.postMessage({ type: 'error', message: 'Camera tracking could not load. You can count reps manually.' }); }
    return;
  }
  try {
    if (!detector) throw new Error('Detector unavailable');
    const start = performance.now();
    const result = detector.detectForVideo(command.bitmap, command.timestamp);
    const landmarks = result.landmarks[0] ?? [];
    if(command.type === 'readiness-frame') {
      let luminance: number | undefined;
      try {
        const canvas=new OffscreenCanvas(32,32), context=canvas.getContext('2d', { willReadFrequently: true });
        if(context) {
          context.drawImage(command.bitmap,0,0,32,32);
          const pixels=context.getImageData(0,0,32,32).data;
          let total=0;
          for(let i=0;i<pixels.length;i+=4) total+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
          luminance=total/(32*32*255);
        }
      } catch { /* Pixel sampling failure affects lighting evidence only. */ }
      scope.postMessage({ type: 'readiness-result', observation: {
        sessionId: command.sessionId, frameId: command.frameId,
        sourceWidth: command.bitmap.width, sourceHeight: command.bitmap.height,
        poseCount: result.landmarks.length, landmarks: landmarks.map(({x,y,visibility})=>({x,y,visibility})), luminance,
      }, durationMs: performance.now()-start });
      return;
    }
    scope.postMessage({ type: 'frame', frame: {
      joints: landmarks.length ? jointIndices(command.kind, command.side).map(index => landmarks[index]) : [],
      aspect: command.bitmap.width / command.bitmap.height, timestamp: command.timestamp,
    }, durationMs: performance.now() - start });
  } catch { scope.postMessage({ type: 'error', message: 'Camera tracking stopped. Try restarting it or count reps manually.' }); }
  finally { command.bitmap.close(); }
};
