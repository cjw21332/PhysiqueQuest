import { DRAW_VISIBILITY, MIN_DRAW_LANDMARKS, TRACKING_UI_UPDATE_MS } from '../shared/poseConfig';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Camera } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import NativeTrackingCamera, { type NativeTrackingOptions } from './NativeTrackingCamera';
import { createPoseStartGate, frameStatus } from './poseStartGate';
import { createCameraRecovery, cameraRecoveryMessage, type CameraRecoveryState } from '../shared/cameraRecovery';
import { createPoseSessionClock, POSE_ISSUES, type NativePoseSummary, type PoseIssueId } from '../shared/poseSessionSummary';
import { createLandmarkFilter } from '../shared/landmarkFilter';
import { POSE_HOLD_MS } from './poseOverlay';
import { createStablePoseSegments } from './poseSegments';
import { createPoseCueController, type PoseCue } from './poseCue';
import { createPoseSafety, type SafetyPhase } from './poseSafety';
import { startNativeAlarm, stopNativeAlarm } from './inactivity/nativeAlarm';
import { createMovementDetector } from './inactivity/movement.mjs';
import PoseAlarmScreen from './PoseAlarmScreen';
import {
  createExerciseCounter,
  isPatternId,
  patternSpec,
  targetFps,
  type EngineSnapshot,
  type ExerciseConfigOverride,
  type PatternId,
} from '../shared/exerciseEngine';

type Props = { token?: string; exercise: string; name: string; pattern: string; support?: string; contactName?: string; override?: ExerciseConfigOverride; close: (summary?: NativePoseSummary) => void; onSafetyAlarm: () => void; onSafetyStop: () => void; deliveryStatus: 'idle' | 'pending' | 'delivered' | 'failed' };

const supportLabel = (support?: string) => {
  if (support === 'FULLY_SUPPORTED') return 'Camera tracking available';
  return 'Estimated tracking · review your results';
};
function ActionIcon({ name }: { name: 'switch' | 'pause' | 'play' | 'stop' }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={name === 'stop' ? '#fff' : '#0b0f15'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {name === 'switch' ? <><Path d="M4 9V5h4M4 5l4 4M20 15v4h-4m4 0-4-4"/><Path d="M7 5a8 8 0 0 1 13 5M17 19A8 8 0 0 1 4 14"/></> : name === 'pause' ? <Path d="M8 5v14M16 5v14"/> : name === 'play' ? <Path d="M8 5l11 7-11 7z"/> : <Path d="M7 7h10v10H7z"/>}
  </Svg>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const bones = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
] as const;
const faultJoints: Record<string, readonly number[]> = {
  body_line: [11, 12, 23, 24, 27, 28], spine_neutral: [11, 12, 23, 24],
  knee_valgus: [23, 24, 25, 26, 27, 28], knee_over_toe: [25, 26, 27, 28], torso_swing: [11, 12, 23, 24],
};

const mapPoint = (landmark: { x: number; y: number } | undefined, width: number, height: number, scale: number, ox: number, oy: number) =>
  landmark ? { x: ox + landmark.x * width * scale, y: oy + landmark.y * height * scale } : null;

export default function PoseTrackerNative({ name, pattern, support, contactName, override, close, onSafetyAlarm, onSafetyStop, deliveryStatus }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const alive = useRef(true);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraGeneration, setCameraGeneration] = useState(0);
  const [recoveryState, setRecoveryState] = useState<CameraRecoveryState>({phase:'idle',attempt:0});
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [status, setStatus] = useState('Getting your camera ready…');
  const skeletonPath = useSharedValue('');
  const skeletonOpacity = useSharedValue(0);
  const faultPath = useSharedValue('');
  const stableSegments = useRef(createStablePoseSegments(bones, DRAW_VISIBILITY, POSE_HOLD_MS + 150));
  const animatedSkeleton = useAnimatedProps(() => ({ d: skeletonPath.value, opacity: skeletonOpacity.value }));
  const animatedFault = useAnimatedProps(() => ({ d: faultPath.value, opacity: skeletonOpacity.value }));
  const cueController = useRef(createPoseCueController());
  const activeCue = useRef<PoseCue | null>(null);
  const [cue, setCue] = useState<PoseCue | null>(null);
  const [muted, setMuted] = useState(false);
  const safety = useRef(createPoseSafety());
  const safetyEnabled = useRef(false);
  const safetyPhaseRef = useRef<SafetyPhase>('unavailable');
  const [safetyPhase, setSafetyPhase] = useState<SafetyPhase>('unavailable');
  const [safetySeconds, setSafetySeconds] = useState(30);
  const [alarmSound, setAlarmSound] = useState(true);
  const [motionSensorAvailable, setMotionSensorAvailable] = useState<boolean | null>(null);
  const issueCounts = useRef<Partial<Record<PoseIssueId, number>>>({});
  const previousIssues = useRef(new Set<string>());
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const speechGeneration = useRef(0);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const counter = useRef<ReturnType<typeof createExerciseCounter> | null>(null);
  const clock = useRef(createPoseSessionClock(() => performance.now()));
  const hasTracked = useRef(false);
  const lastUi = useRef(0);
  const visibilityGate = useRef(createPoseStartGate());
  const counting = useRef(false);
  const systemPromptPending = useRef(false);
  const patternId: PatternId = isPatternId(pattern) ? pattern : 'squat';
  const landmarkFilter = useMemo(() => createLandmarkFilter(['horizontal_push', 'jumping_jack', 'high_knees', 'mountain_climber'].includes(patternId)), [patternId]);
  const lifecycle = useRef({paused,permission,blurred:false});
  lifecycle.current.paused=paused; lifecycle.current.permission=permission;
  const nativeTicket = useRef(0);
  const recovery = useRef<ReturnType<typeof createCameraRecovery> | null>(null);
  if (!recovery.current) recovery.current=createCameraRecovery({
    setTimer:setTimeout,clearTimer:clearTimeout,
    eligible:()=>alive.current && AppState.currentState==='active' && !lifecycle.current.blurred && !lifecycle.current.paused && lifecycle.current.permission===true,
    start:ticket=>{nativeTicket.current=ticket;setCameraReady(false);setCameraGeneration(value=>value+1);},
    release:()=>{clock.current.pause();counter.current?.suspend();counting.current=false;visibilityGate.current.reset();if(alive.current)setCameraReady(false);},
    changed:state=>{if(alive.current)setRecoveryState(state);},
  });
  const cameraTicket=nativeTicket.current;
  const finishSession = () => {
    safetyEnabled.current = false;
    deactivateKeepAwake('pose-safety');
    stopNativeAlarm();
    clock.current.pause();
    const result = hasTracked.current ? counter.current?.snapshot() : null;
    const issues = Object.entries(issueCounts.current).map(([id, count]) => ({ id: id as PoseIssueId, count: count! }));
    close(result ? { completeReps: result.reps, partialReps: result.partials, durationSeconds: clock.current.seconds(), holdMs: patternSpec(patternId).mode === 'hold' ? Math.round(result.holdMs) : null, issues } : undefined);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!safetyEnabled.current) return;
      const next = safety.current.tick(performance.now());
      if (next.phase !== safetyPhaseRef.current) {
        if (next.phase === 'alarm') { speechGeneration.current++; void Speech.stop(); setAlarmSound(startNativeAlarm()); onSafetyAlarm(); }
        safetyPhaseRef.current = next.phase;
        setSafetyPhase(next.phase);
      }
      if (next.phase === 'countdown') setSafetySeconds(next.seconds);
    }, 250);
    return () => { clearInterval(timer); stopNativeAlarm(); deactivateKeepAwake('pose-safety'); };
  }, [onSafetyAlarm]);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;
    const detector = createMovementDetector();
    void Accelerometer.isAvailableAsync().then(available => {
      if (!active) return;
      setMotionSensorAvailable(available);
      if (!available) return;
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(sample => {
        if (safetyEnabled.current && detector.sample(sample)) safety.current.movement(performance.now());
      });
    }).catch(() => { if (active) setMotionSensorAvailable(false); });
    return () => { active = false; subscription?.remove(); };
  }, []);

  const options = useMemo<NativeTrackingOptions>(() => ({
    mode: 'tracking', requestId: 'posetracker-native', kind: 'squat', side: 'left', active: true, fullLandmarks: true, targetFps: targetFps(patternId),
  }), [patternId]);

  useEffect(() => {
    alive.current = true;
    systemPromptPending.current = true;
    void Camera.requestCameraPermissionsAsync().then(result => {
      if (alive.current) {setPermission(result.granted);if(!result.granted)setRecoveryState({phase:'failed',attempt:0,reason:'permission_denied'});}
    }).catch(() => { if (alive.current) {setPermission(false);setRecoveryState({phase:'failed',attempt:0,reason:'permission_denied'});} }).finally(() => {
      systemPromptPending.current = false;
    });
    const listener = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if(state==='active')lifecycle.current.blurred=false;
      recovery.current?.activity(state==='active' && !lifecycle.current.blurred);
      if (state === 'background' && !systemPromptPending.current) {
        clock.current.pause();
        counter.current?.suspend();
        counting.current = false;
        visibilityGate.current.reset();
        setCameraReady(false);
      }
    });
    const blur = AppState.addEventListener('blur',()=>{lifecycle.current.blurred=true;recovery.current?.activity(false);setAppActive(false);});
    const focus = AppState.addEventListener('focus',()=>{lifecycle.current.blurred=false;setAppActive(AppState.currentState==='active');recovery.current?.activity(AppState.currentState==='active');});
    return () => {
      alive.current = false;
      recovery.current?.stop();
      void Speech.stop();
      listener.remove();
      blur.remove(); focus.remove();
    };
  }, []);

  useEffect(() => {
    counter.current = createExerciseCounter(patternId, { override, exerciseName: name });
    setSnapshot(null);
    setStatus('Waiting for you to enter the frame');
    }, [patternId, override, name]);

  useEffect(()=>{
    if(permission && !paused){recovery.current?.activity(AppState.currentState==='active' && !lifecycle.current.blurred);recovery.current?.start();}
    else {recovery.current?.stop();if(permission===false)setRecoveryState({phase:'failed',attempt:0,reason:'permission_denied'});}
    return ()=>recovery.current?.stop();
  },[permission,paused,patternId,override,name]);

  const suspendCounting = (preserveSafety = false) => {
    if (!preserveSafety && safetyPhaseRef.current !== 'alarm') {
      safetyEnabled.current = false;
      deactivateKeepAwake('pose-safety');
      safety.current.reset();
      safetyPhaseRef.current = 'unavailable';
      setSafetyPhase('unavailable');
    }
    previousIssues.current.clear();
    speechGeneration.current++;
    void Speech.stop();
    cueController.current = createPoseCueController();
    activeCue.current = null;
    setCue(null);
    landmarkFilter.reset();
    stableSegments.current.reset();
    cancelAnimation(skeletonOpacity);
    skeletonOpacity.value = 0;
    skeletonPath.value = '';
    faultPath.value = '';
    if (counting.current) counter.current?.suspend();
    counting.current = false;
    visibilityGate.current.reset();
    setCountdown(null);
  };
  const switchCamera = () => {
    suspendCounting(true);
    setCameraReady(false);
    setStatus('Switching camera…');
    setFacing(value => value === 'front' ? 'back' : 'front');
    recovery.current?.start();
  };
  const togglePause = () => {
    if (!paused) clock.current.pause();
    suspendCounting();
    setCameraReady(false);
    setPaused(value => !value);
    setStatus(paused ? 'Getting your camera ready…' : 'Tracking paused');
  };

  const onFrame = (detail: Record<string, unknown>) => {
    if (!alive.current) return;
    if (detail.type === 'geometry-changed') { suspendCounting(true); setStatus('Camera view changed. Reposition to continue.'); return; }
    if (detail.type === 'error') {
      suspendCounting(true);
      setCameraReady(false);
      const message = typeof detail.message === 'string' ? detail.message : 'Camera tracking unavailable.';
      setStatus(message);
      recovery.current?.error(cameraTicket,detail.code==='timeout'?'timeout':message.includes('too warm')?'thermal':detail.reason==='unsupported'?'no_camera':'interrupted_too_often');
      return;
    }
    if (detail.type !== 'frame') return;
    const frame = detail.frame as {
      joints?: readonly { x: number; y: number; visibility?: number }[];
      aspect?: number; width?: number; height?: number; timestamp?: number;
    } | undefined;
    const ts = typeof frame?.timestamp === 'number' ? frame.timestamp : performance.now();
    if (!frame || !counter.current || !Array.isArray(frame.joints) || frame.joints.length < MIN_DRAW_LANDMARKS) {
      const gate = visibilityGate.current.update(ts, false);
      if (counting.current && !gate.active) { counter.current?.suspend(); counting.current = false; }
      setCountdown(null);
      setStatus('Show the working joints clearly.');
      return;
    }
    // Smooth only the drawing and framing guidance. Filtering joint positions
    // before measuring angles can flatten the bottom of continuous reps.
    const measurementJoints = frame.joints;
    frame.joints = landmarkFilter.update(measurementJoints, ts);
    if (frame.width && frame.height && viewSize.width && viewSize.height) {
      const scale = Math.max(viewSize.width / frame.width, viewSize.height / frame.height);
      const ox = (viewSize.width - frame.width * scale) / 2, oy = (viewSize.height - frame.height * scale) / 2;
      const points = frame.joints;
      const mapped = points.map(point => { const mappedPoint = mapPoint(point, frame.width!, frame.height!, scale, ox, oy); return mappedPoint && point ? { ...mappedPoint, visibility: point.visibility } : undefined; });
      const paths = stableSegments.current.update(mapped, ts);
      const path = paths.join('');
      if (path) {
        skeletonPath.value = path;
        const highlighted = faultJoints[activeCue.current?.id ?? ''] ?? [];
        faultPath.value = bones.map(([a,b], index) => highlighted.includes(a) && highlighted.includes(b) ? paths[index] : '').join('');
        cancelAnimation(skeletonOpacity);
        skeletonOpacity.value = 1;
        skeletonOpacity.value = withDelay(POSE_HOLD_MS, withTiming(0, { duration: 150 }));
      }
    }
    const aspect = typeof frame.aspect === 'number' && frame.aspect > 0 ? frame.aspect : 1;
    const framing = frameStatus(patternId, frame.joints);
    const fullBodyVisible = framing === 'OK';
    if (!fullBodyVisible) {
      const gate = visibilityGate.current.update(ts, false);
      if (counting.current && !gate.active) { counter.current.suspend(); counting.current = false; }
      setCountdown(null);
      setStatus(framing === 'TOO_CLOSE' ? 'Keep the working joints inside the view' : framing === 'TOO_FAR' ? 'Move closer' : 'Show a clear working limb');
      // Feed missing evidence into the counter too, so stale cycles expire.
      counter.current.update({ landmarks: measurementJoints, timestamp: ts, aspect });
      return;
    }
    const gate = visibilityGate.current.update(ts, true);
    if (!gate.active) {
      if (counting.current) { counter.current.suspend(); counting.current = false; }
      setCountdown(gate.countdown);
      setStatus('Hold your position. Tracking starts soon.');
      return;
    }
    setCountdown(null);
    counting.current = true;
    hasTracked.current = true;
    if (!safetyEnabled.current) { safety.current.start(ts); void activateKeepAwakeAsync('pose-safety').catch(() => {}); }
    safetyEnabled.current = true;
    safety.current.observe(frame.joints, ts);
    clock.current.start();
    const next = counter.current.update({ landmarks: measurementJoints, timestamp: ts, aspect });
    const candidateCues: PoseCue[] = next.faults.map(fault => ({ id: fault.rule, message: fault.message, priority: 'alignment' }));
    if (next.feedback === 'depth') candidateCues.push({ id: 'depth', message: 'Reach a comfortable full range.', priority: 'depth' });
    if (next.feedback === 'tempo') candidateCues.push({ id: 'tempo', message: 'Move at a steady pace.', priority: 'tempo' });
    const seen = new Set(candidateCues.map(item => item.id));
    const fresh = candidateCues.filter(item => !previousIssues.current.has(item.id));
    for (const item of fresh) if (Object.prototype.hasOwnProperty.call(POSE_ISSUES, item.id)) {
      const id = item.id as PoseIssueId;
      issueCounts.current[id] = (issueCounts.current[id] ?? 0) + 1;
    }
    previousIssues.current = seen;
    const cueResult = cueController.current.update(ts, candidateCues, muted);
    if (cueResult.cue?.id !== activeCue.current?.id) {
      speechGeneration.current++;
      activeCue.current = cueResult.cue;
      setCue(cueResult.cue);
    }
    if (cueResult.speak && cueResult.cue && safetyPhaseRef.current !== 'alarm') {
      const message = cueResult.cue.message;
      speechGeneration.current++;
      void Speech.stop();
      Speech.speak(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    const now = Date.now();
    if (now - lastUi.current < TRACKING_UI_UPDATE_MS && !next.counted) return;
    lastUi.current = now;
    setSnapshot(next);
    setStatus(next.visible
      ? (next.phase === 'lost' ? 'Body partially out of frame' : next.cue)
      : 'Working joints obscured. Adjust the camera for a clearer view.');
  };

  const spec = patternSpec(patternId);
  const hold = spec.mode === 'hold';
  const primary = hold ? (snapshot?.holdMs ?? 0) : (snapshot?.reps ?? 0);
  const primaryValue = hold ? `${(primary / 1000).toFixed(1)}s` : String(primary);

  return (
    <View style={[styles.root, { paddingTop: Math.max(8, insets.top + 4), paddingBottom: Math.max(8, insets.bottom + 4), paddingLeft: Math.max(14, insets.left + 14), paddingRight: Math.max(14, insets.right + 14) }]}>
      <Text style={styles.title} numberOfLines={1}>{name}</Text>
      <Text style={styles.badge}>{supportLabel(support)}</Text>
      <Text style={styles.status} numberOfLines={2}>{status}</Text>
      {hasTracked.current && safetyPhase === 'unavailable' && !paused && <Text style={styles.warning} accessibilityLiveRegion="polite">Safety monitoring is paused.</Text>}
      {motionSensorAvailable === false && <Text style={styles.warning} accessibilityLiveRegion="polite">Phone movement sensor unavailable; monitoring uses visible body movement only.</Text>}

      {permission === false && <Text style={styles.warning}>Allow camera access in your phone settings to start tracking.</Text>}

        <View style={[styles.camera, { height: Math.max(160, height * (landscape ? 0.38 : 0.48)) }]} onLayout={event => setViewSize(event.nativeEvent.layout)}>
          {permission && appActive && !paused && recovery.current?.current(cameraTicket) && (recoveryState.phase==='acquiring' || recoveryState.phase==='recovering' || recoveryState.phase==='ready') && <NativeTrackingCamera
            key={`${facing}:${cameraGeneration}`}
            options={options}
            facing={facing}
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
            emit={detail=>{if(recovery.current?.current(cameraTicket))onFrame(detail);}}
            ready={() => { if(!recovery.current?.current(cameraTicket))return;recovery.current.ready(cameraTicket);setCameraReady(true);setStatus('Camera ready. Step back so your whole body is visible.'); }}
          />}
          {(!cameraReady || paused) && <View style={styles.cameraPlaceholder}>
            {!paused && permission !== false && ['acquiring','recovering'].includes(recoveryState.phase) && <ActivityIndicator color="#22c55e" />}
            <Text style={styles.text}>{paused ? 'Tracking paused' : permission === null ? 'Waiting for camera permission.' : permission === false ? 'Camera permission denied. Allow access in settings, then try again.' : cameraRecoveryMessage(recoveryState)}</Text>
            {(recoveryState.phase==='failed' || permission===false) && <Pressable accessibilityRole="button" style={styles.button} onPress={() => {if(permission===false){void Camera.requestCameraPermissionsAsync().then(result=>{if(alive.current)setPermission(result.granted);});}else recovery.current?.start();}}><Text style={styles.buttonText}>Try again</Text></Pressable>}
          </View>}
          <Svg pointerEvents="none" width={viewSize.width} height={viewSize.height} style={StyleSheet.absoluteFill}>
            <AnimatedPath animatedProps={animatedSkeleton} fill="none" stroke="#22e9c0" strokeWidth={3} />
            <AnimatedPath animatedProps={animatedFault} fill="none" stroke="#ff3434" strokeWidth={6} />
          </Svg>

          {cue && <View style={styles.cueBanner} accessibilityLiveRegion="assertive"><Text style={styles.cueText}>{cue.message}</Text></View>}

          <View style={styles.counter} accessible accessibilityRole="summary" accessibilityLiveRegion="polite"
            accessibilityLabel={`${hold ? 'Longest hold' : 'Detected repetitions'}: ${primaryValue}. ${snapshot?.faults[0]?.message ?? snapshot?.cue ?? 'Waiting for tracking'}`}>
            <View style={styles.counterColumn}>
              <Text style={styles.counterLabel}>{hold ? 'LONGEST HOLD' : 'COMPLETE REPS'}</Text>
              <Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{snapshot ? primaryValue : '—'}</Text>
            </View>
            <View style={styles.counterDivider} />
            <View style={styles.counterColumn}>
              <Text style={styles.counterLabel}>{hold ? 'HOLDS ≥ MIN' : 'PARTIAL REPS'}</Text>
              <Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{snapshot ? (hold ? snapshot.holds : snapshot.partials) : '—'}</Text>
            </View>
          </View>
          {countdown !== null && <View style={styles.countdown} accessibilityLiveRegion="polite"><Text style={styles.countdownText}>{countdown}</Text></View>}
        </View>

      <View style={styles.stats}>
        {!cameraReady && permission && <Text style={styles.text}>{cameraRecoveryMessage(recoveryState)}</Text>}
        {snapshot?.faults.map((fault, index) => <Text key={`${fault.rule}-${index}`} style={styles.fault}>{fault.message}</Text>)}
        {!snapshot?.faults.length && <Text style={styles.text}>{snapshot?.cue ?? 'Stand back so your whole body is in frame.'}</Text>}
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={switchCamera}><ActionIcon name="switch"/><Text style={styles.buttonText}>Switch camera</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={togglePause}><ActionIcon name={paused ? 'play' : 'pause'}/><Text style={styles.buttonText}>{paused ? 'Resume' : 'Pause'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ checked: muted }} style={styles.button} onPress={() => { if (!muted) { speechGeneration.current++; void Speech.stop(); } setMuted(value => !value); }}><Text style={styles.buttonText}>{muted ? 'Unmute cues' : 'Mute cues'}</Text></Pressable>
        <Pressable accessibilityRole="button" style={[styles.button, styles.stop]} onPress={finishSession}><ActionIcon name="stop"/><Text style={styles.stopText}>End session</Text></Pressable>
      </View>
      {!landscape && <Text style={styles.text}>Reps and holds are movement estimates, not technique grades. This screen cannot assess pain, injury risk or equipment load.</Text>}
      {safetyPhase === 'countdown' && <View style={styles.safetyOverlay} accessibilityViewIsModal>
          <View style={styles.safetyRing}><Text style={styles.safetyNumber}>{safetySeconds}</Text><Text style={styles.safetySmall}>seconds</Text></View>
          <Text style={styles.safetyKicker}>Emergency check</Text><Text style={styles.safetyTitle}>Are you okay?</Text>
          <Text style={styles.safetyCopy}>No body or phone movement detected for 30 seconds during your {name}.</Text>
          <Text style={styles.safetyCopy}>When the countdown ends, an alarm will sound and we will try to notify your emergency contact. No location is shared.</Text>
          <Pressable style={styles.safetyButton} accessibilityRole="button" onPress={() => { safety.current.okay(performance.now()); safetyPhaseRef.current = 'monitoring'; setSafetyPhase('monitoring'); }}><Text style={styles.buttonText}>I’m okay</Text></Pressable>
          <Text style={styles.safetySmall}>Also cancels when body or phone movement is detected</Text>
      </View>}
      {safetyPhase === 'alarm' && <PoseAlarmScreen exercise={name} contactName={contactName} deliveryStatus={deliveryStatus} alarmSound={alarmSound} onStop={() => { onSafetyStop(); finishSession(); }}/>} 
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 50, elevation: 50, backgroundColor: '#0b0f15', paddingHorizontal: 14, gap: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: { color: '#ffd84c', fontSize: 12, fontWeight: '600' },
  status: { color: '#dbe7e3', fontSize: 13, lineHeight: 19 },
  text: { color: '#dbe7e3', fontSize: 12 },
  warning: { color: '#ffb86b', fontSize: 12 },
  fault: { color: '#ff9f6b', fontSize: 12 },
  cueBanner: { position: 'absolute', top: 80, left: 12, right: 12, zIndex: 4, backgroundColor: '#ad2525', padding: 12, borderRadius: 12, alignItems: 'center' },
  cueText: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800', textAlign: 'center' },
  camera: { flexShrink: 0, minHeight: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#05080c' },
  cameraPlaceholder: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  countdown: { position: 'absolute', alignSelf: 'center', top: '42%', borderRadius: 48, width: 90, height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101820dd' },
  countdownText: { color: '#fff', fontSize: 52, fontWeight: '800' },
  counter: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#101820ed', borderWidth: 1, borderColor: '#65dcbc', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minWidth: 200, zIndex: 3 },
  counterColumn: { flex: 1, alignItems: 'center', minWidth: 78 },
  counterDivider: { width: 1, height: 34, backgroundColor: '#719189', marginHorizontal: 8 },
  counterLabel: { color: '#c6e5dc', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  counterValue: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stats: { gap: 2 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { backgroundColor: '#22c55e', minHeight: 48, flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { color: '#0b0f15', fontSize: 13, fontWeight: '700' },
  stopText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stop: { backgroundColor: '#273444' },
  safetyOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, elevation: 100, backgroundColor: '#121a25', alignItems: 'center', paddingHorizontal: 28, paddingTop: 80, paddingBottom: 36, gap: 18 },
  safetyRing: { width: 136, height: 136, borderRadius: 68, borderWidth: 10, borderColor: '#ff626a', alignItems: 'center', justifyContent: 'center' },
  safetyNumber: { color: '#fff', fontSize: 40, fontWeight: '800' },
  safetyKicker: { color: '#ff747b', fontWeight: '700', marginTop: 18 },
  safetyTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  safetyCopy: { color: '#d9e1ed', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  safetySmall: { color: '#aab9ca', fontSize: 12, textAlign: 'center' },
  safetyButton: { marginTop: 'auto', backgroundColor: '#22c55e', width: '100%', minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
