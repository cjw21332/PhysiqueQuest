export const trackingKinds = ['squat', 'curl', 'pushup', 'shoulderpress', 'lateralraise', 'kneepushup', 'wallpushup', 'row', 'tricepsextension', 'hiphinge', 'bridge', 'lunge'] as const;
export type TrackingKind = typeof trackingKinds[number];
export const REP_COUNTER_VERSION = 'rep-counter-v5';
export const IDENTIFIER_VERSION = 'movement-rules-v3';
export type TrackingSide = 'left' | 'right';
export type TrackingExercise = { _id: string; name: string; equipment: string; guidance?: string };
export type Joint = { x: number; y: number; visibility?: number; presence?: number };
export type WorldJoint = { x: number; y: number; z: number };
export type TrackingFrame = { joints: Joint[]; worldJoints?: WorldJoint[]; aspect: number; timestamp: number };
export type CounterSnapshot = { reps: number; phase: 'ready' | 'bent' | 'searching'; message: string };

// Independent starter exercises; no external exercise catalog is required.
export const trackingExercises: Record<string, TrackingKind> = {
  'camera-squat': 'squat', 'camera-curl': 'curl',
  'camera-goblet-squat': 'squat', 'camera-sumo-squat': 'squat',
  'camera-hammer-curl': 'curl', 'camera-seated-curl': 'curl', 'camera-pushup': 'pushup',
  'camera-shoulderpress': 'shoulderpress', 'camera-seated-shoulderpress': 'shoulderpress',
  'camera-lateralraise': 'lateralraise', 'camera-band-lateralraise': 'lateralraise',
  'camera-knee-pushup': 'kneepushup', 'camera-wall-pushup': 'wallpushup', 'camera-close-grip-pushup': 'pushup',
  'camera-row': 'row', 'camera-single-arm-row': 'row', 'camera-triceps-extension': 'tricepsextension',
  'camera-band-curl': 'curl', 'camera-barbell-curl': 'curl', 'camera-kettlebell-goblet-squat': 'squat',
  'camera-hiphinge': 'hiphinge', 'camera-dumbbell-rdl': 'hiphinge', 'camera-barbell-rdl': 'hiphinge',
  'camera-bridge': 'bridge', 'camera-dumbbell-bridge': 'bridge', 'camera-lunge': 'lunge', 'camera-dumbbell-lunge': 'lunge',
};
export const trackingPresets: TrackingExercise[] = [
  { _id: 'camera-squat', name: 'Bodyweight squat', equipment: 'Bodyweight' },
  { _id: 'camera-curl', name: 'Standing biceps curl', equipment: 'Dumbbell' },
  { _id: 'camera-goblet-squat', name: 'Goblet squat', equipment: 'Dumbbell', guidance: 'Film from the side with your hip, knee and ankle visible. Keep the weight clear of the tracked leg. Start standing upright.' },
  { _id: 'camera-sumo-squat', name: 'Sumo squat', equipment: 'Bodyweight', guidance: 'Film from the side with your hip, knee and ankle visible. Keep the tracked leg visible in your wider stance. Start standing upright.' },
  { _id: 'camera-hammer-curl', name: 'Hammer curl', equipment: 'Dumbbell', guidance: 'Film from the side with your shoulder, elbow and wrist visible. Keep palms facing inward and start with your arm straight. Count one arm at a time.' },
  { _id: 'camera-seated-curl', name: 'Seated biceps curl', equipment: 'Dumbbell', guidance: 'Sit side-on with your shoulder, elbow and wrist clear of the chair. Start with your arm straight. Count one arm at a time.' },
  { _id: 'camera-pushup', name: 'Push-up', equipment: 'Bodyweight' },
  { _id: 'camera-shoulderpress', name: 'Standing overhead press', equipment: 'Dumbbell' },
  { _id: 'camera-seated-shoulderpress', name: 'Seated overhead press', equipment: 'Dumbbell', guidance: 'Film from the front or a slight angle with your hip, shoulder, elbow and wrist visible. Sit upright with your torso clear of the chair. Start with your arms extended overhead, lower to shoulder level, then press up. Count one arm at a time.' },
  { _id: 'camera-lateralraise', name: 'Dumbbell lateral raise', equipment: 'Dumbbell' },
  { _id: 'camera-band-lateralraise', name: 'Resistance band lateral raise', equipment: 'Resistance bands' },
  { _id: 'camera-knee-pushup', name: 'Knee push-up', equipment: 'Bodyweight' },
  { _id: 'camera-wall-pushup', name: 'Wall push-up', equipment: 'Bodyweight' },
  { _id: 'camera-close-grip-pushup', name: 'Close-grip push-up', equipment: 'Bodyweight', guidance: 'Film low and side-on with your shoulder, elbow, wrist, hip and ankle visible. Use a narrower hand position. Start with arms extended, lower your torso, then press up. The counter measures elbow cycles; it cannot verify hand spacing.' },
  { _id: 'camera-row', name: 'Dumbbell bent-over row', equipment: 'Dumbbell' },
  { _id: 'camera-single-arm-row', name: 'Single-arm dumbbell row', equipment: 'Dumbbell', guidance: 'Film side-on with your shoulder, elbow, wrist, hip and knee visible. Brace on a stable support without obscuring those joints. Hinge forward, start with the arm hanging straight, pull toward your hip, then lower. Log one arm per set.' },
  { _id: 'camera-triceps-extension', name: 'Overhead triceps extension', equipment: 'Dumbbell' },
  { _id: 'camera-band-curl', name: 'Resistance band biceps curl', equipment: 'Resistance bands', guidance: 'Secure an intact band under your feet. Film side-on with your shoulder, elbow and wrist visible. Start with your arm straight, curl, then lower. Keep your upper arm still; count one arm at a time.' },
  { _id: 'camera-barbell-curl', name: 'Barbell biceps curl', equipment: 'Barbell', guidance: 'Film side-on with the tracked shoulder, elbow and wrist visible around the bar. Start with arms straight, curl, then lower. Keep the torso steady. The selected arm supplies one count; both arms are not added together.' },
  { _id: 'camera-kettlebell-goblet-squat', name: 'Kettlebell goblet squat', equipment: 'Kettlebell', guidance: 'Film side-on with hip, knee and ankle visible. Hold the kettlebell near your chest without obscuring your tracked leg. Start upright, squat, then stand.' },
  { _id: 'camera-hiphinge', name: 'Bodyweight hip hinge', equipment: 'Bodyweight' },
  { _id: 'camera-dumbbell-rdl', name: 'Dumbbell Romanian deadlift', equipment: 'Dumbbell' },
  { _id: 'camera-barbell-rdl', name: 'Barbell Romanian deadlift', equipment: 'Barbell' },
  { _id: 'camera-bridge', name: 'Glute bridge', equipment: 'Bodyweight' },
  { _id: 'camera-dumbbell-bridge', name: 'Dumbbell glute bridge', equipment: 'Dumbbell' },
  { _id: 'camera-lunge', name: 'Stationary lunge (split squat)', equipment: 'Bodyweight' },
  { _id: 'camera-dumbbell-lunge', name: 'Dumbbell stationary lunge', equipment: 'Dumbbell' },
];
export const trackingGuidance = {
  squat: 'Stand side-on with your hip, knee and ankle visible. Start standing upright.',
  curl: 'Stand side-on with your shoulder, elbow and wrist visible. Start with your arm straight. Count one arm at a time.',
  pushup: 'Place the camera level, low and side-on. Keep your shoulder, elbow, wrist, hip and ankle visible. Start at the top of a floor push-up with arms straight and your body in a line. Lower, then return to the top.',
  shoulderpress: 'Film from the front or a slight angle with your hip, shoulder, elbow and wrist visible. Stay upright. Start with your arms extended overhead, lower to shoulder level, then press up. Count one arm at a time.',
  lateralraise: 'Face the camera with your hip, shoulder, elbow and wrist visible. Start with your arms down, raise sideways to shoulder height, then lower. Keep a small, steady elbow bend. Count one arm at a time.',
  kneepushup: 'Film low and side-on with your shoulder, elbow, wrist, hip and knee visible. Keep shoulders, hips and knees aligned. Start with arms extended, lower, then press back up.',
  wallpushup: 'Film side-on with your shoulder, elbow, wrist, hip and ankle visible. Face a solid wall with hands at shoulder height and feet back. Start with arms extended, bend toward the wall, then press away.',
  row: 'Film side-on with your shoulder, elbow, wrist, hip and knee visible. Hinge forward and hold your torso steady. Start with your arm hanging straight, pull toward your hip, then lower. Count the selected arm only.',
  tricepsextension: 'Film side-on or at a slight angle with your hip, shoulder, elbow and wrist visible. Stay upright with the upper arm overhead. Start with the elbow extended, bend to lower the weight behind your head, then extend. Count the selected arm only.',
  hiphinge: 'Film side-on with shoulder, hip, knee and ankle visible. Start upright with knees softly bent. Move your hips back while keeping the knees nearly steady, then stand. Keep the bar or weights clear of the tracked leg.',
  bridge: 'Film low and side-on with shoulder, hip, knee and ankle visible. Lie on your back with knees bent and feet planted. Start with hips down, lift your hips, then lower. The weight must not hide your hip.',
  lunge: 'Film side-on with both knees and ankles plus the selected hip and shoulder visible. Begin standing tall in a split stance, bend both knees, then rise. Keep the same lead leg throughout one set; log the other leg separately.',
};

function measureLegacyMovement(frame: TrackingFrame, kind: TrackingKind): number | null {
  if (kind === 'squat' || kind === 'curl') return jointAngle(frame);
  if (kind === 'row') {
    if (!validFrame(frame, 5)) return null;
    const [hip, shoulder, elbow, wrist, knee] = frame.joints;
    const torsoLength = Math.hypot((hip.x - shoulder.x) * frame.aspect, hip.y - shoulder.y);
    const hingeAngle = jointAngle({ ...frame, joints: [shoulder, hip, knee] });
    // Require a hinged torso and a visible leg, rather than relabeling upright curls or floor presses.
    if (torsoLength < 0.08 || Math.abs(hip.y - shoulder.y) > torsoLength * 0.7 ||
      hingeAngle === null || hingeAngle < 55 || hingeAngle > 145 || knee.y < hip.y + 0.05 ||
      elbow.y < shoulder.y - torsoLength * 0.25 || wrist.y < shoulder.y - torsoLength * 0.15) return null;
    return jointAngle({ ...frame, joints: [shoulder, elbow, wrist] });
  }
  if (kind === 'shoulderpress' || kind === 'lateralraise' || kind === 'tricepsextension') {
    if (!validFrame(frame, 4)) return null;
    const [hip, shoulder, elbow, wrist] = frame.joints;
    const torsoHeight = hip.y - shoulder.y;
    if (torsoHeight < 0.08 || Math.abs((hip.x - shoulder.x) * frame.aspect) > torsoHeight * 0.8) return null;
    const elbowAngle = jointAngle({ ...frame, joints: [shoulder, elbow, wrist] });
    if (elbowAngle === null) return null;
    const shoulderAngle = jointAngle({ ...frame, joints: [hip, shoulder, elbow] });
    if (shoulderAngle === null) return null;
    if (kind === 'tricepsextension') {
      if (shoulderAngle < 150 || wrist.y >= shoulder.y - 0.02) return null;
      return elbowAngle;
    }
    if (kind === 'shoulderpress') {
      if (wrist.y >= shoulder.y - 0.02 || elbow.y > shoulder.y + torsoHeight * 0.35 || shoulderAngle < 55 ||
        (elbowAngle >= 155 && shoulderAngle < 145) || (elbowAngle <= 100 && shoulderAngle > 120)) return null;
      return elbowAngle;
    }
    // Invert shoulder elevation so arms-down -> raised -> down uses the same cycle engine.
    if (shoulderAngle > 110 || elbowAngle < 140) return null;
    return 180 - shoulderAngle;
  }
  if (frame.joints.length !== 5) return null;
  const [shoulder, elbow, wrist, hip, support] = frame.joints;
  const elbowAngle = jointAngle({ ...frame, joints: [shoulder, elbow, wrist] });
  if (elbowAngle === null) return null;
  const bodyAngle = jointAngle({ ...frame, joints: [shoulder, hip, support] });
  if (bodyAngle === null || bodyAngle < 150) return null;
  const dx = (support.x - shoulder.x) * frame.aspect, dy = support.y - shoulder.y;
  const bodyLength = Math.hypot(dx, dy);
  if (kind === 'wallpushup') {
    if (hip.y <= shoulder.y || support.y <= hip.y || dy < bodyLength * 0.8 ||
      Math.abs(wrist.y - shoulder.y) > bodyLength * 0.2 || Math.abs((wrist.x - shoulder.x) * frame.aspect) < bodyLength * 0.15) return null;
    return elbowAngle;
  }
  // A near-horizontal body distinguishes floor push-ups from standing arm bends.
  if (Math.abs(dy) > bodyLength * 0.65 || wrist.y <= shoulder.y) return null;
  return elbowAngle;
}

function validFrame(frame: TrackingFrame, length: number) {
  return frame.aspect > 0 && Number.isFinite(frame.aspect) && frame.joints.length === length && Array.from(frame.joints).every(joint => joint && Number.isFinite(joint.x) && Number.isFinite(joint.y) &&
    joint.x >= 0 && joint.x <= 1 && joint.y >= 0 && joint.y <= 1 &&
    Number.isFinite(joint.visibility) && (joint.visibility ?? 0) >= 0.65 &&
    (joint.presence === undefined || (Number.isFinite(joint.presence) && joint.presence >= 0.65)));
}

export function jointAngle(frame: TrackingFrame): number | null {
  if (!validFrame(frame, 3)) return null;
  const [a, b, c] = frame.joints;
  const ax = (a.x - b.x) * frame.aspect, ay = a.y - b.y;
  const cx = (c.x - b.x) * frame.aspect, cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (!Number.isFinite(length) || length < 0.0001) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / length))) * 180 / Math.PI;
}

export type MeasurementSpace = 'image' | 'world';
export type MovementDefinition = {
  joints: { left: readonly number[]; right: readonly number[] };
  coordinates: 'image' | 'world-preferred';
  readyAngle: number; activeAngle: number;
  stableMs: number; minimumMotionMs: number; maximumGapMs: number;
  smoothingWeight: number; maximumReps: number;
  cues: { start: string; ready: string; return: string };
  measure: (frame: TrackingFrame, space: MeasurementSpace) => number | null;
};
const cycleDefaults = { stableMs: 150, minimumMotionMs: 300, maximumGapMs: 600, smoothingWeight: 0.65, maximumReps: 1000 };
function legacyDefinition(kind: TrackingKind, left: number[], right: number[], activeAngle = 100): MovementDefinition {
  return { ...cycleDefaults, joints: { left, right }, coordinates: 'image', readyAngle: 155, activeAngle,
    cues: { start: 'Position your selected side in view, then straighten to begin.', ready: 'Ready · bend, then straighten for one rep.', return: 'Return to the starting position.' },
    measure: frame => measureLegacyMovement(frame, kind) };
}
function angleAt(frame: TrackingFrame, indices: number[], space: MeasurementSpace = 'image') {
  const selected = { ...frame, joints: indices.map(index => frame.joints[index]), worldJoints: frame.worldJoints && indices.map(index => frame.worldJoints![index]) };
  return space === 'world' ? worldJointAngle(selected) : jointAngle(selected);
}
/** World coordinates are metric estimates, not normalized image coordinates. Image visibility still gates use. */
export function worldJointAngle(frame: TrackingFrame): number | null {
  if (!validFrame(frame, 3) || frame.worldJoints?.length !== 3 || !Array.from(frame.worldJoints).every(joint => joint && [joint.x, joint.y, joint.z].every(Number.isFinite))) return null;
  const [a, b, c] = frame.worldJoints;
  const ab = [a.x - b.x, a.y - b.y, a.z - b.z], cb = [c.x - b.x, c.y - b.y, c.z - b.z];
  const lengths = Math.hypot(...ab) * Math.hypot(...cb);
  if (!Number.isFinite(lengths) || lengths < 1e-8) return null;
  return Math.acos(Math.max(-1, Math.min(1, ab.reduce((sum, value, index) => sum + value * cb[index], 0) / lengths))) * 180 / Math.PI;
}
function hipHingeAngle(frame: TrackingFrame, space: MeasurementSpace) {
  if (!validFrame(frame, 4)) return null;
  const [shoulder, hip, knee, ankle] = frame.joints;
  const leg = angleAt(frame, [1, 2, 3]);
  if (leg === null || leg < 145 || hip.y >= knee.y - 0.04 || knee.y >= ankle.y - 0.04 || shoulder.y > hip.y + 0.05) return null;
  return angleAt(frame, [0, 1, 2], space);
}
function bridgeAngle(frame: TrackingFrame, space: MeasurementSpace) {
  if (!validFrame(frame, 4)) return null;
  const [shoulder, , knee, ankle] = frame.joints;
  const span = Math.abs((ankle.x - shoulder.x) * frame.aspect);
  if (span < 0.15 || ankle.y < knee.y + 0.06 || shoulder.y < knee.y || Math.abs(ankle.y - shoulder.y) > span * 0.4) return null;
  const hip = angleAt(frame, [0, 1, 2], space);
  return hip === null ? null : 270 - hip;
}
function lungeAngle(frame: TrackingFrame, space: MeasurementSpace) {
  if (!validFrame(frame, 6)) return null;
  const [hip, knee, ankle, , otherAnkle, shoulder] = frame.joints;
  const legLength = Math.hypot((hip.x - knee.x) * frame.aspect, hip.y - knee.y) + Math.hypot((knee.x - ankle.x) * frame.aspect, knee.y - ankle.y);
  const height = hip.y - shoulder.y;
  if (legLength < 0.15 || height < 0.08 || Math.abs((shoulder.x - hip.x) * frame.aspect) > height ||
    Math.abs((ankle.x - otherAnkle.x) * frame.aspect) < legLength * 0.35 || Math.abs(ankle.y - otherAnkle.y) > legLength * 0.25) return null;
  return angleAt(frame, [0, 1, 2], space);
}

/** Add a movement here: landmark layout, posture/measurement, phase thresholds, timing and user cues. */
export const movementDefinitions: Readonly<Record<TrackingKind, MovementDefinition>> = {
  squat: legacyDefinition('squat', [23, 25, 27], [24, 26, 28], 105),
  curl: legacyDefinition('curl', [11, 13, 15], [12, 14, 16], 65),
  pushup: legacyDefinition('pushup', [11, 13, 15, 23, 27], [12, 14, 16, 24, 28]),
  kneepushup: legacyDefinition('kneepushup', [11, 13, 15, 23, 25], [12, 14, 16, 24, 26]),
  wallpushup: legacyDefinition('wallpushup', [11, 13, 15, 23, 27], [12, 14, 16, 24, 28]),
  row: legacyDefinition('row', [23, 11, 13, 15, 25], [24, 12, 14, 16, 26]),
  shoulderpress: legacyDefinition('shoulderpress', [23, 11, 13, 15], [24, 12, 14, 16]),
  tricepsextension: legacyDefinition('tricepsextension', [23, 11, 13, 15], [24, 12, 14, 16]),
  lateralraise: { ...legacyDefinition('lateralraise', [23, 11, 13, 15], [24, 12, 14, 16], 105),
    cues: { start: 'Show your selected side, then lower your arm to begin.', ready: 'Ready · raise to shoulder height, then lower for one rep.', return: 'Lower your arm to finish the rep.' } },
  hiphinge: { ...cycleDefaults, joints: { left: [11, 23, 25, 27], right: [12, 24, 26, 28] }, coordinates: 'world-preferred', readyAngle: 155, activeAngle: 115, measure: hipHingeAngle,
    cues: { start: 'Show your shoulder and leg side-on; stand upright to begin.', ready: 'Ready · hinge at your hips, then stand for one rep.', return: 'Stand upright to finish the rep.' } },
  bridge: { ...cycleDefaults, joints: { left: [11, 23, 25, 27], right: [12, 24, 26, 28] }, coordinates: 'world-preferred', readyAngle: 140, activeAngle: 105, measure: bridgeAngle,
    cues: { start: 'Show your side on the floor; lower your hips to begin.', ready: 'Ready · lift your hips, then lower for one rep.', return: 'Lower your hips to finish the rep.' } },
  lunge: { ...cycleDefaults, joints: { left: [23, 25, 27, 26, 28, 11], right: [24, 26, 28, 25, 27, 12] }, coordinates: 'world-preferred', readyAngle: 155, activeAngle: 105, measure: lungeAngle,
    cues: { start: 'Show both legs side-on; stand tall in a split stance to begin.', ready: 'Ready · lower into the lunge, then rise for one rep.', return: 'Rise in your split stance to finish the rep.' } },
};
export function jointIndices(kind: TrackingKind, side: TrackingSide): readonly number[] { return movementDefinitions[kind].joints[side]; }
export function selectTrackingFrame(frame: TrackingFrame, kind: TrackingKind | 'auto', side: TrackingSide): TrackingFrame {
  if (kind === 'auto') return frame;
  const indices = jointIndices(kind, side);
  return { ...frame, joints: frame.joints.length ? indices.map(index => frame.joints[index]) : [],
    worldJoints: frame.worldJoints?.length ? indices.map(index => frame.worldJoints![index]) : undefined };
}
export function trackingAngle(frame: TrackingFrame, kind: TrackingKind): number | null {
  const definition = movementDefinitions[kind];
  return definition.measure(frame, definition.coordinates === 'world-preferred' && frame.worldJoints?.length ? 'world' : 'image');
}
function validateMovementDefinition(definition: MovementDefinition) {
  if (!definition || typeof definition.measure !== 'function' || !['image', 'world-preferred'].includes(definition.coordinates) ||
    ![definition.readyAngle, definition.activeAngle, definition.stableMs, definition.minimumMotionMs, definition.maximumGapMs, definition.smoothingWeight, definition.maximumReps].every(Number.isFinite) ||
    definition.readyAngle <= definition.activeAngle || definition.stableMs < 0 || definition.minimumMotionMs < 0 || definition.maximumGapMs <= definition.stableMs ||
    definition.smoothingWeight <= 0 || definition.smoothingWeight > 1 || !Number.isInteger(definition.maximumReps) || definition.maximumReps < 1 ||
    !definition.cues || !(['start', 'ready', 'return'] as const).every(key => typeof definition.cues[key] === 'string' && definition.cues[key].length > 0) ||
    !['left', 'right'].every(side => { const indices = definition.joints?.[side as TrackingSide]; return Array.isArray(indices) && indices.length >= 3 && new Set(indices).size === indices.length && indices.every(index => Number.isInteger(index) && index >= 0 && index < 33); })) throw new Error('Invalid movement definition');
}

export function createConfiguredRepCounter(definition: MovementDefinition) {
  validateMovementDefinition(definition);
  const { readyAngle, activeAngle, stableMs, minimumMotionMs, maximumGapMs, smoothingWeight, maximumReps } = definition;
  let reps = 0;
  let phase: CounterSnapshot['phase'] = 'searching';
  let lastTimestamp = -Infinity;
  let smoothed: number | null = null;
  let candidate: 'straight' | 'bent' | null = null;
  let candidateSince = 0;
  let bentAt = 0;
  let measurementSpace: MeasurementSpace | null = null;
  const clearMotion = () => { phase = 'searching'; smoothed = null; candidate = null; measurementSpace = null; };
  const snapshot = (): CounterSnapshot => ({ reps, phase, message: phase === 'searching' ? definition.cues.start : phase === 'ready' ? definition.cues.ready : definition.cues.return });
  return {
    snapshot,
    resetMotion() { clearMotion(); lastTimestamp = -Infinity; return snapshot(); },
    update(frame: TrackingFrame): CounterSnapshot {
      if (!Number.isFinite(frame.timestamp) || frame.timestamp <= lastTimestamp) return snapshot();
      if (frame.timestamp - lastTimestamp > maximumGapMs) clearMotion();
      lastTimestamp = frame.timestamp;
      const space: MeasurementSpace = definition.coordinates === 'world-preferred' && frame.worldJoints?.length ? 'world' : 'image';
      if (measurementSpace !== null && measurementSpace !== space) clearMotion();
      measurementSpace = space;
      const angle = definition.measure(frame, space);
      if (angle === null || !Number.isFinite(angle)) { clearMotion(); return snapshot(); }
      smoothed = smoothed === null ? angle : smoothed * (1 - smoothingWeight) + angle * smoothingWeight;
      const next = smoothed >= readyAngle ? 'straight' : smoothed <= activeAngle ? 'bent' : null;
      if (!next) { candidate = null; return snapshot(); }
      if (next !== candidate) { candidate = next; candidateSince = frame.timestamp; return snapshot(); }
      if (frame.timestamp - candidateSince < stableMs) return snapshot();
      if (next === 'straight') {
        if (phase === 'bent' && frame.timestamp - bentAt >= minimumMotionMs) reps = Math.min(maximumReps, reps + 1);
        phase = 'ready';
      } else if (phase === 'ready') {
        phase = 'bent'; bentAt = frame.timestamp;
      }
      return snapshot();
    },
  };
}

export function createRepCounter(kind: TrackingKind) { return createConfiguredRepCounter(movementDefinitions[kind]); }

export type IdentifiedExercise = {
  identifierVersion?: string;
  exerciseId: string;
  trackingPresetId: string;
  name: string;
  equipment: string;
  kind: TrackingKind;
  side: TrackingSide;
  reps: number;
};

export type PosePhaseClassifier = { version?: string; kinds: readonly TrackingKind[]; classify: (frame: TrackingFrame) => { kind: TrackingKind; side: TrackingSide; phase: 'ready' | 'active' } | null };
/** Opt-in trained path. No trained model is bundled or activated without held-out motion evidence. */
export function createLearnedExerciseIdentifier(classifier: PosePhaseClassifier) {
  let prediction: ReturnType<PosePhaseClassifier['classify']> = null;
  let frames = 0, lastTimestamp = -Infinity;
  const kinds = [...new Set(classifier.kinds)];
  if (!kinds.length || kinds.some(kind => !trackingKinds.includes(kind))) throw new Error('Unsupported classifier movements');
  const candidates = kinds.flatMap(kind => (['left', 'right'] as const).map(side => ({ kind, side, visible: 0,
    counter: createConfiguredRepCounter({ ...movementDefinitions[kind], coordinates: 'image', readyAngle: 155, activeAngle: 105,
      measure: () => prediction?.kind === kind && prediction.side === side ? prediction.phase === 'ready' ? 180 : 90 : null }) })));
  return {
    update(frame: TrackingFrame) {
      if (!Number.isFinite(frame.timestamp) || frame.timestamp <= lastTimestamp) return;
      lastTimestamp = frame.timestamp; frames++; prediction = classifier.classify(frame);
      for (const item of candidates) { if (prediction?.kind === item.kind && prediction.side === item.side) item.visible++; item.counter.update(frame); }
    },
    result(): IdentifiedExercise | null {
      const moving = kinds.map(kind => candidates.filter(item => item.kind === kind).sort((a, b) => b.counter.snapshot().reps - a.counter.snapshot().reps || b.visible - a.visible)[0]).filter(item => item.counter.snapshot().reps > 0);
      if (moving.length !== 1 || moving[0].visible < 10 || moving[0].visible / frames < .5) return null;
      const best = moving[0], preset = trackingPresets.find(item => trackingExercises[item._id] === best.kind)!;
      const names: Record<TrackingKind, string> = { squat: 'Squat', curl: 'Biceps curl', pushup: 'Push-up', shoulderpress: 'Overhead press', lateralraise: 'Lateral raise', kneepushup: 'Knee push-up', wallpushup: 'Wall push-up', row: 'Row', tricepsextension: 'Overhead triceps extension', hiphinge: 'Hip hinge', bridge: 'Glute bridge', lunge: 'Stationary lunge' };
      return { identifierVersion: classifier.version ?? 'pose-phase-v1', kind: best.kind, side: best.side, exerciseId: `movement-${best.kind}`, trackingPresetId: preset._id, name: names[best.kind], equipment: '', reps: best.counter.snapshot().reps };
    },
  };
}

/** Conservative movement-family rules, not a trained exercise classifier.
 * Consume the complete landmark frame once; never retain the video or frames.
 */
export function createExerciseIdentifier() {
  const identifiableKinds = ['squat', 'curl', 'pushup', 'shoulderpress', 'lateralraise'] as const;
  const candidates = identifiableKinds.flatMap(kind =>
    (['left', 'right'] as const).map(side => ({ kind, side, counter: createRepCounter(kind), visible: 0 })),
  );
  let frames = 0;
  let lastTimestamp = -Infinity;
  return {
    update(frame: TrackingFrame) {
      if (!Number.isFinite(frame.timestamp) || frame.timestamp <= lastTimestamp) return;
      lastTimestamp = frame.timestamp;
      frames++;
      for (const candidate of candidates) {
        const selectedFrame = frame.joints.length === 33 ? selectTrackingFrame(frame, candidate.kind, candidate.side) : { ...frame, joints: [], worldJoints: undefined };
        let joints = selectedFrame.joints;
        if (candidate.kind === 'lateralraise' && joints.length) {
          const [hip, shoulder] = joints;
          const left = frame.joints[11], right = frame.joints[12];
          const shoulders = { ...frame, joints: [left, right, hip] };
          // A side-on front raise can project like a lateral raise. Require a visible front view.
          if (jointAngle(shoulders) === null || Math.abs((right.x - left.x) * frame.aspect) < Math.max(0.08, (hip.y - shoulder.y) * 0.35) ||
            Math.abs(right.y - left.y) > Math.abs((right.x - left.x) * frame.aspect) * 0.5) joints = [];
        }
        if ((candidate.kind === 'squat' || candidate.kind === 'curl') && joints.length) {
          const [shoulderIndex, elbowIndex, hipIndex, kneeIndex, ankleIndex] = candidate.side === 'left' ? [11, 13, 23, 25, 27] : [12, 14, 24, 26, 28];
          const torso = { ...frame, joints: [frame.joints[shoulderIndex], frame.joints[hipIndex], frame.joints[ankleIndex]] };
          const [shoulder, hip, ankle] = torso.joints;
          const upright = jointAngle(torso) !== null && hip.y > shoulder.y && ankle.y > hip.y + 0.08 &&
            hip.y - shoulder.y >= Math.hypot((hip.x - shoulder.x) * frame.aspect, hip.y - shoulder.y) * 0.55;
          // Curls need stable extended legs and an upper arm directed downwards;
          // this rejects floor push-ups and simultaneous squat/curl movements.
          const elbow = frame.joints[elbowIndex];
          const legAngle = jointAngle({ ...frame, joints: [hip, frame.joints[kneeIndex], ankle] });
          const curlPosture = candidate.kind !== 'curl' || (shoulder && elbow && legAngle !== null && legAngle >= 150 &&
            elbow.y > shoulder.y + 0.05 && Math.abs((elbow.x - shoulder.x) * frame.aspect) <= (elbow.y - shoulder.y) * 0.8);
          if (!upright || !curlPosture) joints = [];
          if (candidate.kind === 'squat' && joints.length) {
            const otherAnkle = frame.joints[candidate.side === 'left' ? 28 : 27];
            const knee = frame.joints[kneeIndex];
            // A visible split stance is ambiguous with a lunge, not an automatic squat label.
            if (jointAngle({ ...frame, joints: [hip, knee, otherAnkle] }) !== null) {
              const legLength = Math.hypot((hip.x - knee.x) * frame.aspect, hip.y - knee.y) + Math.hypot((knee.x - ankle.x) * frame.aspect, knee.y - ankle.y);
              if (Math.abs((otherAnkle.x - ankle.x) * frame.aspect) > legLength * .35) joints = [];
            }
          }
        }
        const selected = { ...selectedFrame, joints };
        if (trackingAngle(selected, candidate.kind) !== null) candidate.visible++;
        candidate.counter.update(selected);
      }
    },
    result(): IdentifiedExercise | null {
      const families = identifiableKinds.map(kind =>
        candidates.filter(candidate => candidate.kind === kind).sort((a, b) =>
          b.counter.snapshot().reps - a.counter.snapshot().reps || b.visible - a.visible)[0],
      );
      // Mixed clips and ambiguous competing movement cycles require manual selection.
      const moving = families.filter(candidate => candidate.counter.snapshot().reps > 0);
      if (moving.length !== 1) return null;
      const best = moving[0];
      if (best.visible < 10 || best.visible / frames < 0.5) return null;
      const names = { squat: 'Squat', curl: 'Biceps curl', pushup: 'Push-up', shoulderpress: 'Overhead press', lateralraise: 'Lateral raise' };
      return {
        exerciseId: `movement-${best.kind}`,
        trackingPresetId: best.kind === 'pushup' ? 'camera-pushup' : `camera-${best.kind}`,
        name: names[best.kind], equipment: best.kind === 'pushup' ? 'Bodyweight' : '',
        kind: best.kind, side: best.side, reps: best.counter.snapshot().reps,
      };
    },
  };
}
