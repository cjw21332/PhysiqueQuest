import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera } from 'expo-camera';
import { Asset } from 'expo-asset';
import { deleteAsync } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { analyzePoseVideo, type PoseVideoProgress } from 'expo-mediapipe-pose';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import NativeTrackingCamera, { type NativeTrackingOptions } from './NativeTrackingCamera';
import {
  createExerciseCounter,
  isPatternId,
  patternSpec,
  type EngineSnapshot,
  type ExerciseConfigOverride,
  type PatternId,
} from '../shared/exerciseEngine';
import { analyzeVideoLandmarks, withTempVideoCleanup, type VideoLandmarkFrame } from '../shared/videoAnalysisPipeline';

type Props = { token?: string; exercise: string; name: string; pattern: string; support?: string; override?: ExerciseConfigOverride; close: () => void };
type VideoState = { running: boolean; progress: number; status: string; summary?: EngineSnapshot; frames: number };

const supportLabel = (support?: string) => {
  if (support === 'PARTIALLY_SUPPORTED') return 'Partially supported · pattern-level, not validated on real recordings';
  if (support === 'NOT_YET_VALIDATED') return 'Not yet validated · heuristic estimate';
  if (support === 'FULLY_SUPPORTED') return 'Fully supported';
  return 'Tracking support not recorded for this exercise';
};

const bones = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
] as const;

const mapPoint = (landmark: { x: number; y: number } | undefined, width: number, height: number, scale: number, ox: number, oy: number) =>
  landmark ? { x: ox + landmark.x * width * scale, y: oy + landmark.y * height * scale } : null;

export default function PoseTrackerNative({ name, pattern, support, override, close }: Props) {
  const insets = useSafeAreaInsets();
  const alive = useRef(true);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [status, setStatus] = useState('Preparing on-device pose estimation…');
  const [points, setPoints] = useState<readonly { x: number; y: number; visibility?: number }[]>([]);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [video, setVideo] = useState<VideoState | null>(null);
  const counter = useRef<ReturnType<typeof createExerciseCounter> | null>(null);
  const lastUi = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const patternId: PatternId = isPatternId(pattern) ? pattern : 'squat';

  const options = useMemo<NativeTrackingOptions>(() => ({
    mode: 'tracking', requestId: 'posetracker-native', kind: 'squat', side: 'left', active: true, fullLandmarks: true,
  }), []);

  useEffect(() => {
    alive.current = true;
    void Camera.requestCameraPermissionsAsync().then(result => {
      if (alive.current) setPermission(result.granted);
    }).catch(() => { if (alive.current) setPermission(false); });
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') close(); });
    return () => {
      alive.current = false;
      listener.remove();
      abort.current?.abort();
    };
  }, [close]);

  useEffect(() => {
    counter.current = createExerciseCounter(patternId, { override });
    setSnapshot(null);
    setStatus('Waiting for you to enter the frame');
  }, [patternId, override]);

  const onFrame = (detail: Record<string, unknown>) => {
    if (!alive.current) return;
    if (detail.type === 'error') {
      setStatus(typeof detail.message === 'string' ? detail.message : 'Camera tracking unavailable.');
      return;
    }
    if (detail.type !== 'frame') return;
    const frame = detail.frame as {
      joints?: readonly { x: number; y: number; visibility?: number }[];
      aspect?: number; width?: number; height?: number; timestamp?: number;
    } | undefined;
    if (!frame || !counter.current || !Array.isArray(frame.joints) || frame.joints.length < 29) {
      setPoints([]);
      return;
    }
    const ts = typeof frame.timestamp === 'number' ? frame.timestamp : Date.now();
    const aspect = typeof frame.aspect === 'number' && frame.aspect > 0 ? frame.aspect : 1;
    const next = counter.current.update({ landmarks: frame.joints, timestamp: ts, aspect });
    const now = Date.now();
    if (now - lastUi.current < 80 && !next.counted) return;
    lastUi.current = now;
    setSnapshot(next);
    setStatus(next.visible
      ? (next.phase === 'lost' ? 'Body partially out of frame' : next.cue)
      : 'Body not detected. Step back so your whole body is in frame.');
    setPoints(frame.joints);
    if (frame.width && frame.height) {
      setFrameSize(current => current.width === frame.width && current.height === frame.height
        ? current : { width: frame.width!, height: frame.height! });
    }
  };

  const analyzeVideo = async () => {
    if (video?.running) return;
    let localUri: string | null = null;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      localUri = asset.uri;
      const controller = new AbortController();
      abort.current = controller;
      setVideo({ running: true, progress: 0, status: 'Loading on-device model…', frames: 0 });
      await withTempVideoCleanup(
        localUri && localUri.startsWith('file:') ? localUri : undefined,
        async () => {
          const model = await Asset.fromModule(require('./assets/pose_landmarker_lite.task')).downloadAsync();
          const modelPath = model.localUri;
          if (!modelPath) throw new Error('Model unavailable');
          if (!alive.current || controller.signal.aborted) return;
          setVideo(current => current && { ...current, status: 'Reading video on this device…' });
          const stream = (async function* (): AsyncGenerator<VideoLandmarkFrame> {
            for await (const frame of analyzePoseVideo(asset.uri, {
              samplingFps: 12, maxFrames: 10000, modelVariant: 'lite', modelPath,
              signal: controller.signal,
              onProgress: (progress: PoseVideoProgress) => {
                if (!alive.current) return;
                const percent = progress.totalFrames ? Math.round((progress.completedFrames / progress.totalFrames) * 100) : 0;
                setVideo(current => current && { ...current, progress: percent });
              },
            })) {
              yield {
                timestampMs: frame.timestampMs,
                landmarks: frame.detection.landmarks,
                imageWidth: frame.detection.imageSize.width,
                imageHeight: frame.detection.imageSize.height,
              };
            }
          })();
          const result = await analyzeVideoLandmarks(stream, patternId, {
            signal: controller.signal,
            override,
            onProgress: completed => setVideo(current => current && { ...current, frames: completed }),
          });
          if (!alive.current || controller.signal.aborted) return;
          if (!result.frames) throw new Error('No body was detected in this video.');
          setVideo({ running: false, progress: 100, status: 'Video analysis complete on this device.', summary: result.snapshot, frames: result.frames });
        },
        uri => deleteAsync(uri, { idempotent: true }),
      );
    } catch (error) {
      if (!alive.current) return;
      const cancelled = error instanceof Error && error.name === 'AbortError';
      setVideo(current => ({
        running: false, progress: current?.progress ?? 0, frames: current?.frames ?? 0,
        status: cancelled ? 'Video analysis cancelled.' : error instanceof Error ? error.message : 'Video analysis failed.',
      }));
    } finally {
      abort.current = null;
    }
  };

  const cancelVideo = () => {
    abort.current?.abort();
    setVideo(current => current && { ...current, running: false, status: 'Cancelling…' });
  };

  const removeVideo = () => {
    abort.current?.abort();
    setVideo(null);
  };

  const spec = patternSpec(patternId);
  const hold = spec.mode === 'hold';
  const scale = frameSize.width && frameSize.height && viewSize.width && viewSize.height
    ? Math.max(viewSize.width / frameSize.width, viewSize.height / frameSize.height) : 0;
  const w = frameSize.width * scale, h = frameSize.height * scale;
  const ox = (viewSize.width - w) / 2, oy = (viewSize.height - h) / 2;
  const mapped = points.map(p => mapPoint(p, frameSize.width, frameSize.height, scale, ox, oy));
  const visible = points.filter(p => (p.visibility ?? 1) >= 0.4).length;
  const primary = hold ? (snapshot?.holdMs ?? 0) : (snapshot?.reps ?? 0);
  const primaryValue = hold ? `${(primary / 1000).toFixed(1)}s` : String(primary);

  return (
    <View style={[styles.root, { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(12, insets.bottom + 8) }]}>
      <Text style={styles.title} numberOfLines={1}>{name}</Text>
      <Text style={styles.badge}>{supportLabel(support)}</Text>
      <Text style={styles.text} numberOfLines={2}>On-device pose estimation · {status}</Text>

      {permission === false && <Text style={styles.warning}>Camera permission is blocked in phone settings. You can still analyze a video file on this device.</Text>}

      {permission && (
        <View style={styles.camera} onLayout={event => setViewSize(event.nativeEvent.layout)}>
          <NativeTrackingCamera
            options={options}
            facing={facing}
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
            emit={onFrame}
            ready={() => { setCameraReady(true); setStatus('Camera ready. Step back so your whole body is visible.'); }}
          />
          <Svg pointerEvents="none" width={viewSize.width} height={viewSize.height} style={StyleSheet.absoluteFill}>
            {bones.map(([a, b]) => mapped[a] && mapped[b] ? (
              <Line key={`${a}-${b}`} x1={mapped[a]!.x} y1={mapped[a]!.y} x2={mapped[b]!.x} y2={mapped[b]!.y} stroke="#22e9c0" strokeWidth={3} />
            ) : null)}
            {mapped.map((p, index) => p && visible >= 5 ? <Circle key={index} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#22e9c0" strokeWidth={2} /> : null)}
          </Svg>

          <View style={styles.counter} accessible accessibilityRole="summary" accessibilityLiveRegion="polite"
            accessibilityLabel={`${hold ? 'Longest hold' : 'Detected repetitions'}: ${primaryValue}. ${snapshot?.faults[0]?.message ?? snapshot?.cue ?? 'Waiting for tracking'}`}>
            <View style={styles.counterColumn}>
              <Text style={styles.counterLabel}>{hold ? 'LONGEST HOLD' : 'DETECTED REPS'}</Text>
              <Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{snapshot ? primaryValue : '—'}</Text>
            </View>
            <View style={styles.counterDivider} />
            <View style={styles.counterColumn}>
              <Text style={styles.counterLabel}>{hold ? 'HOLDS ≥ MIN' : 'PARTIAL REPS'}</Text>
              <Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{snapshot ? (hold ? snapshot.holds : snapshot.partials) : '—'}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.stats}>
        <Text style={styles.text}>Angle {snapshot?.angle === null || snapshot?.angle === undefined ? '—' : `${Math.round(snapshot.angle)}°`} · Range {snapshot ? `${Math.round(snapshot.rom)}°` : '—'}</Text>
        <Text style={styles.text}>Phase: {snapshot?.phase ?? 'waiting'}{cameraReady ? '' : ' · camera loading'}</Text>
        {snapshot?.faults.map((fault, index) => <Text key={`${fault.rule}-${index}`} style={styles.fault}>{fault.message}</Text>)}
        {!snapshot?.faults.length && <Text style={styles.text}>{snapshot?.cue ?? 'Stand back so your whole body is in frame.'}</Text>}
      </View>

      {!video && (
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => setFacing(value => value === 'front' ? 'back' : 'front')}><Text>Switch camera</Text></Pressable>
          <Pressable style={styles.button} onPress={() => void analyzeVideo()}><Text>Analyze a video</Text></Pressable>
          <Pressable style={[styles.button, styles.stop]} onPress={close}><Text>Stop</Text></Pressable>
        </View>
      )}

      {video && (
        <View style={styles.videoPanel}>
          <Text style={styles.title}>Uploaded video · analyzed locally</Text>
          <Text style={styles.text}>{video.status}</Text>
          {video.running && <><ActivityIndicator color="#22e9c0" /><Text style={styles.text}>{video.progress}% · {video.frames} sampled frames with a body</Text></>}
          {video.summary && (
            <Text style={styles.text}>
              {hold ? `Longest hold ${(video.summary.holdMs / 1000).toFixed(1)}s · holds ${video.summary.holds}` : `Repetitions ${video.summary.reps} · partial ${video.summary.partials}`} · range {Math.round(video.summary.rom)}°
            </Text>
          )}
          <View style={styles.actions}>
            {video.running && <Pressable style={[styles.button, styles.stop]} onPress={cancelVideo}><Text>Cancel analysis</Text></Pressable>}
            {!video.running && <Pressable style={styles.button} onPress={removeVideo}><Text>Close video result</Text></Pressable>}
          </View>
          <Text style={styles.text}>The video file is read on this phone and is not uploaded. Analysis is pattern-level and has not been validated on real recordings of this exercise.</Text>
        </View>
      )}

      <Text style={styles.text}>Reps and holds are movement estimates, not technique grades. This screen cannot assess pain, injury risk or equipment load.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 50, elevation: 50, backgroundColor: '#0b0f15', paddingHorizontal: 14, gap: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: { color: '#ffd84c', fontSize: 11, fontWeight: '700' },
  text: { color: '#dbe7e3', fontSize: 12 },
  warning: { color: '#ffb86b', fontSize: 12 },
  fault: { color: '#ff9f6b', fontSize: 12 },
  camera: { flex: 1, minHeight: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#05080c' },
  counter: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#101820ed', borderWidth: 1, borderColor: '#65dcbc', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minWidth: 200, zIndex: 3 },
  counterColumn: { flex: 1, alignItems: 'center', minWidth: 78 },
  counterDivider: { width: 1, height: 34, backgroundColor: '#719189', marginHorizontal: 8 },
  counterLabel: { color: '#c6e5dc', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  counterValue: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stats: { gap: 2 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { backgroundColor: '#22c55e', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  stop: { backgroundColor: '#b45309' },
  videoPanel: { backgroundColor: '#101820', borderRadius: 12, padding: 10, gap: 6 },
});
