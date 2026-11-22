/** Display-only telemetry. It never arms, counts, rejects or grades a repetition. */
export type MotionPoint = { x: number; y: number; visibility?: number; presence?: number };
export type MotionPhase = 'ready' | 'move' | 'hold' | 'return' | 'unknown';
export type MotionSample = { timestamp: number; aspect: number; landmarks: readonly MotionPoint[];
  progress: number; visible: boolean; reps: number; partials: number };
export type MotionTiming = { moveMs: number; holdMs: number; returnMs: number };
export type MovementTelemetry = {
  point: { x: number; y: number } | null;
  reference: { x: number; y: number } | null;
  path: readonly { x: number; y: number; timestamp: number }[];
  phase: MotionPhase;
  current: MotionTiming | null;
  last: (MotionTiming & { kind: 'full' | 'partial' }) | null;
};
const emptyTiming = (): MotionTiming => ({ moveMs: 0, holdMs: 0, returnMs: 0 });
const empty = (): MovementTelemetry => ({ point: null, reference: null, path: [], phase: 'unknown', current: null, last: null });

export function movementPhaseLabels(pattern?: string): readonly [string, string, string] {
  if (pattern === 'vertical_pull') return ['Pull', 'Hold', 'Lower'];
  if (pattern === 'horizontal_push' || pattern === 'squat' || pattern === 'lunge' || pattern === 'dip') return ['Lower', 'Pause', 'Rise / press'];
  if (pattern === 'vertical_push') return ['Press', 'Hold', 'Lower'];
  if (pattern === 'curl') return ['Curl', 'Hold', 'Lower'];
  return ['Move', 'Hold', 'Return'];
}

export function createMovementTelemetry(startThreshold = .18, peakThreshold = .82, allowTiming = true) {
  let result = empty(), lastTs: number | null = null, lastVisibleTs: number | null = null;
  let previousProgress: number | null = null, previousCounts: { reps: number; partials: number } | null = null;
  let group = '', stableAt: number | null = null, stablePoint: { x: number; y: number } | null = null;
  let active = false, timing = emptyTiming(), direction: MotionPhase = 'move';
  const reset = () => {
    result = empty(); lastTs = lastVisibleTs = null; previousProgress = null; previousCounts = null;
    group = ''; stableAt = null; stablePoint = null; active = false; timing = emptyTiming(); direction = 'move';
  };
  return {
    reset,
    snapshot: () => result,
    update(sample: MotionSample): MovementTelemetry {
      const ts = sample.timestamp;
      if (!Number.isFinite(ts) || (lastTs !== null && ts <= lastTs)) return result;
      if (!Number.isFinite(sample.aspect) || sample.aspect <= 0) { reset(); return result; }
      const dt = lastTs === null ? 0 : ts - lastTs;
      if (dt > 350) { reset(); }
      lastTs = ts;
      const credible = (index: number) => {
        const p = sample.landmarks[index];
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 &&
          typeof p.visibility === 'number' && Number.isFinite(p.visibility) && p.visibility >= .65 && p.visibility <= 1 &&
          (p.presence === undefined || (Number.isFinite(p.presence) && p.presence >= .65 && p.presence <= 1));
      };
      const indices = [11, 12, 23, 24].every(credible) ? [11, 12, 23, 24] : [11, 12].every(credible) ? [11, 12] : [];
      const nextGroup = indices.length === 4 ? 'torso' : indices.length === 2 ? 'shoulders' : '';
      if (group !== nextGroup) { result = { ...result, reference: null, path: [] }; stableAt = null; stablePoint = null; group = nextGroup; }
      let point: { x: number; y: number } | null = null;
      if (indices.length) {
        point = { x: indices.reduce((sum, i) => sum + sample.landmarks[i].x, 0) / indices.length,
          y: indices.reduce((sum, i) => sum + sample.landmarks[i].y, 0) / indices.length };
        const prior = result.point;
        if (prior && Math.hypot((point.x - prior.x) * sample.aspect, point.y - prior.y) > .2) {
          result = { ...result, reference: null, path: [] }; stableAt = null; stablePoint = null;
        }
        // A line break is explicit: missing frames never become interpolated points.
        const previousPath = lastVisibleTs === null || dt > 350 ? [] : result.path;
        const path = [...previousPath.filter(p => ts - p.timestamp <= 2500), { ...point, timestamp: ts }].slice(-64);
        result = { ...result, point, path };
        lastVisibleTs = ts;
        if (!result.reference && sample.visible && sample.progress <= startThreshold) {
          if (!stablePoint || Math.hypot((point.x - stablePoint.x) * sample.aspect, point.y - stablePoint.y) > .02) {
            stablePoint = point; stableAt = ts;
          } else if (stableAt !== null && ts - stableAt >= 500) result = { ...result, reference: { ...stablePoint } };
        } else if (!result.reference) { stablePoint = null; stableAt = null; }
      } else {
        result = { ...result, point: null, reference: null, path: [] }; lastVisibleTs = null;
        stablePoint = null; stableAt = null;
      }
      const measured = allowTiming && sample.visible && Number.isFinite(sample.progress) && point !== null;
      if (!measured) {
        active = false; timing = emptyTiming(); previousProgress = null;
        previousCounts = { reps: sample.reps, partials: sample.partials };
        result = { ...result, phase: 'unknown', current: null }; return result;
      }
      const progress = sample.progress;
      if (previousProgress !== null && Math.abs(progress - previousProgress) > .015) direction = progress > previousProgress ? 'move' : 'return';
      const phase: MotionPhase = progress <= startThreshold ? 'ready' : progress >= peakThreshold ? 'hold' : direction;
      const hadBaseline = previousProgress !== null;
      if (!active && hadBaseline && previousProgress! <= startThreshold && progress > startThreshold) { active = true; timing = emptyTiming(); }
      // Integrate only consecutive observable samples, never a hidden interval.
      if (active && dt <= 350) {
        if (result.phase === 'move') timing.moveMs += dt;
        if (result.phase === 'hold') timing.holdMs += dt;
        if (result.phase === 'return') timing.returnMs += dt;
      }
      if (previousCounts && (sample.reps > previousCounts.reps || sample.partials > previousCounts.partials)) {
        // The engine is the sole event source. An interrupted/mid-cycle start has
        // no complete timing, even if the engine later emits a repetition.
        result = { ...result, last: active ? { ...timing, kind: sample.reps > previousCounts.reps ? 'full' : 'partial' } : null };
        active = false; timing = emptyTiming();
      } else if (phase === 'ready' && active) { active = false; timing = emptyTiming(); }
      previousProgress = progress; previousCounts = { reps: sample.reps, partials: sample.partials };
      result = { ...result, phase, current: active ? { ...timing } : null };
      return result;
    },
  };
}

/** Identical aspect-fill projection for trails, reference and marker. */
export function projectMotionPoint(p: { x: number; y: number }, sourceWidth: number, sourceHeight: number, width: number, height: number, mirrored = false) {
  if (![sourceWidth, sourceHeight, width, height].every(n => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const x = (width - sourceWidth * scale) / 2 + p.x * sourceWidth * scale;
  return { x: mirrored ? width - x : x, y: (height - sourceHeight * scale) / 2 + p.y * sourceHeight * scale };
}
