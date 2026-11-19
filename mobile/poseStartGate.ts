import { FRAME_GUIDANCE, GATE_TIMING } from '../shared/poseConfig';
export { FRAME_GUIDANCE } from '../shared/poseConfig';
export type FrameStatus = 'OK' | 'TOO_CLOSE' | 'TOO_FAR' | 'NOT_VISIBLE';
export function requiredLandmarks(pattern: string): number[] {
  if (['curl', 'lateral_raise', 'front_raise', 'vertical_push', 'vertical_pull', 'horizontal_pull', 'triceps_extension', 'dip'].includes(pattern)) return [11, 12, 13, 14, 15, 16, 23, 24];
  if (['horizontal_push', 'core_isometric', 'core_flexion'].includes(pattern)) return [11, 12, 23, 24, 25, 26];
  return [11, 12, 23, 24, 25, 26, 27, 28];
}
export function frameStatus(pattern: string, points: readonly { x: number; y: number; visibility?: number }[]): FrameStatus {
  const required = requiredLandmarks(pattern).map(index => points[index]);
  if (required.some(point => !point || (point.visibility ?? 1) < FRAME_GUIDANCE.visibility)) return 'NOT_VISIBLE';
  if (required.some(point => point.x <= 0 || point.x >= 1 || point.y <= 0 || point.y >= 1)) return 'TOO_CLOSE';
  const ys = points.filter(point => point && (point.visibility ?? 1) >= FRAME_GUIDANCE.visibility && point.y >= 0 && point.y <= 1).map(point => point.y);
  const height = Math.max(...ys) - Math.min(...ys);
  if (height > FRAME_GUIDANCE.maxHeight) return 'TOO_CLOSE';
  if (height < FRAME_GUIDANCE.minHeight) return 'TOO_FAR';
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
