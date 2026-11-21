/** Timestamp-based One Euro filter for normalized pose coordinates. */
export type FilterPoint = { x: number; y: number; z?: number; visibility?: number; presence?: number };
import { LANDMARK_FILTER_DEFAULTS, FILTER_RESET_MS } from './poseConfig';
export { LANDMARK_FILTER_DEFAULTS } from './poseConfig';

export function createLandmarkFilter(fast = false, bypass = false) {
  const params = fast ? LANDMARK_FILTER_DEFAULTS.fast : LANDMARK_FILTER_DEFAULTS.slow;
  let lastTime: number | undefined;
  let previous: FilterPoint[] = [];
  let previousRaw: FilterPoint[] = [];
  let derivatives: Array<{ x: number; y: number; z: number }> = [];
  const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return {
    reset() { lastTime = undefined; previous = []; previousRaw = []; derivatives = []; },
    update(points: readonly FilterPoint[], timestamp: number): FilterPoint[] {
      if (bypass) return points.map(point => ({ ...point }));
      if (!Number.isFinite(timestamp)) return points.map(point => ({ ...point }));
      if (lastTime === undefined || timestamp <= lastTime || timestamp - lastTime > FILTER_RESET_MS || previous.length !== points.length) {
        lastTime = timestamp;
        previous = points.map(point => ({ ...point }));
        previousRaw = points.map(point => ({ ...point }));
        derivatives = points.map(() => ({ x: 0, y: 0, z: 0 }));
        return previous.map(point => ({ ...point }));
      }
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      const derivativeAlpha = alpha(LANDMARK_FILTER_DEFAULTS.derivativeCutoff, dt);
      previous = points.map((point, i) => {
        const old = previous[i];
        const credible = (p: FilterPoint) => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.min(p.visibility ?? 1, p.presence ?? 1) >= .4;
        // Hidden-joint guesses must not drag the skeleton away from the body.
        // Reacquired points start at their measured location without catch-up lag.
        if (!credible(point) || !credible(old)) {
          derivatives[i] = { x: 0, y: 0, z: 0 };
          return { ...point };
        }
        const filtered = { ...point };
        for (const axis of ['x', 'y', 'z'] as const) {
          const value = point[axis];
          const prior = old[axis];
          if (value === undefined || prior === undefined) continue;
          const rawPrior = previousRaw[i][axis] ?? value;
          const derivative = derivativeAlpha * ((value - rawPrior) / dt) + (1 - derivativeAlpha) * derivatives[i][axis];
          derivatives[i][axis] = derivative;
          const a = alpha(params.minCutoff + params.beta * Math.abs(derivative), dt);
          filtered[axis] = a * value + (1 - a) * prior;
        }
        return filtered;
      });
      previousRaw = points.map(point => ({ ...point }));
      return previous.map(point => ({ ...point }));
    },
  };
}
