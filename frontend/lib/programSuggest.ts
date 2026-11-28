// Suggests sets, reps, load and rest for any exercise from the user's profile and logged bests.
// Without history it estimates a 1RM from novice bodyweight-ratio strength standards
// (scaled for sex, age, activity level and BMI) and prescribes ~3 reps in reserve,
// so first sessions start deliberately light. Logged bests take over once they exist.
// Rest: ~3 min for heavy compounds, 2 min for other multi-joint work, 60-90 s for
// isolation, in line with rest-interval research on strength and hypertrophy.
import type { ExerciseKind } from './programCatalog';

export type Unit = 'kg' | 'lbs';
export type TrainingRecord = { exerciseId: string; name: string; loadKg?: number };
export type TrainingContext = { bodyKg: number; heightCm: number; age: number; female: boolean; goal: string; activity: string; unit: Unit; records: TrainingRecord[] };
export type Suggestion = { sets: number; reps: string; weight?: number; unit: Unit; perHand: boolean; restSets: number; restNext: number; basis: 'history' | 'profile' | 'bodyweight' };
export type ProgramStyle = { sets?: number; reps?: string; rest?: number };

const LB = 2.2046226218;
type Load = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'band';

type ProfileLike = { weight?: string; weightUnit?: string; height?: string; heightUnit?: string; heightInches?: string; age?: string; gender?: string; goal?: string; activity?: string };

export function trainingContext(profile: ProfileLike, records: TrainingRecord[] = []): TrainingContext {
  const female = /^(f|woman)/i.test(profile.gender ?? '');
  const weight = Number(profile.weight);
  const lbs = /lb/i.test(profile.weightUnit ?? '');
  const bodyKg = weight > 20 && weight < 700 ? (lbs ? weight / LB : weight) : female ? 62 : 75;
  const height = Number(profile.height);
  const heightCm = /ft/i.test(profile.heightUnit ?? '') ? height * 30.48 + (Number(profile.heightInches) || 0) * 2.54 : height;
  const age = Number(profile.age);
  return { bodyKg, heightCm: heightCm > 100 && heightCm < 250 ? heightCm : female ? 162 : 175, age: age >= 10 && age <= 100 ? age : 30, female, goal: profile.goal || 'General fitness', activity: profile.activity || '', unit: lbs ? 'lbs' : 'kg', records };
}

// [pattern, novice male 1RM as a multiple of bodyweight (barbell-equivalent), kind, region]
const MOVES: [RegExp, number, ExerciseKind, 'upper' | 'lower'][] = [
  [/romanian|rdl|stiff.?leg/, 1.0, 'main', 'lower'],
  [/deadlift/, 1.5, 'main', 'lower'],
  [/leg press|hack squat/, 2.0, 'compound', 'lower'],
  [/hip thrust|glute bridge/, 1.2, 'compound', 'lower'],
  [/split squat|lunge|step.?up/, 0.55, 'compound', 'lower'],
  [/goblet/, 0.6, 'compound', 'lower'],
  [/squat/, 1.25, 'main', 'lower'],
  [/leg curl|hamstring curl/, 0.45, 'iso', 'lower'],
  [/leg extension/, 0.6, 'iso', 'lower'],
  [/calf/, 1.0, 'iso', 'lower'],
  [/incline.*(press|bench)/, 0.65, 'compound', 'upper'],
  [/bench press|chest press|floor press/, 0.75, 'main', 'upper'],
  [/\bfly|flye|pec deck|crossover/, 0.3, 'iso', 'upper'],
  [/overhead press|shoulder press|military|arnold press|pike/, 0.5, 'main', 'upper'],
  [/lateral raise|front raise/, 0.2, 'iso', 'upper'],
  [/rear delt|reverse (pec|fly)|face pull|pull.?apart/, 0.25, 'iso', 'upper'],
  [/pullover/, 0.4, 'iso', 'upper'],
  [/pulldown|pull-down|pull.?up|chin.?up/, 0.7, 'compound', 'upper'],
  [/row/, 0.75, 'main', 'upper'],
  [/shrug/, 1.0, 'iso', 'upper'],
  [/curl/, 0.35, 'iso', 'upper'],
  [/tricep|pushdown|skull|kickback|extension/, 0.35, 'iso', 'upper'],
  [/crunch|plank|leg raise|sit.?up|hollow|dead bug|bird dog|\babs?\b|core/, 0, 'core', 'upper'],
];

const PLAN: Record<string, Record<ExerciseKind, [number, string]>> = {
  Strength: { main: [4, '4-6'], compound: [3, '6-8'], iso: [3, '10-12'], core: [3, '10-15'] },
  'Build muscle': { main: [3, '6-10'], compound: [3, '8-12'], iso: [3, '10-15'], core: [3, '10-15'] },
  'Weight loss': { main: [3, '8-10'], compound: [3, '10-12'], iso: [2, '12-15'], core: [3, '12-15'] },
  Endurance: { main: [2, '12-15'], compound: [2, '12-15'], iso: [2, '15-20'], core: [3, '15-20'] },
  'General fitness': { main: [3, '8-10'], compound: [3, '10-12'], iso: [2, '12-15'], core: [3, '10-15'] },
};
// Unloaded work (bodyweight, bands) can't add weight, so it uses wider rep ranges taken close to
// failure; low- and high-rep sets give similar hypertrophy when effort is high.
const UNLOADED: Record<string, string> = { Strength: '5-10', 'Build muscle': '8-20', 'Weight loss': '10-20', Endurance: '15-30', 'General fitness': '8-15' };
const REST: Record<ExerciseKind, [number, number]> ={ main: [180, 180], compound: [120, 150], iso: [75, 120], core: [60, 90] };
const LEVEL: Record<string, number> = { Sedentary: 0.6, Light: 0.7, Moderate: 0.8, Active: 0.95, Athlete: 1.1 };

export function classify(name: string, equipment = '') {
  const text = `${name} ${equipment}`.toLowerCase();
  const move = MOVES.find(([pattern]) => pattern.test(name.toLowerCase()));
  const load: Load = /band/.test(text) ? 'band'
    : /body ?weight|push.?up|pull.?up|chin.?up|\bdips?\b|inverted|plank|crunch|leg raise|sit.?up|sliding|single-leg|back extension|\bnone\b/.test(text) ? 'bodyweight'
    : /dumbbell|kettlebell/.test(text) ? 'dumbbell'
    : /barbell|ez.?bar|smith|trap bar/.test(text) ? 'barbell' : 'machine';
  return { ratio: move?.[1] ?? 0.4, kind: move?.[2] ?? 'compound' as ExerciseKind, region: move?.[3] ?? 'upper', load };
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const lowReps = (reps: string) => Number(reps.match(/\d+/)?.[0] ?? 10);
const round = (value: number, step: number) => Math.round(value / step) * step;

/** Estimated one-rep max in kg from profile data alone (barbell-equivalent total load). */
export function estimatedMaxKg(ratio: number, region: 'upper' | 'lower', ctx: TrainingContext) {
  const scaledBody = 80 * (ctx.bodyKg / 80) ** 0.67; // strength scales sub-linearly with body mass
  const sex = ctx.female ? (region === 'upper' ? 0.6 : 0.68) : 1;
  const age = ctx.age < 16 ? 0.7 : ctx.age < 18 ? 0.85 : ctx.age <= 35 ? 1 : Math.max(0.6, 1 - 0.008 * (ctx.age - 35));
  const bmi = ctx.bodyKg / (ctx.heightCm / 100) ** 2;
  return scaledBody * ratio * sex * (LEVEL[ctx.activity] ?? 0.7) * age * (bmi < 18.5 || bmi > 32 ? 0.9 : 1);
}

export function suggestFor(exercise: { exerciseId?: string; name: string; equipment: string; kind?: ExerciseKind; reps?: string }, ctx: TrainingContext, style: ProgramStyle = {}, fixed: { sets?: number; reps?: string } = {}): Suggestion {
  const info = classify(exercise.name, exercise.equipment);
  // Dumbbell and machine versions of the big lifts are less fatiguing than barbell ones: treat as compound.
  const kind = exercise.kind ?? (info.kind === 'main' && info.load !== 'barbell' ? 'compound' : info.kind);
  const [baseSets, baseReps] = (PLAN[ctx.goal] ?? PLAN['General fitness'])[kind];
  const record = ctx.records.find(item => item.loadKg && ((exercise.exerciseId && item.exerciseId === exercise.exerciseId) || norm(item.name) === norm(exercise.name)));
  const youthOrSenior = ctx.age < 18 || ctx.age >= 60;
  const novice = !record && (LEVEL[ctx.activity] ?? 0.7) <= 0.7;
  let sets = fixed.sets ?? style.sets ?? baseSets;
  if (fixed.sets === undefined && style.sets === undefined && (novice || youthOrSenior)) sets = Math.min(sets, 3);
  const unloaded = kind !== 'core' && (info.load === 'bodyweight' || info.load === 'band');
  let reps = fixed.reps ?? exercise.reps ?? style.reps ?? (unloaded ? UNLOADED[ctx.goal] ?? UNLOADED['General fitness'] : baseReps);
  if (youthOrSenior && lowReps(reps) < 6 && !fixed.reps) reps = '6-8';
  const [restBase, restNextBase] = REST[kind];
  const fast = ctx.goal === 'Weight loss' || ctx.goal === 'Endurance';
  const restSets = style.rest && kind !== 'core' ? style.rest : ctx.goal === 'Strength' && kind === 'main' ? 240 : fast ? Math.max(kind === 'main' ? 120 : 45, round(restBase * 0.67, 15)) : restBase;
  const restNext = Math.max(restSets, fast ? round(restNextBase * 0.75, 15) : restNextBase);
  const base = { sets, reps, unit: ctx.unit, perHand: info.load === 'dumbbell', restSets, restNext };
  if (kind === 'core' || info.load === 'bodyweight' || info.load === 'band' || /\d\s*s\b|sec|min/.test(reps)) return { ...base, basis: 'bodyweight' };
  const target = lowReps(reps);
  // Epley: weight = 1RM / (1 + reps/30). Reps in reserve keep first sessions submaximal.
  // A logged best is treated as a ~8-rep set in the same units the user logged (per hand for dumbbells).
  let kg = record?.loadKg ? record.loadKg * (1 + 8 / 30) / (1 + (target + 2) / 30) : estimatedMaxKg(info.ratio, info.region, ctx) / (1 + (target + 3) / 30);
  if (!record && info.load === 'dumbbell') kg *= kind === 'iso' ? 0.45 : 0.4; // per hand
  const lbs = ctx.unit === 'lbs';
  const step = info.load === 'dumbbell' ? (lbs ? 5 : 2) : lbs ? 5 : 2.5;
  const min = info.load === 'barbell' ? (lbs ? 45 : 20) : lbs ? 5 : 2;
  const weight = Math.max(min, round(lbs ? kg * LB : kg, step));
  return { ...base, weight: Number(weight.toFixed(1)), basis: record ? 'history' : 'profile' };
}

export function formatRest(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
export function formatLoad(s: Pick<Suggestion, 'weight' | 'unit' | 'perHand'> & { base?: string }) { return s.weight === undefined ? 'Bodyweight' : `${s.base ? `${s.base} + ` : ''}${s.weight} ${s.unit}${s.perHand ? ' each' : ''}`; }
/** Session prescription such as "3 × 8-12 @ 40 kg" or "3 × 8-10 @ Bar + 25 kg"; blank reps stay blank so the user decides. */
export function prescriptionText(sets: number, reps?: string, weight?: number, unit: Unit = 'kg', base?: string) {
  return `${sets} × ${reps?.trim() || '—'}${weight !== undefined ? ` @ ${base ? `${base} + ` : ''}${weight} ${unit}` : ''}`.slice(0, 80);
}
/** Rough session length: ~40 s per working set plus prescribed rests. */
export function sessionMinutes(rows: { sets: number; restSets: number; restNext: number }[]) {
  const seconds = rows.reduce((sum, row, index) => sum + row.sets * 40 + Math.max(0, row.sets - 1) * row.restSets + (index < rows.length - 1 ? row.restNext : 0), 0);
  return Math.max(5, Math.round(seconds / 300) * 5);
}
