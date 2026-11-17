/**
 * PhysiqueQuest on-device exercise analysis engine.
 *
 * One deterministic, framework-free engine is shared by the live camera path and
 * the uploaded-video path. MediaPipe Pose provides the 33 landmarks; everything
 * in this file is PhysiqueQuest logic (angles, phases, repetition counting,
 * range of motion and landmark-verifiable form screening).
 *
 * This is NOT a trained model. The optional exercise-pattern classifier in
 * ml/models is a separate, unvalidated artefact; nothing here depends on it.
 *
 * All thresholds are measurement heuristics. They have not been validated on
 * real people for any exercise, so every runtime surface must label output as
 * experimental. Form rules are screening signals, never safety assessments.
 */

export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

export type PoseFrame = {
  landmarks: readonly Landmark[];
  timestamp: number;
  /** width / height of the frame the landmarks were normalised against. */
  aspect: number;
};

export type PatternId =
  | 'squat'
  | 'squat_hold'
  | 'lunge'
  | 'hinge'
  | 'hip_thrust'
  | 'horizontal_push'
  | 'vertical_push'
  | 'dip'
  | 'curl'
  | 'triceps_extension'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'lateral_raise'
  | 'front_raise'
  | 'calf_raise'
  | 'core_flexion'
  | 'core_isometric'
  | 'jumping_jack'
  | 'mountain_climber'
  | 'high_knees';

export type CameraView = 'front' | 'side';
export type CountingMode = 'bilateral' | 'per_side' | 'hold';

export type FormRuleId =
  | 'knee_valgus'
  | 'body_line'
  | 'spine_neutral'
  | 'torso_swing'
  | 'knee_over_toe';

export type PatternSpec = {
  id: PatternId;
  label: string;
  camera: CameraView;
  /** Landmark triplet [proximal, joint, distal] measured for each side. */
  joints: { left: readonly [number, number, number]; right: readonly [number, number, number] };
  startAngle: number;
  peakAngle: number;
  /** Progress (0..1) below which the movement is considered back at the start. */
  startThreshold: number;
  /** Progress (0..1) that must be sustained to register the peak. */
  peakThreshold: number;
  /** Minimum observed excursion, in degrees, for a rep to count. */
  minRom: number;
  minRepMs: number;
  maxRepMs: number;
  /** Time the peak must be sustained. */
  dwellMs: number;
  visibility: number;
  mode: CountingMode;
  hold?: { minAngle: number; maxAngle: number; minHoldMs: number; maxDriftDeg: number };
  form: readonly FormRuleId[];
  cue: { start: string; working: string; peak: string; lost: string };
};

const SPECS: Record<PatternId, PatternSpec> = {
  squat: {
    id: 'squat', label: 'Squat', camera: 'side',
    joints: { left: [LM.leftHip, LM.leftKnee, LM.leftAnkle], right: [LM.rightHip, LM.rightKnee, LM.rightAnkle] },
    startAngle: 172, peakAngle: 95, startThreshold: 0.15, peakThreshold: 0.85,
    minRom: 55, minRepMs: 500, maxRepMs: 8000, dwellMs: 80, visibility: 0.6, mode: 'bilateral',
    form: ['knee_valgus'], cue: {
      start: 'Stand tall with hips, knees and ankles in view.',
      working: 'Lower under control.',
      peak: 'Reach a comfortable depth, then stand.',
      lost: 'Move so hip, knee and ankle stay visible.',
    },
  },
  squat_hold: {
    id: 'squat_hold', label: 'Wall sit', camera: 'side',
    joints: { left: [LM.leftHip, LM.leftKnee, LM.leftAnkle], right: [LM.rightHip, LM.rightKnee, LM.rightAnkle] },
    startAngle: 172, peakAngle: 95, startThreshold: 0.2, peakThreshold: 0.8,
    minRom: 40, minRepMs: 500, maxRepMs: 8000, dwellMs: 80, visibility: 0.6, mode: 'hold',
    hold: { minAngle: 80, maxAngle: 115, minHoldMs: 5000, maxDriftDeg: 12 },
    form: [], cue: {
      start: 'Set up side-on with hip, knee and ankle visible.',
      working: 'Hold the seated position.',
      peak: 'Hold steady; the timer runs while the angle stays in range.',
      lost: 'Move so hip, knee and ankle stay visible.',
    },
  },
  lunge: {
    id: 'lunge', label: 'Lunge', camera: 'side',
    joints: { left: [LM.leftHip, LM.leftKnee, LM.leftAnkle], right: [LM.rightHip, LM.rightKnee, LM.rightAnkle] },
    startAngle: 172, peakAngle: 95, startThreshold: 0.15, peakThreshold: 0.82,
    minRom: 50, minRepMs: 500, maxRepMs: 9000, dwellMs: 80, visibility: 0.6, mode: 'per_side',
    form: ['knee_over_toe'], cue: {
      start: 'Stand side-on with both legs visible.',
      working: 'Step and lower under control.',
      peak: 'Front knee bent, torso tall.',
      lost: 'Move so both hip, knee and ankle lines stay visible.',
    },
  },
  hinge: {
    id: 'hinge', label: 'Hip hinge', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftHip, LM.leftKnee], right: [LM.rightShoulder, LM.rightHip, LM.rightKnee] },
    startAngle: 172, peakAngle: 95, startThreshold: 0.18, peakThreshold: 0.85,
    minRom: 40, minRepMs: 600, maxRepMs: 10000, dwellMs: 80, visibility: 0.6, mode: 'bilateral',
    form: ['spine_neutral'], cue: {
      start: 'Stand side-on, shoulders and hips visible.',
      working: 'Push the hips back; keep the spine long.',
      peak: 'Feel the hamstrings, then stand.',
      lost: 'Move so shoulder, hip and knee stay visible.',
    },
  },
  hip_thrust: {
    id: 'hip_thrust', label: 'Hip extension', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftHip, LM.leftKnee], right: [LM.rightShoulder, LM.rightHip, LM.rightKnee] },
    startAngle: 100, peakAngle: 165, startThreshold: 0.2, peakThreshold: 0.82,
    minRom: 35, minRepMs: 500, maxRepMs: 9000, dwellMs: 80, visibility: 0.6, mode: 'bilateral',
    form: [], cue: {
      start: 'Lie or sit side-on with shoulder, hip and knee visible.',
      working: 'Drive the hips up.',
      peak: 'Squeeze at the top without arching the lower back.',
      lost: 'Move so shoulder, hip and knee stay visible.',
    },
  },
  horizontal_push: {
    id: 'horizontal_push', label: 'Horizontal push', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 170, peakAngle: 85, startThreshold: 0.15, peakThreshold: 0.85,
    minRom: 45, minRepMs: 400, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'bilateral',
    form: ['body_line'], cue: {
      start: 'Set up side-on with shoulder, elbow and wrist visible.',
      working: 'Lower with the body in one line.',
      peak: 'Chest near the bottom, then press.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  vertical_push: {
    id: 'vertical_push', label: 'Overhead press', camera: 'front',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 70, peakAngle: 165, startThreshold: 0.15, peakThreshold: 0.85,
    minRom: 45, minRepMs: 500, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'bilateral',
    form: ['torso_swing'], cue: {
      start: 'Face the camera with shoulders, elbows and wrists visible.',
      working: 'Press overhead without leaning back.',
      peak: 'Arms long, ribs down, then lower.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  dip: {
    id: 'dip', label: 'Dip', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 172, peakAngle: 85, startThreshold: 0.15, peakThreshold: 0.85,
    minRom: 45, minRepMs: 500, maxRepMs: 9000, dwellMs: 80, visibility: 0.55, mode: 'bilateral',
    form: [], cue: {
      start: 'Set up side-on with shoulders, elbows and wrists visible.',
      working: 'Lower under control.',
      peak: 'Reach a comfortable depth, then press.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  curl: {
    id: 'curl', label: 'Elbow curl', camera: 'front',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 165, peakAngle: 45, startThreshold: 0.18, peakThreshold: 0.85,
    minRom: 45, minRepMs: 400, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'per_side',
    form: ['torso_swing'], cue: {
      start: 'Face the camera with shoulders, elbows and wrists visible.',
      working: 'Curl without swinging the torso.',
      peak: 'Squeeze, then lower under control.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  triceps_extension: {
    id: 'triceps_extension', label: 'Elbow extension', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 50, peakAngle: 165, startThreshold: 0.18, peakThreshold: 0.85,
    minRom: 45, minRepMs: 400, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'per_side',
    form: [], cue: {
      start: 'Set up so shoulder, elbow and wrist are visible.',
      working: 'Extend the elbow without moving the upper arm.',
      peak: 'Finish long, then return under control.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  horizontal_pull: {
    id: 'horizontal_pull', label: 'Horizontal pull', camera: 'front',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 165, peakAngle: 55, startThreshold: 0.18, peakThreshold: 0.82,
    minRom: 40, minRepMs: 500, maxRepMs: 9000, dwellMs: 80, visibility: 0.55, mode: 'bilateral',
    form: ['torso_swing'], cue: {
      start: 'Face the camera with shoulders, elbows and wrists visible.',
      working: 'Pull without leaning back.',
      peak: 'Squeeze the shoulder blades, then release.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  vertical_pull: {
    id: 'vertical_pull', label: 'Vertical pull', camera: 'front',
    joints: { left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist], right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist] },
    startAngle: 170, peakAngle: 40, startThreshold: 0.18, peakThreshold: 0.82,
    minRom: 45, minRepMs: 500, maxRepMs: 9000, dwellMs: 80, visibility: 0.55, mode: 'bilateral',
    form: ['torso_swing'], cue: {
      start: 'Keep hands and elbows in view, body still.',
      working: 'Pull with the elbows, not the torso.',
      peak: 'Full contraction, then lower under control.',
      lost: 'Move so shoulder, elbow and wrist stay visible.',
    },
  },
  lateral_raise: {
    id: 'lateral_raise', label: 'Lateral raise', camera: 'front',
    joints: { left: [LM.leftHip, LM.leftShoulder, LM.leftElbow], right: [LM.rightHip, LM.rightShoulder, LM.rightElbow] },
    startAngle: 12, peakAngle: 88, startThreshold: 0.18, peakThreshold: 0.8,
    minRom: 35, minRepMs: 500, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'per_side',
    form: ['torso_swing'], cue: {
      start: 'Face the camera with arms at your sides.',
      working: 'Raise out to the side without shrugging.',
      peak: 'About shoulder height, then lower.',
      lost: 'Move so hip, shoulder and elbow stay visible.',
    },
  },
  front_raise: {
    id: 'front_raise', label: 'Front raise', camera: 'side',
    joints: { left: [LM.leftHip, LM.leftShoulder, LM.leftElbow], right: [LM.rightHip, LM.rightShoulder, LM.rightElbow] },
    startAngle: 12, peakAngle: 85, startThreshold: 0.18, peakThreshold: 0.8,
    minRom: 35, minRepMs: 500, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'per_side',
    form: ['torso_swing'], cue: {
      start: 'Stand side-on with arms down.',
      working: 'Raise forward without leaning back.',
      peak: 'About shoulder height, then lower.',
      lost: 'Move so hip, shoulder and elbow stay visible.',
    },
  },
  calf_raise: {
    id: 'calf_raise', label: 'Calf raise', camera: 'side',
    joints: { left: [LM.leftKnee, LM.leftAnkle, LM.leftFootIndex], right: [LM.rightKnee, LM.rightAnkle, LM.rightFootIndex] },
    startAngle: 110, peakAngle: 140, startThreshold: 0.2, peakThreshold: 0.8,
    minRom: 15, minRepMs: 400, maxRepMs: 6000, dwellMs: 80, visibility: 0.5, mode: 'bilateral',
    form: [], cue: {
      start: 'Stand side-on with knee, ankle and foot visible.',
      working: 'Rise onto the balls of the feet.',
      peak: 'Pause at the top, then lower slowly.',
      lost: 'Move so knee, ankle and foot stay visible.',
    },
  },
  core_flexion: {
    id: 'core_flexion', label: 'Core flexion', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftHip, LM.leftKnee], right: [LM.rightShoulder, LM.rightHip, LM.rightKnee] },
    startAngle: 168, peakAngle: 100, startThreshold: 0.18, peakThreshold: 0.8,
    minRom: 30, minRepMs: 500, maxRepMs: 8000, dwellMs: 80, visibility: 0.55, mode: 'bilateral',
    form: [], cue: {
      start: 'Set up side-on with shoulder, hip and knee visible.',
      working: 'Curl the ribs toward the hips.',
      peak: 'Squeeze, then lower under control.',
      lost: 'Move so shoulder, hip and knee stay visible.',
    },
  },
  core_isometric: {
    id: 'core_isometric', label: 'Core hold', camera: 'side',
    joints: { left: [LM.leftShoulder, LM.leftHip, LM.leftAnkle], right: [LM.rightShoulder, LM.rightHip, LM.rightAnkle] },
    startAngle: 178, peakAngle: 165, startThreshold: 0.2, peakThreshold: 0.8,
    minRom: 0, minRepMs: 0, maxRepMs: 0, dwellMs: 0, visibility: 0.55, mode: 'hold',
    hold: { minAngle: 155, maxAngle: 200, minHoldMs: 5000, maxDriftDeg: 10 },
    form: ['body_line'], cue: {
      start: 'Set up side-on with shoulder, hip and ankle visible.',
      working: 'Hold a straight line from ear to ankle.',
      peak: 'Breathe steadily; the timer runs while the line holds.',
      lost: 'Move so shoulder, hip and ankle stay visible.',
    },
  },
  jumping_jack: {
    id: 'jumping_jack', label: 'Jumping jack', camera: 'front',
    joints: { left: [LM.leftHip, LM.leftShoulder, LM.leftElbow], right: [LM.rightHip, LM.rightShoulder, LM.rightElbow] },
    startAngle: 15, peakAngle: 150, startThreshold: 0.2, peakThreshold: 0.8,
    minRom: 60, minRepMs: 250, maxRepMs: 3000, dwellMs: 60, visibility: 0.5, mode: 'per_side',
    form: [], cue: {
      start: 'Face the camera with your whole body in view.',
      working: 'Sweep the arms up as the feet travel out.',
      peak: 'Arms overhead, then return.',
      lost: 'Step back so your arms and legs stay visible.',
    },
  },
  mountain_climber: {
    id: 'mountain_climber', label: 'Mountain climber', camera: 'side',
    joints: { left: [LM.leftHip, LM.leftKnee, LM.leftAnkle], right: [LM.rightHip, LM.rightKnee, LM.rightAnkle] },
    startAngle: 170, peakAngle: 95, startThreshold: 0.2, peakThreshold: 0.78,
    minRom: 45, minRepMs: 250, maxRepMs: 3000, dwellMs: 60, visibility: 0.5, mode: 'per_side',
    form: [], cue: {
      start: 'Set up side-on with hips, knees and ankles visible.',
      working: 'Drive one knee toward the chest.',
      peak: 'Switch sides at a steady rhythm.',
      lost: 'Move so hip, knee and ankle stay visible.',
    },
  },
  high_knees: {
    id: 'high_knees', label: 'High knees', camera: 'side',
    joints: { left: [LM.leftHip, LM.leftKnee, LM.leftAnkle], right: [LM.rightHip, LM.rightKnee, LM.rightAnkle] },
    startAngle: 172, peakAngle: 80, startThreshold: 0.2, peakThreshold: 0.78,
    minRom: 55, minRepMs: 250, maxRepMs: 3000, dwellMs: 60, visibility: 0.5, mode: 'per_side',
    form: [], cue: {
      start: 'Stand side-on with hips, knees and ankles visible.',
      working: 'Drive the knee up.',
      peak: 'Alternate sides at a steady rhythm.',
      lost: 'Step back so hip, knee and ankle stay visible.',
    },
  },
};

export const PATTERN_IDS = Object.keys(SPECS) as PatternId[];
export function patternSpec(id: PatternId): PatternSpec {
  return SPECS[id];
}
export function isPatternId(value: unknown): value is PatternId {
  return typeof value === 'string' && value in SPECS;
}

const finite = (value: unknown, fallback: number, low: number, high: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;

/**
 * Merge a catalog-derived override into the family spec. Numeric values are
 * clamped to conservative bounds so malformed data cannot produce a counter
 * that fires on every frame. Holds keep their hold mode and joint triplets.
 */
export function resolvePatternSpec(id: PatternId, override?: ExerciseConfigOverride | null): PatternSpec {
  const base = patternSpec(id);
  if (!override) return base;
  const maxRepMs = finite(override.maxRepMs, base.maxRepMs, 1000, 30000);
  const minRepMs = finite(override.minRepMs, base.minRepMs, 200, Math.max(200, maxRepMs - 100));
  const spec: PatternSpec = {
    ...base,
    mode: base.mode === 'hold' ? 'hold' : override.mode === 'per_side' ? 'per_side' : 'bilateral',
    camera: override.view === 'front' || override.view === 'side' ? override.view : base.camera,
    visibility: finite(override.visibility, base.visibility, 0.2, 0.9),
    minRom: finite(override.minRom, base.minRom, 5, 120),
    minRepMs,
    maxRepMs,
    dwellMs: finite(override.dwellMs, base.dwellMs, 0, 500),
  };
  if (base.hold) {
    spec.hold = {
      ...base.hold,
      minHoldMs: finite(override.hold?.minHoldMs, base.hold.minHoldMs, 1000, 600000),
      maxDriftDeg: finite(override.hold?.maxDriftDeg, base.hold.maxDriftDeg, 2, 45),
    };
  }
  return spec;
}

export type FormFault = { rule: FormRuleId; message: string };
export type Phase = 'waiting' | 'start' | 'working' | 'peak' | 'returning' | 'lost' | 'holding';

export type EngineSnapshot = {
  patternId: PatternId;
  reps: number;
  leftReps: number;
  rightReps: number;
  partials: number;
  phase: Phase;
  /** Progress of the current repetition, 0..1. */
  progress: number;
  /** Smoothed angle of the measured side, degrees. */
  angle: number | null;
  /** Observed excursion of the current/last repetition, degrees. */
  rom: number;
  /** Longest continuous hold observed, milliseconds (hold patterns). */
  holdMs: number;
  /** Completed holds that met the minimum duration (hold patterns). */
  holds: number;
  visible: boolean;
  cue: string;
  faults: FormFault[];
  /** True only on the update that counted a repetition/hold. */
  counted: boolean;
};

/**
 * Per-exercise adjustments generated from catalog metadata (name, equipment,
 * body position). These change thresholds within safe bounds; they are not
 * validation evidence and cannot change the measured joints or invent a pattern.
 */
export type ExerciseConfigOverride = {
  /** Independent side counting for unilateral/alternating catalog entries. */
  mode?: 'bilateral' | 'per_side';
  view?: CameraView;
  visibility?: number;
  minRom?: number;
  minRepMs?: number;
  maxRepMs?: number;
  dwellMs?: number;
  hold?: { minHoldMs?: number; maxDriftDeg?: number };
};

export type CounterOptions = {
  /** Camera view actually in use; form rules that need another view are skipped. */
  view?: CameraView;
  /** Override the visibility threshold (e.g. uploaded video with small subjects). */
  visibility?: number;
  /** EMA smoothing factor, 0..1. Higher reacts faster. */
  smoothing?: number;
  /** Per-exercise catalog-derived adjustments. */
  override?: ExerciseConfigOverride;
};

type SideState = {
  phase: Phase;
  smoothed: number | null;
  lastAngle: number | null;
  lastRom: number;
  armed: boolean;
  repStartAt: number;
  peakSince: number;
  peakReached: boolean;
  minAngle: number;
  maxAngle: number;
  lastTimestamp: number;
  lostSince: number;
};

const freshSide = (): SideState => ({
  phase: 'waiting', smoothed: null, lastAngle: null, lastRom: 0, armed: false, repStartAt: 0, peakSince: 0,
  peakReached: false, minAngle: Infinity, maxAngle: -Infinity, lastTimestamp: -Infinity, lostSince: 0,
});

function visibilityOf(landmark: Landmark | undefined, floor: number) {
  if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return false;
  const visibility = landmark.visibility ?? 1;
  const presence = landmark.presence ?? 1;
  return visibility >= floor && presence >= floor;
}

/**
 * Joint angle in degrees. x is multiplied by the frame aspect so the angle is
 * measured in square pixels; without this, portrait video biases every angle.
 */
export function jointAngle(frame: Pick<PoseFrame, 'landmarks' | 'aspect'>, indices: readonly [number, number, number], minimumVisibility = 0.5): number | null {
  const [ia, ib, ic] = indices;
  const a = frame.landmarks[ia], b = frame.landmarks[ib], c = frame.landmarks[ic];
  if (!visibilityOf(a, minimumVisibility) || !visibilityOf(b, minimumVisibility) || !visibilityOf(c, minimumVisibility)) return null;
  if (!(frame.aspect > 0) || !Number.isFinite(frame.aspect)) return null;
  const ax = (a.x - b.x) * frame.aspect, ay = a.y - b.y;
  const cx = (c.x - b.x) * frame.aspect, cy = c.y - b.y;
  const lengths = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (!(lengths > 1e-6)) return null;
  const cosine = Math.max(-1, Math.min(1, (ax * cx + ay * cy) / lengths));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function sideScore(frame: PoseFrame, spec: PatternSpec, side: 'left' | 'right', floor: number) {
  const indices = spec.joints[side];
  const score = indices.reduce((total, index) => total + (frame.landmarks[index]?.visibility ?? 0), 0);
  return visibilityOf(frame.landmarks[indices[1]], floor) ? score / indices.length : -1;
}

function progressOf(spec: PatternSpec, angle: number) {
  const span = spec.peakAngle - spec.startAngle;
  if (span === 0) return 0;
  return Math.max(0, Math.min(1, (angle - spec.startAngle) / span));
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Landmark-verifiable form screening. Never a safety assessment. */
export function screenForm(
  spec: PatternSpec,
  frame: PoseFrame,
  view: CameraView,
  minimumVisibility: number,
): FormFault[] {
  const faults: FormFault[] = [];
  const lm = frame.landmarks;
  const has = (...indices: number[]) => indices.every(index => visibilityOf(lm[index], minimumVisibility));

  if (spec.form.includes('body_line') && view === 'side') {
    for (const [s, h, a] of [[LM.leftShoulder, LM.leftHip, LM.leftAnkle], [LM.rightShoulder, LM.rightHip, LM.rightAnkle]] as const) {
      if (!has(s, h, a)) continue;
      const line = jointAngle(frame, [s, h, a], minimumVisibility);
      if (line !== null && line < 155) {
        faults.push({ rule: 'body_line', message: 'Hips are not in line with the shoulders and ankles.' });
        break;
      }
    }
  }

  if (spec.form.includes('spine_neutral') && view === 'side') {
    for (const [e, s, h] of [[LM.leftEar, LM.leftShoulder, LM.leftHip], [LM.rightEar, LM.rightShoulder, LM.rightHip]] as const) {
      if (!has(e, s, h)) continue;
      const line = jointAngle(frame, [e, s, h], minimumVisibility);
      if (line !== null && line < 150) {
        faults.push({ rule: 'spine_neutral', message: 'Head and shoulders are drifting ahead of the hips; keep the spine long.' });
        break;
      }
    }
  }

  if (spec.form.includes('knee_valgus') && view === 'front') {
    for (const side of ['left', 'right'] as const) {
      const hip = side === 'left' ? LM.leftHip : LM.rightHip;
      const knee = side === 'left' ? LM.leftKnee : LM.rightKnee;
      const ankle = side === 'left' ? LM.leftAnkle : LM.rightAnkle;
      if (!has(hip, knee, ankle)) continue;
      const inward = side === 'left' ? lm[knee].x - lm[ankle].x : lm[ankle].x - lm[knee].x;
      if (inward > 0.045) {
        faults.push({ rule: 'knee_valgus', message: `The ${side} knee is tracking inward; push it out over the foot.` });
        break;
      }
    }
  }

  if (spec.form.includes('knee_over_toe') && view === 'side') {
    for (const side of ['left', 'right'] as const) {
      const knee = side === 'left' ? LM.leftKnee : LM.rightKnee;
      const toe = side === 'left' ? LM.leftFootIndex : LM.rightFootIndex;
      if (!has(knee, toe)) continue;
      if (lm[knee].x - lm[toe].x > 0.08) {
        faults.push({ rule: 'knee_over_toe', message: 'The front knee is travelling well past the toes.' });
        break;
      }
    }
  }

  if (spec.form.includes('torso_swing') && (view === 'front' || view === 'side')) {
    for (const [s, h] of [[LM.leftShoulder, LM.leftHip], [LM.rightShoulder, LM.rightHip]] as const) {
      if (!has(s, h)) continue;
      const lean = Math.abs(lm[s].x - lm[h].x) * frame.aspect;
      const height = Math.abs(lm[s].y - lm[h].y);
      if (height > 1e-6 && lean / height > 0.28) {
        faults.push({ rule: 'torso_swing', message: 'The torso is swinging; brace the trunk and move the working joint only.' });
        break;
      }
    }
  }

  return faults;
}

class PatternCounter {
  private readonly spec: PatternSpec;
  private readonly view: CameraView;
  private readonly visibility: number;
  private readonly smoothing: number;
  private readonly sides: Record<'left' | 'right', SideState> = { left: freshSide(), right: freshSide() };
  private reps = 0;
  private leftReps = 0;
  private rightReps = 0;
  private partials = 0;
  private holdMs = 0;
  private lastHoldMs = 0;
  private longestHoldMs = 0;
  private holds = 0;
  private holdingSince = -1;
  private holdStartAngle = 0;
  private lastTimestamp = -Infinity;
  private faults: FormFault[] = [];

  constructor(spec: PatternSpec, options: CounterOptions = {}) {
    const resolved = resolvePatternSpec(spec.id, options.override);
    this.spec = resolved;
    this.view = options.view ?? resolved.camera;
    this.visibility = options.visibility ?? resolved.visibility;
    this.smoothing = clamp(options.smoothing ?? 0.4, 0.05, 1);
  }

  reset() {
    this.sides.left = freshSide();
    this.sides.right = freshSide();
    this.reps = 0;
    this.leftReps = 0;
    this.rightReps = 0;
    this.partials = 0;
    this.holdMs = 0;
    this.lastHoldMs = 0;
    this.longestHoldMs = 0;
    this.holds = 0;
    this.holdingSince = -1;
    this.lastTimestamp = -Infinity;
    this.faults = [];
  }

  private sideSnapshot(side: SideState, angle: number | null): EngineSnapshot {
    const span = Math.abs(this.spec.peakAngle - this.spec.startAngle) || 1;
    const rom = side.repStartAt > 0
      ? Math.round((side.maxAngle - side.minAngle) * 10) / 10
      : side.lastRom;
    const progress = angle === null ? 0 : progressOf(this.spec, angle);
    const visible = side.phase !== 'lost' && angle !== null;
    const cue = !visible ? this.spec.cue.lost
      : side.phase === 'peak' ? this.spec.cue.peak
        : side.phase === 'start' ? this.spec.cue.start
          : this.spec.cue.working;
    return {
      patternId: this.spec.id, reps: this.reps, leftReps: this.leftReps, rightReps: this.rightReps,
      partials: this.partials, phase: side.phase, progress, angle: angle === null ? null : Math.round(angle * 10) / 10,
      rom: clamp(rom, 0, span * 2), holdMs: this.holdingSince >= 0 ? this.holdMs : this.lastHoldMs, holds: this.holds, visible, cue,
      faults: this.faults, counted: false,
    };
  }

  update(frame: PoseFrame): EngineSnapshot {
    const faults = screenForm(this.spec, frame, this.view, this.visibility);
    this.faults = faults;
    const ts = frame.timestamp;
    if (!Number.isFinite(ts) || ts <= this.lastTimestamp) {
      return { ...this.primarySnapshot(frame), faults };
    }
    if (this.spec.mode === 'hold') return { ...this.updateHold(frame, ts), faults };

    const countedBefore = this.reps;
    const leftAngle = jointAngle(frame, this.spec.joints.left, this.visibility);
    const rightAngle = jointAngle(frame, this.spec.joints.right, this.visibility);

    if (this.spec.mode === 'per_side') {
      this.stepSide('left', leftAngle, ts);
      this.stepSide('right', rightAngle, ts);
    } else {
      // Bilateral: one movement shared by both sides. Measure the side with the
      // better visibility, but only choose while a repetition has not started.
      const leftScore = sideScore(frame, this.spec, 'left', this.visibility);
      const rightScore = sideScore(frame, this.spec, 'right', this.visibility);
      const chosen: 'left' | 'right' = (this.sides.left.armed || this.sides.left.repStartAt > 0 || leftScore >= rightScore) ? 'left' : 'right';
      const other: 'left' | 'right' = chosen === 'left' ? 'right' : 'left';
      const angle = chosen === 'left' ? leftAngle : rightAngle;
      this.stepSide(chosen, angle, ts);
      // Keep the untracked side from firing a duplicate rep when it becomes visible.
      const otherState = this.sides[other];
      otherState.armed = false;
      otherState.peakReached = false;
      otherState.repStartAt = 0;
    }
    this.lastTimestamp = ts;
    const snapshot = this.primarySnapshot(frame);
    return { ...snapshot, faults, counted: this.reps > countedBefore };
  }

  private primarySnapshot(frame: PoseFrame): EngineSnapshot {
    const left = this.sides.left, right = this.sides.right;
    if (this.spec.mode === 'per_side') {
      // Report the side that is actually working, not whichever triplet is
      // first in the array.
      const rank = (side: SideState) => side.phase === 'peak' ? 4 : side.phase === 'working' ? 3 : side.phase === 'returning' ? 2 : side.phase === 'start' ? 1 : 0;
      const side = rank(right) > rank(left) ? right : left;
      const angle = side.lastAngle ?? jointAngle(frame, this.spec.joints[side === left ? 'left' : 'right'], this.visibility);
      return this.sideSnapshot(side, angle);
    }
    // Bilateral patterns only ever step the left state; never borrow the other
    // side's visibility, or a lost body would still look tracked.
    const angle = jointAngle(frame, this.spec.joints.left, this.visibility);
    return this.sideSnapshot(left, angle);
  }

  private stepSide(name: 'left' | 'right', angle: number | null, ts: number) {
    const state = this.sides[name];
    if (angle === null) {
      if (state.lostSince === 0) state.lostSince = ts;
      if (ts - state.lostSince >= 600) {
        state.phase = 'lost';
        state.armed = false;
        state.peakReached = false;
        state.repStartAt = 0;
        state.smoothed = null;
      }
      state.lastTimestamp = ts;
      return;
    }
    state.lostSince = 0;
    if (ts - state.lastTimestamp > 1500) {
      state.armed = false; state.peakReached = false; state.repStartAt = 0;
      state.minAngle = Infinity; state.maxAngle = -Infinity; state.smoothed = null;
    }
    state.lastTimestamp = ts;
    // State transitions use the raw angle so live (≈15 fps) and uploaded
    // (10 fps) sampling do not change the count; smoothing is display-only.
    state.lastAngle = angle;
    state.smoothed = state.smoothed === null ? angle : state.smoothed * (1 - this.smoothing) + angle * this.smoothing;
    const smoothed = state.smoothed;
    state.minAngle = Math.min(state.minAngle, angle);
    state.maxAngle = Math.max(state.maxAngle, angle);
    const progress = progressOf(this.spec, angle);

    if (progress <= this.spec.startThreshold) {
      if (!state.armed) {
        state.armed = true;
        state.repStartAt = 0;
        state.peakReached = false;
        state.peakSince = 0;
        state.minAngle = angle;
        state.maxAngle = angle;
      }
      if (state.peakReached && state.repStartAt > 0) {
        const duration = ts - state.repStartAt;
        const rom = state.maxAngle - state.minAngle;
        if (duration >= this.spec.minRepMs && duration <= this.spec.maxRepMs && rom >= this.spec.minRom) {
          this.reps += 1;
          if (name === 'left') this.leftReps += 1; else this.rightReps += 1;
          state.phase = 'start';
          state.lastRom = Math.round(rom * 10) / 10;
        } else if (rom >= this.spec.minRom * 0.4) {
          this.partials += 1;
          state.phase = 'start';
        }
        state.peakReached = false;
        state.repStartAt = 0;
        state.minAngle = angle;
        state.maxAngle = angle;
        return;
      }
      state.phase = 'start';
      return;
    }

    if (!state.armed) {
      state.phase = 'waiting';
      return;
    }
    if (state.repStartAt === 0) {
      state.repStartAt = ts;
      state.minAngle = angle;
      state.maxAngle = angle;
    }
    if (progress >= this.spec.peakThreshold) {
      if (state.peakSince === 0) state.peakSince = ts;
      if (!state.peakReached && ts - state.peakSince >= this.spec.dwellMs) {
        state.peakReached = true;
        state.phase = 'peak';
      }
    } else {
      state.peakSince = 0;
      if (state.phase !== 'peak') state.phase = progress > 0.5 ? 'working' : 'returning';
    }
  }

  private updateHold(frame: PoseFrame, ts: number): EngineSnapshot {
    const spec = this.spec, hold = spec.hold!;
    const left = jointAngle(frame, spec.joints.left, this.visibility);
    const right = jointAngle(frame, spec.joints.right, this.visibility);
    this.lastTimestamp = ts;
    const angle = left ?? right;
    if (angle === null) {
      if (this.holdingSince >= 0) this.finishHold();
      this.sides.left.phase = 'lost';
      return this.holdSnapshot(null);
    }
    const inZone = angle >= hold.minAngle && angle <= hold.maxAngle;
    if (!inZone) {
      if (this.holdingSince >= 0) this.finishHold();
      this.sides.left.phase = 'start';
      this.holdStartAngle = angle;
      return this.holdSnapshot(angle);
    }
    if (this.holdingSince < 0) {
      this.holdingSince = ts;
      this.holdStartAngle = angle;
    } else if (Math.abs(angle - this.holdStartAngle) > hold.maxDriftDeg) {
      // Drift beyond tolerance breaks the hold; restart the count from here.
      this.finishHold();
      this.holdingSince = ts;
      this.holdMs = 0;
      this.holdStartAngle = angle;
    }
    this.holdMs = ts - this.holdingSince;
    this.lastHoldMs = 0;
    this.longestHoldMs = Math.max(this.longestHoldMs, this.holdMs);
    this.sides.left.phase = 'holding';
    return this.holdSnapshot(angle);
  }

  private finishHold() {
    const spec = this.spec, hold = spec.hold!;
    if (this.holdMs >= hold.minHoldMs) {
      this.holds += 1;
      this.reps += 1;
    }
    this.lastHoldMs = this.holdMs;
    this.holdMs = 0;
    this.holdingSince = -1;
    this.sides.left.phase = 'start';
  }

  /** Close an open hold at the end of a recording. Live sessions never need this. */
  finish() {
    if (this.spec.mode === 'hold' && this.holdingSince >= 0) this.finishHold();
  }

  private holdSnapshot(angle: number | null): EngineSnapshot {
    const hold = this.spec.hold!;
    const holding = this.sides.left.phase === 'holding';
    return {
      patternId: this.spec.id, reps: this.reps, leftReps: 0, rightReps: 0, partials: this.partials,
      phase: holding ? 'holding' : this.sides.left.phase, progress: angle === null ? 0 : clamp(angle / Math.max(hold.maxAngle, 1), 0, 1),
      angle: angle === null ? null : Math.round(angle * 10) / 10, rom: 0,
      holdMs: this.holdingSince >= 0 ? this.holdMs : this.lastHoldMs, holds: this.holds, visible: angle !== null,
      cue: angle === null ? this.spec.cue.lost : holding ? this.spec.cue.peak : this.spec.cue.start,
      faults: this.faults, counted: false,
    };
  }

  /** Snapshot without a new frame (used after finish() and by the public API). */
  summary(): EngineSnapshot {
    if (this.spec.mode === 'hold') return this.holdSnapshot(this.sides.left.lastAngle);
    const rank = (side: SideState) => side.phase === 'peak' ? 4 : side.phase === 'working' ? 3 : side.phase === 'returning' ? 2 : side.phase === 'start' ? 1 : 0;
    const side = this.spec.mode === 'per_side' && rank(this.sides.right) > rank(this.sides.left) ? this.sides.right : this.sides.left;
    return this.sideSnapshot(side, side.lastAngle);
  }
}

export type ExerciseCounter = {
  readonly patternId: PatternId;
  update(frame: PoseFrame): EngineSnapshot;
  snapshot(): EngineSnapshot;
  /** Finalise an unfinished hold (video recordings only; safe to call once). */
  finish(): void;
  reset(): void;
};

export function createExerciseCounter(patternId: PatternId, options: CounterOptions = {}): ExerciseCounter {
  const spec = patternSpec(patternId);
  const counter = new PatternCounter(spec, options);
  let last: EngineSnapshot = {
    patternId, reps: 0, leftReps: 0, rightReps: 0, partials: 0, phase: 'waiting', progress: 0,
    angle: null, rom: 0, holdMs: 0, holds: 0, visible: false, cue: spec.cue.start, faults: [], counted: false,
  };
  return {
    patternId,
    update(frame) { last = counter.update(frame); return last; },
    snapshot() { return counter.summary(); },
    finish() { counter.finish(); },
    reset() { counter.reset(); last = { ...last, reps: 0, leftReps: 0, rightReps: 0, partials: 0, phase: 'waiting', progress: 0, rom: 0, holdMs: 0, holds: 0, counted: false }; },
  };
}

/**
 * Compare live and uploaded processing on the same landmark sequence.
 * Differences must come only from sampling, not from divergent logic.
 */
export function analyzeSequence(
  patternId: PatternId,
  frames: readonly PoseFrame[],
  options: CounterOptions = {},
) {
  const counter = createExerciseCounter(patternId, options);
  let counted = 0, peakAngle = -Infinity, minAngle = Infinity, lastPhase: Phase = 'waiting';
  const transitions: Array<{ timestamp: number; from: Phase; to: Phase }> = [];
  const faults = new Set<FormRuleId>();
  for (const frame of frames) {
    const result = counter.update(frame);
    for (const fault of result.faults) faults.add(fault.rule);
    if (result.counted) counted += 1;
    if (result.angle !== null) {
      peakAngle = Math.max(peakAngle, result.angle);
      minAngle = Math.min(minAngle, result.angle);
    }
    if (result.phase !== lastPhase) {
      transitions.push({ timestamp: frame.timestamp, from: lastPhase, to: result.phase });
      lastPhase = result.phase;
    }
  }
  counter.finish();
  const final = counter.snapshot();
  return {
    ...final,
    reps: final.reps,
    counted,
    angleRange: Number.isFinite(minAngle) ? { min: minAngle, max: peakAngle } : null,
    transitions,
    faults: [...faults],
  };
}
