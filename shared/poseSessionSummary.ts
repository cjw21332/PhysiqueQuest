export type NativePoseSummary = {
  completeReps: number;
  partialReps: number;
  durationSeconds: number;
  holdMs: number | null;
  issues?: Array<{ id: PoseIssueId; count: number }>;
};

export const POSE_ISSUES = {
  body_line: { title: 'Body alignment', advice: 'Keep your shoulders, hips and ankles in a comfortable line.' },
  spine_neutral: { title: 'Head and spine alignment', advice: 'Keep your head and shoulders aligned with your torso.' },
  knee_valgus: { title: 'Knee alignment', advice: 'Guide your knee over your foot as you move.' },
  knee_over_toe: { title: 'Knee position', advice: 'Check your stance and move within a comfortable range.' },
  torso_swing: { title: 'Torso movement', advice: 'Brace your trunk and move the working joint under control.' },
  depth: { title: 'Movement range', advice: 'Use a comfortable full range of motion without forcing depth.' },
  tempo: { title: 'Movement tempo', advice: 'Move at a steady pace and keep each repetition controlled.' },
} as const;
export type PoseIssueId = keyof typeof POSE_ISSUES;

export function parseNativePoseSummary(value: unknown): NativePoseSummary | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const valid = (n: unknown, max: number) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
  if (!valid(input.completeReps, 100000) || !valid(input.partialReps, 100000) || !valid(input.durationSeconds, 86400) ||
      !(input.holdMs === null || valid(input.holdMs, 86400000))) return null;
  if (input.issues !== undefined && (!Array.isArray(input.issues) || input.issues.length > Object.keys(POSE_ISSUES).length || input.issues.some((item: unknown) => {
    if (!item || typeof item !== 'object') return true;
    const issue = item as Record<string, unknown>;
    return typeof issue.id !== 'string' || !Object.prototype.hasOwnProperty.call(POSE_ISSUES, issue.id) || !valid(issue.count, 100000) || issue.count === 0;
  }))) return null;
  return input as NativePoseSummary;
}

/** Time spent tracking after detection, excluding paused intervals. */
export function createPoseSessionClock(now: () => number) {
  let startAt: number | null = null;
  let elapsed = 0;
  return {
    start() { if (startAt === null) startAt = now(); },
    pause() { if (startAt !== null) { elapsed += Math.max(0, now() - startAt); startAt = null; } },
    seconds() { return Math.floor((elapsed + (startAt === null ? 0 : Math.max(0, now() - startAt))) / 1000); },
  };
}
