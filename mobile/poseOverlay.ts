import { POSE_HOLD_MS, DRAW_VISIBILITY, MIN_DRAW_LANDMARKS } from '../shared/poseConfig';
export { POSE_HOLD_MS } from '../shared/poseConfig';
export type OverlayPoint = { x: number; y: number; visibility?: number };
export function createPoseOverlay() {
  let points: readonly OverlayPoint[] = [];
  let lastSeen = -Infinity;
  return {
    update(next: readonly OverlayPoint[], now: number) {
      if (next.length >= MIN_DRAW_LANDMARKS && next.some(point => (point.visibility ?? 1) >= DRAW_VISIBILITY)) {
        points = next;
        lastSeen = now;
      }
    },
    read(now: number) {
      const age = Math.max(0, now - lastSeen);
      if (age >= POSE_HOLD_MS) return { points: [] as readonly OverlayPoint[], opacity: 0 };
      return { points, opacity: Math.max(0, 1 - age / POSE_HOLD_MS) };
    },
    clear() { points = []; lastSeen = -Infinity; },
  };
}
