import { SAFETY_PROFILE, type Intensity } from '../shared/exerciseIntensity';

export type RiskAlert = { kind: 'form' | 'fatigue'; id: string; title: string; reason: string; fix: string };

/** Form faults that load joints or the spine in a way that can lead to injury, with the correction to give. */
export const INJURY_RISK: Record<string, { title: string; reason: string; fix: string }> = {
  knee_valgus: { title: 'Knees caving in', reason: 'Knees collapsing inward strain the knee ligaments.', fix: 'Push your knees out over your toes. Lighten the load if they keep caving.' },
  spine_neutral: { title: 'Spine rounding', reason: 'A rounded or craning spine overloads the lower back and neck.', fix: 'Chest up, brace your core and keep your head in line with your back.' },
  body_line: { title: 'Hips sagging', reason: 'A sagging or piking body line strains the lower back.', fix: 'Squeeze your glutes and brace so shoulders, hips and ankles stay in one line.' },
  torso_swing: { title: 'Swinging the weight', reason: 'Momentum shifts the load onto your lower back and shoulders.', fix: 'Stand still, brace, and use a weight you can move without swinging.' },
};

const WINDOW_MS = 20_000, COOLDOWN_MS = 15_000, FATIGUE_MIN_REPS = 5;

/**
 * Escalates repeated risky form and slowing reps into a stop-and-fix alert.
 * Thresholds tighten with exercise intensity and from age 35.
 */
export function createRiskMonitor(intensity: Intensity, age?: number) {
  const known = typeof age === 'number' && Number.isFinite(age);
  const older = known && age >= 35;
  const repeats = Math.max(2, SAFETY_PROFILE[intensity].riskRepeats - (older ? 1 : 0));
  const fatigueRatio = known && age >= 50 ? 1.4 : older ? 1.5 : 1.6;
  const seen = new Map<string, number[]>();
  const alerted = new Map<string, number>();
  let reps: number[] = [], fatigueAlerted = false;

  return {
    /** `fresh` are fault ids that just started on this frame (not still-held ones). */
    observe(fresh: readonly string[], now: number): RiskAlert | null {
      for (const id of fresh) {
        if (!INJURY_RISK[id]) continue;
        const times = [...(seen.get(id) ?? []).filter(t => now - t <= WINDOW_MS), now];
        seen.set(id, times);
        if (times.length >= repeats && now - (alerted.get(id) ?? -Infinity) >= COOLDOWN_MS) {
          alerted.set(id, now); seen.set(id, []);
          return { kind: 'form', id, ...INJURY_RISK[id] };
        }
      }
      return null;
    },
    rep(now: number): RiskAlert | null {
      reps.push(now);
      if (intensity === 'low' || fatigueAlerted || reps.length < FATIGUE_MIN_REPS) return null;
      const gaps = reps.slice(1).map((t, i) => t - reps[i]);
      const baseline = [...gaps.slice(0, 3)].sort((a, b) => a - b)[1];
      if (gaps[gaps.length - 1] < baseline * fatigueRatio) return null;
      fatigueAlerted = true;
      return { kind: 'fatigue', id: 'fatigue', title: 'Reps are slowing down', reason: 'Slowing reps are a sign of fatigue, when form breaks down and injuries happen.', fix: 'Finish this rep, rest 1–2 minutes, then continue with the same or a lighter load.' };
    },
    /** The user rested or reset: start a fresh baseline. */
    reset() { reps = []; fatigueAlerted = false; seen.clear(); },
  };
}
