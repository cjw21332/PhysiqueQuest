export const muscleNames = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Core'] as const;
export type ProgressMuscle = typeof muscleNames[number];

const labels: [ProgressMuscle, RegExp][] = [
  ['Chest', /\b(chest|pectorals?|pecs?)\b/i], ['Back', /\b(back|lats?|latissimus|rhomboids?|traps?|trapezius|spine|spinal erectors?)\b/i],
  ['Shoulders', /\b(shoulders?|deltoids?|delts?)\b/i], ['Biceps', /\b(biceps|brachialis|brachioradialis)\b/i], ['Triceps', /\btriceps\b/i],
  ['Quadriceps', /\b(quadriceps|quads?)\b/i], ['Hamstrings', /\bhamstrings?\b/i], ['Glutes', /\b(glutes?|gluteals?)\b/i],
  ['Calves', /\b(calves|calf|gastrocnemius|soleus)\b/i], ['Core', /\b(core|abdominals?|abs|obliques?|waist)\b/i],
];
const nameHints: [ProgressMuscle, RegExp][] = [
  ['Chest', /\b(bench press|chest press|chest fly|pec(?: deck)? fly|push[ -]?up|floor press)\b/i],
  ['Back', /\b(rows?|pull[ -]?ups?|pulldowns?|chin[ -]?ups?|lat pullover)\b/i],
  ['Shoulders', /\b(overhead press|shoulder press|lateral raise|front raise|reverse fly)\b/i],
  ['Biceps', /\b(biceps?|hammer curl|preacher curl|concentration curl)\b/i],
  ['Triceps', /\b(triceps?|pushdown|skull[ -]?crusher)\b/i],
  ['Quadriceps', /\b(squats?|leg press|leg extension|lunges?)\b/i],
  ['Hamstrings', /\b(romanian deadlift|leg curl|hamstrings?)\b/i],
  ['Glutes', /\b(glutes?|hip thrust|glute bridge)\b/i], ['Calves', /\b(calf raise|calves)\b/i],
  ['Core', /\b(plank|crunch|dead bug|bird dog|sit[ -]?up)\b/i],
];

/** Prefer explicit targets; name hints are estimates used only when labels are broad or missing. */
export function resolveProgressMuscles(name: string, metadata: string[]): { muscles: ProgressMuscle[]; estimated: boolean } {
  const text = metadata.join(' ');
  const explicit = labels.filter(([, pattern]) => pattern.test(text)).map(([muscle]) => muscle);
  if (explicit.length) return { muscles: explicit, estimated: false };
  return { muscles: nameHints.filter(([, pattern]) => pattern.test(name)).map(([muscle]) => muscle), estimated: true };
}
