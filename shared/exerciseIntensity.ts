export type Intensity = 'low' | 'moderate' | 'high';

// Loaded, explosive or maximal work. shortcut: keyword match on the exercise name,
// upgrade to a library field when exercises carry a curated intensity.
const HIGH = /barbell|deadlift|clean|snatch|jerk|jump|burpee|sprint|plyo|thruster|smith|leg press|hack squat|bench press|weighted|max effort/i;
const LOW = /plank|hold|stretch|bird dog|dead bug|wall sit|glute bridge|mobility|breathing/i;
const HIGH_PATTERNS = new Set(['jumping_jack', 'high_knees', 'mountain_climber']);

export function exerciseIntensity(name: string, pattern = '', hold = false): Intensity {
  if (HIGH.test(name) || HIGH_PATTERNS.has(pattern)) return 'high';
  if (hold || LOW.test(name)) return 'low';
  return 'moderate';
}

/** How tightly safety monitoring runs at each intensity. Holds are still by design, so they get the longest stillness window. */
export const SAFETY_PROFILE: Record<Intensity, { stillMs: number; countdownMs: number; riskRepeats: number; label: string }> = {
  low: { stillMs: 60_000, countdownMs: 30_000, riskRepeats: 4, label: 'Low intensity' },
  moderate: { stillMs: 30_000, countdownMs: 30_000, riskRepeats: 3, label: 'Moderate intensity' },
  high: { stillMs: 20_000, countdownMs: 20_000, riskRepeats: 2, label: 'High intensity' },
};
