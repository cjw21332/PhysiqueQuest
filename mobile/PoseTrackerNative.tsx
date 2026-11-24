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
import { createRiskMonitor, type RiskAlert } from './poseRisk';
import { exerciseIntensity, SAFETY_PROFILE } from '../shared/exerciseIntensity';
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

type Props = { token?: string; exercise: string; name: string; pattern: string; support?: string; contactName?: string; age?: number; override?: ExerciseConfigOverride; close: (summary?: NativePoseSummary) => void; onSafetyAlarm: () => void; onSafetyStop: () => void; deliveryStatus: 'idle' | 'pending' | 'delivered' | 'failed' };

const supportLabel = (support?: string) => {
  if (support === 'FULLY_SUPPORTED') return 'Camera tracking available';
  return 'Estimated tracking · review your results';
};
type IconName = 'switch' | 'pause' | 'play' | 'stop' | 'sound' | 'mute' | 'wrench' | 'heart';
const ICONS: Record<IconName, string> = {
  switch: 'M4 9V5h4M4 5l4 4M20 15v4h-4m4 0-4-4M7 5a8 8 0 0 1 13 5M17 19A8 8 0 0 1 4 14',
  pause: 'M8 5v14M16 5v14', play: 'M8 5l11 7-11 7z', stop: 'M7 7h10v10H7z',
  sound: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6', mute: 'M4 10v4h4l5 4V6L8 10zM17 10l4 4m0-4-4 4',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
};
function ActionIcon({ name, color = '#0b0f15' }: { name: IconName; color?: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d={ICONS[name]}/></Svg>;
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

// Backward capture-clock jumps larger than this are a camera restart, not a late frame.
const CAPTURE_CLOCK_RESET_MS = 2000;

export default function PoseTrackerNative({ name, pattern, support, contactName, age, override, close, onSafetyAlarm, onSafetyStop, deliveryStatus }: Props) {
  const intensity = exerciseIntensity(name, pattern, isPatternId(pattern) && patternSpec(pattern).mode === 'hold');
  const safetyProfile = SAFETY_PROFILE[intensity];
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
  const recentRepTimes = useRef<number[]>([]);
  const [cadence, setCadence] = useState<number | null>(null);
  const lastCaptureTime = useRef<number | null>(null);
  const stableSegments = useRef(createStablePoseSegments(bones, DRAW_VISIBILITY, POSE_HOLD_MS + 150));
  const animatedSkeleton = useAnimatedProps(() => ({ d: skeletonPath.value, opacity: skeletonOpacity.value }));
  const animatedFault = useAnimatedProps(() => ({ d: faultPath.value, opacity: skeletonOpacity.value }));
  const cueController = useRef(createPoseCueController());
  const activeCue = useRef<PoseCue | null>(null);
  const [cue, setCue] = useState<PoseCue | null>(null);
  const [muted, setMuted] = useState(false);
  const safety = useRef(createPoseSafety({ stillMs: safetyProfile.stillMs, countdownMs: safetyProfile.countdownMs }));
  const risk = useRef(createRiskMonitor(intensity, age));
  const riskAlertRef = useRef<RiskAlert | null>(null);
  const [riskAlert, setRiskAlert] = useState<RiskAlert | null>(null);
  const [equipmentStop, setEquipmentStop] = useState(false);
  const safetyEnabled = useRef(false);
  const safetyPhaseRef = useRef<SafetyPhase>('unavailable');
  const [safetyPhase, setSafetyPhase] = useState<SafetyPhase>('unavailable');
  const [safetySeconds, setSafetySeconds] = useState(Math.round(safetyProfile.countdownMs / 1000));
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
    setStatus('Show the joints used for this movement in the camera view.');
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
    recentRepTimes.current = [];
    setCadence(null);
    lastCaptureTime.current = null;
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
    const captureTime = frame?.timestamp;
    if (typeof captureTime === 'number' && Number.isFinite(captureTime)) {
      const last = lastCaptureTime.current;
      if (last !== null && captureTime <= last) {
        // A small step back is a late or duplicate frame: drop it. A large jump
        // back means the camera restarted its clock (for example a stale frame
        // from the previous camera arrived first); start a fresh timeline
        // instead of discarding every frame from now on.
        if (last - captureTime < CAPTURE_CLOCK_RESET_MS) return;
        landmarkFilter.reset();
        recentRepTimes.current = [];
      }
      lastCaptureTime.current = captureTime;
    }
    const ts = typeof captureTime === 'number' && Number.isFinite(captureTime) ? captureTime : performance.now();
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
    if (next.counted) {
      recentRepTimes.current = [...recentRepTimes.current.filter(time => ts - time <= 20000), ts].slice(-4);
    }
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
    const formAlert = risk.current.observe(fresh.map(item => item.id), ts);
    const repAlert = next.counted ? risk.current.rep(ts) : null;
    const alert = formAlert ?? repAlert;
    if (alert && !riskAlertRef.current) {
      riskAlertRef.current = alert;
      setRiskAlert(alert);
      const id: PoseIssueId = alert.kind === 'form' ? 'injury_risk' : 'fatigue';
      issueCounts.current[id] = (issueCounts.current[id] ?? 0) + 1;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      // Safety stops are spoken even when form cues are muted.
      if (safetyPhaseRef.current !== 'alarm') { speechGeneration.current++; void Speech.stop(); Speech.speak(`${alert.title}. ${alert.fix}`); }
    }
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
    const times = recentRepTimes.current;
    const lastRep = times[times.length - 1];
    setCadence(times.length >= 3 && ts - lastRep < 10000 ? Math.round(60000 * (times.length - 1) / (lastRep - times[0])) : null);
    setSnapshot(next);
    setStatus(next.visible
      ? (next.phase === 'lost' ? 'Body partially out of frame' : next.cue)
      : 'Working joints obscured. Adjust the camera for a clearer view.');
  };

  const spec = patternSpec(patternId);
  const hold = spec.mode === 'hold';
  const primary = hold ? (snapshot?.holdMs ?? 0) : (snapshot?.reps ?? 0);
  const primaryValue = hold ? `${(primary / 1000).toFixed(1)}s` : String(primary);
  const monitoring = safetyPhase === 'monitoring' || safetyPhase === 'countdown';
  const stillSeconds = Math.round(safetyProfile.stillMs / 1000);
  const pauseFor = (message: string) => { risk.current.reset(); if (!paused) togglePause(); setStatus(message); };
  const dismissAlert = (rest: boolean) => {
    riskAlertRef.current = null;
    setRiskAlert(null);
    if (rest) pauseFor('Paused. Rest, reset your position and resume when you are ready.');
  };
  const reportEquipment = () => {
    issueCounts.current.equipment = (issueCounts.current.equipment ?? 0) + 1;
    pauseFor('Paused for an equipment problem.');
    setEquipmentStop(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };
  const tools: { icon: IconName; label: string; hint: string; onPress: () => void; checked?: boolean }[] = [
    { icon: 'switch', label: 'Flip', hint: 'Switches between the front and back camera', onPress: switchCamera },
    { icon: muted ? 'mute' : 'sound', label: muted ? 'Unmute' : 'Mute', hint: 'Turns spoken form cues on or off. Safety stops are always spoken.', checked: muted, onPress: () => { if (!muted) { speechGeneration.current++; void Speech.stop(); } setMuted(value => !value); } },
    { icon: 'heart', label: 'Too hard', hint: 'Pauses tracking so you can recover', onPress: () => pauseFor('Paused for recovery. Breathe, rest and resume only when you feel ready.') },
    { icon: 'wrench', label: 'Equipment', hint: 'Reports broken or unstable equipment and pauses tracking', onPress: reportEquipment },
  ];
  const notice = permission === false ? 'Allow camera access in your phone settings to start tracking.'
    : motionSensorAvailable === false ? 'Phone movement sensor unavailable; safety uses visible body movement only.'
    : hasTracked.current && safetyPhase === 'unavailable' && !paused ? 'Safety monitoring is paused.' : null;

  return (
    <View style={[styles.root, { paddingTop: Math.max(10, insets.top + 6), paddingBottom: Math.max(10, insets.bottom + 6), paddingLeft: Math.max(14, insets.left + 14), paddingRight: Math.max(14, insets.right + 14) }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{supportLabel(support)}</Text>
        </View>
        <View style={[styles.chip, intensity === 'high' ? styles.chipHigh : intensity === 'low' ? styles.chipLow : styles.chipModerate]} accessibilityLabel={`${safetyProfile.label}. Safety checks adjust to this level.`}>
          <Text style={styles.chipText}>{safetyProfile.label}</Text>
        </View>
      </View>

      <View style={[styles.camera, { minHeight: landscape ? 160 : 260 }]} onLayout={event => setViewSize(event.nativeEvent.layout)}>
        {permission && appActive && !paused && recovery.current?.current(cameraTicket) && (recoveryState.phase==='acquiring' || recoveryState.phase==='recovering' || recoveryState.phase==='ready') && <NativeTrackingCamera
          key={`${facing}:${cameraGeneration}`}
          options={options}
          facing={facing}
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
          emit={detail=>{if(recovery.current?.current(cameraTicket))onFrame(detail);}}
          ready={() => { if(!recovery.current?.current(cameraTicket))return;recovery.current.ready(cameraTicket);setCameraReady(true);setStatus('Camera ready. Frame your working joints clearly to begin.'); }}
        />}
        {(!cameraReady || paused) && <View style={styles.cameraPlaceholder}>
          {!paused && permission !== false && ['acquiring','recovering'].includes(recoveryState.phase) && <ActivityIndicator color={C.green} />}
          <Text style={styles.placeholderText}>{paused ? 'Tracking paused' : permission === null ? 'Waiting for camera permission.' : permission === false ? 'Camera permission denied. Allow access in settings, then try again.' : cameraRecoveryMessage(recoveryState)}</Text>
          {(recoveryState.phase==='failed' || permission===false) && <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => {if(permission===false){void Camera.requestCameraPermissionsAsync().then(result=>{if(alive.current)setPermission(result.granted);});}else recovery.current?.start();}}><Text style={styles.primaryText}>Try again</Text></Pressable>}
        </View>}
        <Svg pointerEvents="none" width={viewSize.width} height={viewSize.height} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={animatedSkeleton} fill="none" stroke="#22e9c0" strokeWidth={3} />
          <AnimatedPath animatedProps={animatedFault} fill="none" stroke={C.red} strokeWidth={6} />
        </Svg>

        <View style={styles.counter} accessible accessibilityRole="summary" accessibilityLiveRegion="polite"
          accessibilityLabel={`${hold ? 'Longest hold' : 'Detected repetitions'}: ${primaryValue}. ${snapshot?.faults[0]?.message ?? snapshot?.cue ?? 'Waiting for tracking'}`}>
          <View style={styles.counterColumn}>
            <Text style={styles.counterValue} adjustsFontSizeToFit numberOfLines={1}>{snapshot ? primaryValue : '—'}</Text>
            <Text style={styles.counterLabel}>{hold ? 'LONGEST HOLD' : 'REPS'}</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterColumn}>
            <Text style={styles.counterMinor} adjustsFontSizeToFit numberOfLines={1}>{snapshot ? (hold ? snapshot.holds : snapshot.partials) : '—'}</Text>
            <Text style={styles.counterLabel}>{hold ? 'HOLDS ≥ MIN' : 'PARTIAL'}</Text>
          </View>
        </View>

        {cue && !riskAlert && <View style={styles.cueBanner} accessibilityLiveRegion="assertive"><Text style={styles.cueText}>{cue.message}</Text></View>}
        {countdown !== null && <View style={styles.countdown} accessibilityLiveRegion="polite"><Text style={styles.countdownText}>{countdown}</Text></View>}

        <View style={styles.hudBottom} pointerEvents="none">
          <View style={styles.hudRow}>
            <View style={styles.safetyPill} accessibilityLiveRegion="polite">
              <View style={[styles.dot, { backgroundColor: monitoring ? C.green : C.muted }]} />
              <Text style={styles.safetyPillText}>{monitoring ? `Safety on · check after ${stillSeconds}s still` : paused ? 'Safety paused' : 'Safety starts with tracking'}</Text>
            </View>
            {!hold && !paused && cadence !== null && <Text style={styles.pace}>{cadence} reps/min</Text>}
          </View>
          <Text style={[styles.status, snapshot?.faults.length ? styles.statusFault : null]} numberOfLines={2}>{snapshot?.faults[0]?.message ?? status}</Text>
        </View>
      </View>

      {notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}

      <View style={styles.tools}>
        {tools.map(tool => <Pressable key={tool.icon + tool.label} accessibilityRole="button" accessibilityLabel={tool.label} accessibilityHint={tool.hint} accessibilityState={tool.checked === undefined ? undefined : { checked: tool.checked }} style={({ pressed }) => [styles.tool, pressed && styles.pressed]} onPress={tool.onPress}>
          <ActionIcon name={tool.icon} color={tool.icon === 'wrench' ? C.amber : C.text}/>
          <Text style={styles.toolText} numberOfLines={1}>{tool.label}</Text>
        </Pressable>)}
      </View>
      <View style={styles.primaryRow}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, styles.grow, pressed && styles.pressed]} onPress={togglePause}><ActionIcon name={paused ? 'play' : 'pause'}/><Text style={styles.primaryText}>{paused ? 'Resume' : 'Pause'}</Text></Pressable>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.endButton, styles.grow, pressed && styles.pressed]} onPress={finishSession}><ActionIcon name="stop" color={C.text}/><Text style={styles.endText}>End session</Text></Pressable>
      </View>
      {!landscape && <Text style={styles.disclaimer}>Counts and form alerts are camera estimates. Stop if you feel pain, dizziness or sharp discomfort.</Text>}

      {riskAlert && <View style={styles.sheetBackdrop} accessibilityViewIsModal>
        <View style={[styles.sheet, { borderTopColor: riskAlert.kind === 'form' ? C.red : C.amber }]}>
          <Text style={[styles.sheetKicker, { color: riskAlert.kind === 'form' ? C.red : C.amber }]}>{riskAlert.kind === 'form' ? 'INJURY RISK · STOP AND FIX' : 'FATIGUE WARNING'}</Text>
          <Text style={styles.sheetTitle} accessibilityRole="header">{riskAlert.title}</Text>
          <Text style={styles.sheetCopy}>{riskAlert.reason}</Text>
          <View style={styles.fixBox}><Text style={styles.fixLabel}>HOW TO FIX IT</Text><Text style={styles.fixText}>{riskAlert.fix}</Text></View>
          <View style={styles.primaryRow}>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.endButton, styles.grow, pressed && styles.pressed]} onPress={() => dismissAlert(false)}><Text style={styles.endText}>I’ve fixed it</Text></Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, styles.grow, pressed && styles.pressed]} onPress={() => dismissAlert(true)}><Text style={styles.primaryText}>Pause and rest</Text></Pressable>
          </View>
        </View>
      </View>}

      {equipmentStop && <View style={styles.sheetBackdrop} accessibilityViewIsModal>
        <View style={[styles.sheet, { borderTopColor: C.amber }]}>
          <Text style={[styles.sheetKicker, { color: C.amber }]}>EQUIPMENT PROBLEM</Text>
          <Text style={styles.sheetTitle} accessibilityRole="header">Stop using this equipment</Text>
          <Text style={styles.sheetCopy}>Lower or rack the weight safely and step away. Do not use a bench, barbell, plate, dumbbell or cable that is bent, cracked, wobbling, loose or frayed.</Text>
          <View style={styles.fixBox}><Text style={styles.fixLabel}>WHAT TO DO</Text><Text style={styles.fixText}>Tell gym staff so it can be inspected. Continue only with equipment that is secure, or switch to a bodyweight exercise.</Text></View>
          <View style={styles.primaryRow}>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.endButton, styles.grow, pressed && styles.pressed]} onPress={() => setEquipmentStop(false)}><Text style={styles.endText}>Use other equipment</Text></Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, styles.grow, pressed && styles.pressed]} onPress={finishSession}><Text style={styles.primaryText}>End session</Text></Pressable>
          </View>
        </View>
      </View>}

      {safetyPhase === 'countdown' && <View style={styles.safetyOverlay} accessibilityViewIsModal>
          <View style={styles.safetyRing}><Text style={styles.safetyNumber}>{safetySeconds}</Text><Text style={styles.safetySmall}>seconds</Text></View>
          <Text style={styles.safetyKicker}>Emergency check</Text><Text style={styles.safetyTitle}>Are you okay?</Text>
          <Text style={styles.safetyCopy}>No body or phone movement detected for {stillSeconds} seconds during your {name}.</Text>
          <Text style={styles.safetyCopy}>When the countdown ends, an alarm will sound and we will try to notify your emergency contact. No location is shared.</Text>
          <Pressable style={styles.safetyButton} accessibilityRole="button" onPress={() => { safety.current.okay(performance.now()); safetyPhaseRef.current = 'monitoring'; setSafetyPhase('monitoring'); }}><Text style={styles.primaryText}>I’m okay</Text></Pressable>
          <Text style={styles.safetySmall}>Also cancels when body or phone movement is detected</Text>
      </View>}
      {safetyPhase === 'alarm' && <PoseAlarmScreen exercise={name} contactName={contactName} deliveryStatus={deliveryStatus} alarmSound={alarmSound} onStop={() => { onSafetyStop(); finishSession(); }}/>}
    </View>
  );
}

const C = { bg: '#0b0f15', surface: '#141b24', raised: '#1c2532', line: '#2a3647', text: '#f3f6f9', muted: '#9fb0c3', green: '#22c55e', amber: '#f5a524', red: '#ef4444' };
const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 50, elevation: 50, backgroundColor: C.bg, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: C.muted, fontSize: 12, marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  chipLow: { borderColor: '#2f6f4a', backgroundColor: '#123222' },
  chipModerate: { borderColor: '#7a5a1c', backgroundColor: '#2e2410' },
  chipHigh: { borderColor: '#8a2b2b', backgroundColor: '#3a1414' },
  chipText: { color: C.text, fontSize: 11, fontWeight: '700' },
  camera: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#05080c', borderWidth: 1, borderColor: C.line },
  cameraPlaceholder: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  placeholderText: { color: C.muted, fontSize: 14, textAlign: 'center' },
  counter: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0b0f15e6', borderWidth: 1, borderColor: '#ffffff22', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, zIndex: 3 },
  counterColumn: { alignItems: 'center', minWidth: 56 },
  counterDivider: { width: 1, height: 36, backgroundColor: '#ffffff26', marginHorizontal: 12 },
  counterValue: { color: C.text, fontSize: 40, lineHeight: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  counterMinor: { color: C.muted, fontSize: 24, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  counterLabel: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  cueBanner: { position: 'absolute', top: 92, left: 12, right: 12, zIndex: 4, backgroundColor: '#b42318f0', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center' },
  cueText: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  countdown: { position: 'absolute', alignSelf: 'center', top: '40%', borderRadius: 48, width: 96, height: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f15dd' },
  countdownText: { color: '#fff', fontSize: 52, fontWeight: '800' },
  hudBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, gap: 6, backgroundColor: '#0b0f15b3' },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  safetyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  safetyPillText: { color: C.text, fontSize: 12, fontWeight: '600' },
  pace: { color: C.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  status: { color: C.text, fontSize: 14, lineHeight: 20 },
  statusFault: { color: '#ffb4a8', fontWeight: '700' },
  notice: { color: C.amber, fontSize: 12 },
  tools: { flexDirection: 'row', gap: 8 },
  tool: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 4 },
  toolText: { color: C.text, fontSize: 11, fontWeight: '600' },
  primaryRow: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  primaryButton: { backgroundColor: C.green, minHeight: 52, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 14 },
  primaryText: { color: C.bg, fontSize: 15, fontWeight: '800' },
  endButton: { backgroundColor: C.raised, minHeight: 52, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: C.line },
  endText: { color: C.text, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  disclaimer: { color: C.muted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  sheetBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 90, elevation: 90, backgroundColor: '#000000a6', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 4, padding: 22, paddingBottom: 34, gap: 12 },
  sheetKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  sheetTitle: { color: C.text, fontSize: 26, fontWeight: '800' },
  sheetCopy: { color: C.muted, fontSize: 15, lineHeight: 22 },
  fixBox: { backgroundColor: C.raised, borderRadius: 14, padding: 14, gap: 4 },
  fixLabel: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  fixText: { color: C.text, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  safetyOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, elevation: 100, backgroundColor: '#121a25', alignItems: 'center', paddingHorizontal: 28, paddingTop: 80, paddingBottom: 36, gap: 18 },
  safetyRing: { width: 136, height: 136, borderRadius: 68, borderWidth: 10, borderColor: '#ff626a', alignItems: 'center', justifyContent: 'center' },
  safetyNumber: { color: '#fff', fontSize: 40, fontWeight: '800' },
  safetyKicker: { color: '#ff747b', fontWeight: '700', marginTop: 18 },
  safetyTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  safetyCopy: { color: '#d9e1ed', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  safetySmall: { color: '#aab9ca', fontSize: 12, textAlign: 'center' },
  safetyButton: { marginTop: 'auto', backgroundColor: C.green, width: '100%', minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
