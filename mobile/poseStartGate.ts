import { FRAME_GUIDANCE, GATE_TIMING } from '../shared/poseConfig';
import { isPatternId, patternSpec } from '../shared/exerciseEngine';
export { FRAME_GUIDANCE } from '../shared/poseConfig';
export type FrameStatus = 'OK' | 'TOO_CLOSE' | 'TOO_FAR' | 'NOT_VISIBLE';
export function requiredLandmarks(pattern: string): number[] {
  if (isPatternId(pattern)) {
    const spec = patternSpec(pattern);
    return [...new Set([...spec.joints.left, ...spec.joints.right])];
  }
  if (['curl', 'lateral_raise', 'front_raise', 'vertical_push', 'vertical_pull', 'horizontal_pull', 'triceps_extension', 'dip'].includes(pattern)) return [11, 12, 13, 14, 15, 16, 23, 24];
  if (['horizontal_push', 'core_isometric', 'core_flexion'].includes(pattern)) return [11, 12, 23, 24, 25, 26];
  return [11, 12, 23, 24, 25, 26, 27, 28];
}
export function frameStatus(pattern: string, points: readonly { x: number; y: number; visibility?: number; presence?: number }[]): FrameStatus {
  const spec = isPatternId(pattern) ? patternSpec(pattern) : null;
  // One complete working limb is sufficient; unrelated cropped joints do not
  // prevent a bench press, seated curl, leg press or calf raise from starting.
  const credible = (index: number) => {
    const p = points[index];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= FRAME_GUIDANCE.visibility && (p.presence ?? 1) >= FRAME_GUIDANCE.visibility;
  };
  const groups = spec ? [spec.joints.left, spec.joints.right] : [requiredLandmarks(pattern)];
  const visible = groups.filter(group => group.every(credible));
  const selected = visible.find(group => group.every(index => points[index].x > 0 && points[index].x < 1 && points[index].y > 0 && points[index].y < 1)) ?? visible[0];
  if (!selected) return 'NOT_VISIBLE';
  const required = selected.map(index => points[index]);
  if (required.some(point => !point || (point.visibility ?? 1) < FRAME_GUIDANCE.visibility)) return 'NOT_VISIBLE';
  if (required.some(point => point.x <= 0 || point.x >= 1 || point.y <= 0 || point.y >= 1)) return 'TOO_CLOSE';
  const height = Math.max(Math.max(...required.map(p => p.y)) - Math.min(...required.map(p => p.y)), Math.max(...required.map(p => p.x)) - Math.min(...required.map(p => p.x)));
  if (height > FRAME_GUIDANCE.maxHeight) return 'TOO_CLOSE';
  if (height < Math.min(FRAME_GUIDANCE.minHeight, .08)) return 'TOO_FAR';
  return 'OK';
}

/** Accumulate three seconds of visible frames, tolerating brief detector flicker. */
export function createPoseStartGate() {
  let visibleMs = 0;
  let lastVisible: number | null = null;
  let consecutive = false;
  let active = false;
  const reset = () => { visibleMs = 0; lastVisible = null; consecutive = false; active = false; };
  return {
    reset,
    update(timestamp: number, visible: boolean): { active: boolean; countdown: number | null } {
      if (!Number.isFinite(timestamp)) { reset(); return { active: false, countdown: null }; }
      if (!visible) {
        if (lastVisible !== null && (timestamp < lastVisible || timestamp - lastVisible > (active ? GATE_TIMING.lostMs : GATE_TIMING.flickerMs))) reset();
        else consecutive = false;
        return { active, countdown: null };
      }
      if (lastVisible !== null && (timestamp < lastVisible || timestamp - lastVisible > (active ? GATE_TIMING.lostMs : GATE_TIMING.flickerMs))) reset();
      if (lastVisible !== null && consecutive) visibleMs += timestamp - lastVisible;
      lastVisible = timestamp;
      consecutive = true;
      if (visibleMs >= GATE_TIMING.startMs) active = true;
      return { active, countdown: active ? null : Math.min(GATE_TIMING.countdownSteps, Math.ceil((GATE_TIMING.startMs - visibleMs) / GATE_TIMING.stepMs)) };
    },
  };
}
