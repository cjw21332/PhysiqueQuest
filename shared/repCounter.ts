export type TrackingKind = 'squat' | 'curl' | 'pushup';
export type TrackingSide = 'left' | 'right';
export type TrackingExercise = { _id: string; name: string; equipment: string; guidance?: string };
export type Joint = { x: number; y: number; visibility?: number; presence?: number };
export type TrackingFrame = { joints: Joint[]; aspect: number; timestamp: number };
export type CounterSnapshot = { reps: number; phase: 'ready' | 'bent' | 'searching'; message: string };

// Independent starter exercises; no external exercise catalog is required.
export const trackingExercises: Record<string, TrackingKind> = {
  'camera-squat': 'squat', 'camera-curl': 'curl',
  'camera-goblet-squat': 'squat', 'camera-sumo-squat': 'squat',
  'camera-hammer-curl': 'curl', 'camera-seated-curl': 'curl', 'camera-pushup': 'pushup',
};
export const trackingPresets: TrackingExercise[] = [
  { _id: 'camera-squat', name: 'Bodyweight squat', equipment: 'Bodyweight' },
  { _id: 'camera-curl', name: 'Standing biceps curl', equipment: 'Dumbbell' },
  { _id: 'camera-goblet-squat', name: 'Goblet squat', equipment: 'Dumbbell', guidance: 'Film from the side with your hip, knee and ankle visible. Keep the weight clear of the tracked leg. Start standing upright.' },
  { _id: 'camera-sumo-squat', name: 'Sumo squat', equipment: 'Bodyweight', guidance: 'Film from the side with your hip, knee and ankle visible. Keep the tracked leg visible in your wider stance. Start standing upright.' },
  { _id: 'camera-hammer-curl', name: 'Hammer curl', equipment: 'Dumbbell', guidance: 'Film from the side with your shoulder, elbow and wrist visible. Keep palms facing inward and start with your arm straight. Count one arm at a time.' },
  { _id: 'camera-seated-curl', name: 'Seated biceps curl', equipment: 'Dumbbell', guidance: 'Sit side-on with your shoulder, elbow and wrist clear of the chair. Start with your arm straight. Count one arm at a time.' },
  { _id: 'camera-pushup', name: 'Push-up', equipment: 'Bodyweight' },
];
export const trackingGuidance = {
  squat: 'Stand side-on with your hip, knee and ankle visible. Start standing upright.',
  curl: 'Stand side-on with your shoulder, elbow and wrist visible. Start with your arm straight. Count one arm at a time.',
  pushup: 'Place the camera level, low and side-on. Keep your shoulder, elbow, wrist, hip and ankle visible. Start at the top of a floor push-up with arms straight and your body in a line. Lower, then return to the top.',
};

// Prototype thresholds shared by similar movements; these do not assess form.
const trackingRules: Record<TrackingKind, { straight: number; bent: number }> = {
  squat: { straight: 155, bent: 105 },
  curl: { straight: 155, bent: 65 },
  pushup: { straight: 155, bent: 100 },
};

export function jointIndices(kind: TrackingKind, side: TrackingSide): number[] {
  if (kind === 'pushup') return side === 'left' ? [11, 13, 15, 23, 27] : [12, 14, 16, 24, 28];
  return kind === 'squat' ? (side === 'left' ? [23, 25, 27] : [24, 26, 28]) : (side === 'left' ? [11, 13, 15] : [12, 14, 16]);
}

export function trackingAngle(frame: TrackingFrame, kind: TrackingKind): number | null {
  if (kind !== 'pushup') return jointAngle(frame);
  if (frame.joints.length !== 5) return null;
  const [shoulder, elbow, wrist, hip, ankle] = frame.joints;
  const elbowAngle = jointAngle({ ...frame, joints: [shoulder, elbow, wrist] });
  if (elbowAngle === null) return null;
  const bodyAngle = jointAngle({ ...frame, joints: [shoulder, hip, ankle] });
  if (bodyAngle === null || bodyAngle < 150) return null;
  const dx = (ankle.x - shoulder.x) * frame.aspect, dy = ankle.y - shoulder.y;
  // A near-horizontal body distinguishes floor push-ups from standing arm bends.
  if (Math.abs(dy) > Math.hypot(dx, dy) * 0.65 || wrist.y <= shoulder.y) return null;
  return elbowAngle;
}

export function jointAngle(frame: TrackingFrame): number | null {
  if (!(frame.aspect > 0) || !Number.isFinite(frame.aspect) || frame.joints.length !== 3) return null;
  if (frame.joints.some(joint => !joint || !Number.isFinite(joint.x) || !Number.isFinite(joint.y) ||
    joint.x < 0 || joint.x > 1 || joint.y < 0 || joint.y > 1 ||
    (joint.visibility ?? 0) < 0.65 || !Number.isFinite(joint.visibility) ||
    (joint.presence !== undefined && (!Number.isFinite(joint.presence) || joint.presence < 0.65)))) return null;
  const [a, b, c] = frame.joints;
  const ax = (a.x - b.x) * frame.aspect, ay = a.y - b.y;
  const cx = (c.x - b.x) * frame.aspect, cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (length < 0.0001) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / length))) * 180 / Math.PI;
}

export function createRepCounter(kind: TrackingKind) {
  const rules = trackingRules[kind];
  let reps = 0;
  let phase: CounterSnapshot['phase'] = 'searching';
  let lastTimestamp = -Infinity;
  let smoothed: number | null = null;
  let candidate: 'straight' | 'bent' | null = null;
  let candidateSince = 0;
  let bentAt = 0;
  const clearMotion = () => { phase = 'searching'; smoothed = null; candidate = null; };
  const snapshot = (): CounterSnapshot => ({ reps, phase, message: phase === 'searching' ? 'Position your selected side in view, then straighten to begin.' : phase === 'ready' ? 'Ready · bend, then straighten for one rep.' : 'Return to the starting position.' });
  return {
    snapshot,
    resetMotion() { clearMotion(); lastTimestamp = -Infinity; return snapshot(); },
    update(frame: TrackingFrame): CounterSnapshot {
      if (!Number.isFinite(frame.timestamp) || frame.timestamp <= lastTimestamp) return snapshot();
      if (frame.timestamp - lastTimestamp > 600) clearMotion();
      lastTimestamp = frame.timestamp;
      const angle = trackingAngle(frame, kind);
      if (angle === null) { clearMotion(); return snapshot(); }
      smoothed = smoothed === null ? angle : smoothed * 0.35 + angle * 0.65;
      const next = smoothed >= rules.straight ? 'straight' : smoothed <= rules.bent ? 'bent' : null;
      if (!next) { candidate = null; return snapshot(); }
      if (next !== candidate) { candidate = next; candidateSince = frame.timestamp; return snapshot(); }
      if (frame.timestamp - candidateSince < 150) return snapshot();
      if (next === 'straight') {
        if (phase === 'bent' && frame.timestamp - bentAt >= 300) reps = Math.min(1000, reps + 1);
        phase = 'ready';
      } else if (phase === 'ready') {
        phase = 'bent'; bentAt = frame.timestamp;
      }
      return snapshot();
    },
  };
}

export type IdentifiedExercise = {
  exerciseId: string;
  trackingPresetId: string;
  name: string;
  equipment: string;
  kind: TrackingKind;
  side: TrackingSide;
  reps: number;
};

/** Conservative movement-family rules, not a trained exercise classifier.
 * Consume the complete landmark frame once; never retain the video or frames.
 */
export function createExerciseIdentifier() {
  const candidates = (['squat', 'curl', 'pushup'] as const).flatMap(kind =>
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
        const indices = jointIndices(candidate.kind, candidate.side);
        let joints = frame.joints.length === 33 ? indices.map(index => frame.joints[index]) : [];
        if (candidate.kind !== 'pushup' && joints.length) {
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
        }
        const selected = { ...frame, joints };
        if (trackingAngle(selected, candidate.kind) !== null) candidate.visible++;
        candidate.counter.update(selected);
      }
    },
    result(): IdentifiedExercise | null {
      const families = (['squat', 'curl', 'pushup'] as const).map(kind =>
        candidates.filter(candidate => candidate.kind === kind).sort((a, b) =>
          b.counter.snapshot().reps - a.counter.snapshot().reps || b.visible - a.visible)[0],
      );
      // Mixed clips and ambiguous competing movement cycles require manual selection.
      const moving = families.filter(candidate => candidate.counter.snapshot().reps > 0);
      if (moving.length !== 1) return null;
      const best = moving[0];
      if (best.visible < 10 || best.visible / frames < 0.5) return null;
      const names = { squat: 'Squat', curl: 'Biceps curl', pushup: 'Push-up' };
      return {
        exerciseId: `movement-${best.kind}`,
        trackingPresetId: best.kind === 'pushup' ? 'camera-pushup' : `camera-${best.kind}`,
        name: names[best.kind], equipment: best.kind === 'pushup' ? 'Bodyweight' : '',
        kind: best.kind, side: best.side, reps: best.counter.snapshot().reps,
      };
    },
  };
}
