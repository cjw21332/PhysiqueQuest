import type { Landmark } from './exerciseEngine';

/** Select a clear central torso, retaining the subject through small score changes. */
export function createPoseSubjectSelector() {
  let previous: { x: number; y: number } | null = null;
  return {
    reset() { previous = null; },
    select(poses: readonly (readonly Landmark[])[]) {
      const candidates = poses.map(landmarks => {
        const torso = [11, 12, 23, 24].map(i => landmarks[i]).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.min(p.visibility ?? 1, p.presence ?? 1) >= .5);
        if (torso.length < 2) return null;
        const x = torso.reduce((sum, p) => sum + p.x, 0) / torso.length;
        const y = torso.reduce((sum, p) => sum + p.y, 0) / torso.length;
        const distance = Math.hypot(x - .5, (y - .5) * .5);
        const continuity = previous ? Math.hypot(x - previous.x, y - previous.y) : 0;
        return { landmarks, x, y, score: distance + continuity * .6 - torso.length * .02 };
      }).filter(candidate => candidate !== null).sort((a, b) => a.score - b.score);
      const chosen = candidates[0];
      if (!chosen) return { landmarks: [] as readonly Landmark[], changed: false };
      const changed = previous !== null && Math.hypot(chosen.x - previous.x, chosen.y - previous.y) > .25;
      previous = { x: chosen.x, y: chosen.y };
      return { landmarks: chosen.landmarks, changed };
    },
  };
}
