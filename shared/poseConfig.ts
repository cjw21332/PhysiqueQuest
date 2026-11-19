import type { PatternId, PatternSpec } from './exerciseEngine';

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


export const SPECS: Record<PatternId, PatternSpec> = {
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
    minRom: 45, minRepMs: 400, maxRepMs: 8000, dwellMs: 60, visibility: 0.55, mode: 'bilateral',
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


export const TRACKING_FRAME_RATES = { fast: 15, normal: 10, fastDegraded: 10, normalDegraded: 5, slowInferenceMs: 80, preview: 30, readiness: 5, readinessDegraded: 2.5 } as const;
export const FRAME_GUIDANCE = { visibility: 0.4, minHeight: 0.35, maxHeight: 0.95 } as const;
export const POSE_HOLD_MS = 350;
export const DRAW_VISIBILITY = 0.25;
export const CAMERA_CONFIDENCE = 0.35;
export const TRACKING_UI_UPDATE_MS = 200;
export const POSE_CUE_TIMING = { minimumDisplayMs: 1500, repeatSpeechMs: 4000 } as const;
export const GATE_TIMING = { startMs: 3000, flickerMs: 750, lostMs: 3000, countdownSteps: 3, stepMs: 1000 } as const;
export const MIN_DRAW_LANDMARKS = 29;
export const CUE_PRIORITY = { alignment: 3, depth: 2, tempo: 1 } as const;
export const FILTER_RESET_MS = 1500;
export const ENGINE_THRESHOLDS = { lostMs: 3000, kneeValgusTorso: 0.375, kneeToeTorso: 0.667, bodyLineDegrees: 155, spineDegrees: 150, torsoLeanRatio: 0.28 } as const;
export const LANDMARK_FILTER_DEFAULTS = {
  slow: { minCutoff: 1, beta: 0.007 },
  fast: { minCutoff: 1.5, beta: 0.05 },
  derivativeCutoff: 1,
} as const;
