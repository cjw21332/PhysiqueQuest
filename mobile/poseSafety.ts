type Point = { x: number; y: number; visibility?: number };
export type SafetyPhase = 'unavailable' | 'monitoring' | 'countdown' | 'alarm';
const LANDMARKS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const VISIBILITY = 0.4, FRESH_MS = 1500, MOTION = 0.10;

/** Camera-motion-resistant relative body motion; no images or landmarks are retained outside this session.
 * Stillness and countdown windows follow the exercise intensity (see SAFETY_PROFILE). */
export function createPoseSafety({ stillMs: STILL_MS = 30_000, countdownMs: COUNTDOWN_MS = 30_000 } = {}) {
  let phase: SafetyPhase = 'unavailable', lastFrame = -Infinity, lastMove = 0, countdownAt = 0;
  let baseline: Map<number, { x: number; y: number }> | null = null;
  const reset = () => { phase = 'unavailable'; baseline = null; lastFrame = -Infinity; };
  function observe(points: readonly Point[], now: number) {
    if (phase === 'alarm') return;
    const indices = LANDMARKS.filter(i => points[i] && (points[i].visibility ?? 1) >= VISIBILITY && Number.isFinite(points[i].x) && Number.isFinite(points[i].y));
    const s = points[11], h = points[23];
    if (indices.length < 6 || !indices.includes(11) || !indices.includes(23)) return;
    const torso = Math.hypot(s.x - h.x, s.y - h.y);
    if (torso < 0.025) return;
    const cx = indices.reduce((v, i) => v + points[i].x, 0) / indices.length;
    const cy = indices.reduce((v, i) => v + points[i].y, 0) / indices.length;
    const current = new Map(indices.map(i => [i, { x: points[i].x - cx, y: points[i].y - cy }]));
    if (now - lastFrame > FRESH_MS || !baseline) {
      baseline = current;
    } else {
      const common = indices.filter(i => baseline!.has(i));
      if (common.length < 6) { baseline = current; }
      else {
        const displacement = common.reduce((sum, i) => sum + Math.hypot(current.get(i)!.x - baseline!.get(i)!.x, current.get(i)!.y - baseline!.get(i)!.y), 0) / common.length / torso;
        if (displacement >= MOTION) { baseline = current; lastMove = now; phase = 'monitoring'; }
      }
    }
    lastFrame = now;
  }
  function tick(now: number) {
    if (phase === 'monitoring' && now - lastMove >= STILL_MS) { phase = 'countdown'; countdownAt = now; }
    if (phase === 'countdown' && now - countdownAt >= COUNTDOWN_MS) phase = 'alarm';
    return { phase, seconds: phase === 'countdown' ? Math.max(0, Math.ceil((COUNTDOWN_MS - (now - countdownAt)) / 1000)) : 0 };
  }
  return { start(now: number) { if (phase === 'unavailable') { phase = 'monitoring'; lastMove = now; } }, observe, tick, reset, movement(now: number) { if (phase === 'monitoring' || phase === 'countdown') { phase = 'monitoring'; lastMove = now; } }, okay(now: number) { if (phase === 'countdown') { phase = 'monitoring'; lastMove = now; } } };
}
