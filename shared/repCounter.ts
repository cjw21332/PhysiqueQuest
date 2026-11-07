export type TrackingKind = 'squat' | 'curl';
export type TrackingSide = 'left' | 'right';
export type TrackingExercise = { _id: string; name: string; equipment: string };
export type Joint = { x: number; y: number; visibility?: number; presence?: number };
export type TrackingFrame = { joints: Joint[]; aspect: number; timestamp: number };
export type CounterSnapshot = { reps: number; phase: 'ready' | 'bent' | 'searching'; observation: 'unknown' | 'detected' | 'adjustment'; message: string };
export type MovementSupportTier = 'supported' | 'partially supported' | 'unsupported' | 'requires special setup';

// These thresholds are experimental counting heuristics, not validated form or safety criteria.
export const movementRules = {
  squat: { exerciseId: '6YUfHPL', name: 'Bodyweight squat', support: 'partially supported', camera: 'side-on', landmarks: ['hip', 'knee', 'ankle'], visibility: 0.65, straightAngle: 155, bentAngle: 105, dwellMs: 150, minBentMs: 300, maxGapMs: 600, partialAngle: 145, partialDwellMs: 1000 },
  curl: { exerciseId: 'camera-curl', name: 'Standing biceps curl', support: 'requires special setup', camera: 'side-on', landmarks: ['shoulder', 'elbow', 'wrist'], visibility: 0.65, straightAngle: 155, bentAngle: 65, dwellMs: 150, minBentMs: 300, maxGapMs: 600, partialAngle: 0, partialDwellMs: 1000 },
} as const;
export function movementSupport(exerciseId: string) {
  return exerciseId === movementRules.squat.exerciseId ? movementRules.squat : null;
}
export function movementSupportTier(exerciseId: string): MovementSupportTier {
  if (exerciseId === movementRules.curl.exerciseId) return 'requires special setup';
  return movementSupport(exerciseId)?.support ?? 'unsupported';
}

// Independent starter exercises; no external exercise catalog is required.
export const trackingExercises: Record<string, TrackingKind> = { 'camera-squat': 'squat', 'camera-curl': 'curl' };
export const trackingPresets: TrackingExercise[] = [
  { _id: 'camera-squat', name: 'Bodyweight squat', equipment: 'Bodyweight' },
  { _id: 'camera-curl', name: 'Standing biceps curl', equipment: 'Dumbbell' },
];
export const trackingGuidance = {
  squat: 'Stand side-on with your hip, knee and ankle visible. Start standing upright.',
  curl: 'Stand side-on with your shoulder, elbow and wrist visible. Start with your arm straight. Count one arm at a time.',
};

export function jointIndices(kind: TrackingKind, side: TrackingSide): number[] {
  return kind === 'squat' ? (side === 'left' ? [23, 25, 27] : [24, 26, 28]) : (side === 'left' ? [11, 13, 15] : [12, 14, 16]);
}

export function jointAngle(frame: TrackingFrame, minimumVisibility = 0.65): number | null {
  if (!(frame.aspect > 0) || !Number.isFinite(frame.aspect) || frame.joints.length !== 3) return null;
  if (frame.joints.some(joint => !joint || !Number.isFinite(joint.x) || !Number.isFinite(joint.y) ||
    joint.x < 0 || joint.x > 1 || joint.y < 0 || joint.y > 1 ||
    (joint.visibility ?? 0) < minimumVisibility || !Number.isFinite(joint.visibility) ||
    (joint.presence !== undefined && (!Number.isFinite(joint.presence) || joint.presence < minimumVisibility)))) return null;
  const [a, b, c] = frame.joints;
  const ax = (a.x - b.x) * frame.aspect, ay = a.y - b.y;
  const cx = (c.x - b.x) * frame.aspect, cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (length < 0.0001) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / length))) * 180 / Math.PI;
}

export function createRepCounter(kind: TrackingKind) {
  const rule = movementRules[kind];
  let reps = 0;
  let phase: CounterSnapshot['phase'] = 'searching';
  let lastTimestamp = -Infinity;
  let smoothed: number | null = null;
  let candidate: 'straight' | 'bent' | null = null;
  let candidateSince = 0;
  let bentAt = 0;
  let partialSince: number | null = null;
  let partial = false;
  const clearMotion = () => { phase = 'searching'; smoothed = null; candidate = null; partialSince = null; partial = false; };
  const snapshot = (): CounterSnapshot => ({ reps, phase, observation: phase === 'searching' ? 'unknown' : partial ? 'adjustment' : 'detected', message: phase === 'searching' ? 'Position your selected side in view, then straighten to begin.' : partial ? 'A larger knee bend is needed for this counter. Move only within your comfortable range.' : phase === 'ready' ? 'Ready · bend, then straighten for one rep.' : kind === 'squat' ? 'Knee bend detected. Return to the starting position.' : 'Return to the starting position.' });
  return {
    snapshot,
    resetMotion() { clearMotion(); lastTimestamp = -Infinity; return snapshot(); },
    update(frame: TrackingFrame): CounterSnapshot {
      if (!Number.isFinite(frame.timestamp) || frame.timestamp <= lastTimestamp) return snapshot();
      if (frame.timestamp - lastTimestamp > rule.maxGapMs) clearMotion();
      lastTimestamp = frame.timestamp;
      const angle = jointAngle(frame, rule.visibility);
      if (angle === null) { clearMotion(); return snapshot(); }
      smoothed = smoothed === null ? angle : smoothed * 0.35 + angle * 0.65;
      const next = smoothed >= rule.straightAngle ? 'straight' : smoothed <= rule.bentAngle ? 'bent' : null;
      if (!next) {
        candidate = null;
        if (kind === 'squat' && phase === 'ready' && smoothed < rule.partialAngle) { partialSince ??= frame.timestamp; partial = frame.timestamp - partialSince >= rule.partialDwellMs; }
        else { partialSince = null; partial = false; }
        return snapshot();
      }
      partialSince = null; partial = false;
      if (next !== candidate) { candidate = next; candidateSince = frame.timestamp; return snapshot(); }
      if (frame.timestamp - candidateSince < rule.dwellMs) return snapshot();
      if (next === 'straight') {
        if (phase === 'bent' && frame.timestamp - bentAt >= rule.minBentMs) reps = Math.min(1000, reps + 1);
        phase = 'ready';
      } else if (phase === 'ready') {
        phase = 'bent'; bentAt = frame.timestamp;
      }
      return snapshot();
    },
  };
}
