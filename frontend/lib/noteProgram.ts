import type { ProgramDay, ProgramExercise, SavedProgram } from './api';
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Turns a workout note (for example a phone note) into a draft program for the Program builder.
 * Understands day headers ("PUSH DAY - 11/25/26", "Leg Day", "UPPER DAY WORKOUT"), numbered exercises
 * ("3. Incline Chest Machine Press", "2. Leg Press: 4 sets x 10-12 reps"), warm-up vs working sets, and set
 * lines such as "20 kg x 8", "Bar + 20 kg × 10", "EZ bar + 10 kg x 12" or "12 reps". Only working sets count.
 */
type Draft = { order: number; name: string; section?: string; declaredSets?: number; declaredReps?: string; working: { reps?: number; load?: number; unit?: 'kg' | 'lbs' }[] };
const DAY = /^(push|pull|legs?|upper|lower|full(?:\s+body)?)(?:\s+day)?(?:\s+workout)?(?:\s*[-–:].*)?$/i;
const SECTION = /^(chest|back|shoulders?|biceps|triceps|core|abs|arms)$/i;
const DAY_TITLE: Record<string, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower' };

const clean = (line: string) => line.replace(/[✅✔☑]/gu, '').replace(/[\u{1F300}-\u{1FAFF}]/gu, '').replace(/×/g, 'x').replace(/\s+/g, ' ').trim();
const titleCase = (text: string) => text.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase()).replace(/\bEz\b/g, 'EZ').replace(/\bT-bar\b/gi, 'T-Bar');
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function equipmentOf(name: string, hasLoad: boolean) {
  const n = name.toLowerCase();
  if (/smith/.test(n)) return 'Smith machine';
  if (/dumbbell|\bdb\b|hammer/.test(n)) return 'Dumbbells';
  if (/cable|pushdown|pulldown|lat pullover/.test(n)) return 'Cable';
  if (/machine|pec deck|leg press|leg extension|leg curl|calf raise|t-bar/.test(n)) return 'Machine';
  if (/barbell|deadlift|\bez\b|preacher|squat|bench press/.test(n)) return 'Barbell';
  return hasLoad ? 'Machine' : 'Bodyweight';
}
function muscleOf(name: string, section?: string) {
  if (section) return titleCase(section);
  const n = name.toLowerCase();
  if (/bench|chest|pec|fly|dip/.test(n)) return 'Chest';
  if (/shoulder|lateral|overhead|rear delt/.test(n)) return 'Shoulders';
  if (/row|pulldown|pullover|pull-up|chin/.test(n)) return 'Back';
  if (/curl/.test(n) && !/leg curl/.test(n)) return 'Biceps';
  if (/tricep|pushdown|kickback|skull/.test(n)) return 'Triceps';
  if (/deadlift|leg curl|rdl|hip/.test(n)) return 'Hamstrings';
  if (/leg press|squat|leg extension|lunge/.test(n)) return 'Quads';
  if (/calf/.test(n)) return 'Calves';
  if (/leg raise|crunch|plank|\bab/.test(n)) return 'Core';
  return 'Full body';
}

function toExercise(draft: Draft, dayKey: string, index: number): ProgramExercise {
  const loads = draft.working.filter(set => set.load !== undefined);
  const units = loads.map(set => set.unit ?? 'kg');
  const unit: 'kg' | 'lbs' = units.filter(value => value === 'lbs').length > units.length / 2 ? 'lbs' : 'kg';
  const sameUnit = loads.filter(set => (set.unit ?? 'kg') === unit);
  const reps = draft.working.map(set => set.reps).filter((value): value is number => typeof value === 'number' && value > 0);
  const repText = draft.declaredReps ?? (reps.length ? (Math.min(...reps) === Math.max(...reps) ? String(reps[0]) : `${Math.min(...reps)}-${Math.max(...reps)}`) : undefined);
  return {
    exerciseId: `note-${slug(dayKey)}-${index + 1}-${slug(draft.name)}`.slice(0, 80),
    name: titleCase(draft.name).slice(0, 120),
    targetMuscle: muscleOf(draft.name, draft.section),
    equipment: equipmentOf(draft.name, loads.length > 0),
    sets: Math.min(10, Math.max(1, draft.declaredSets ?? (draft.working.length || 3))),
    ...(repText ? { reps: repText.slice(0, 20) } : {}),
    ...(sameUnit.length ? { weight: Math.max(...sameUnit.map(set => set.load!)) } : {}),
    unit,
    restSets: 30,
    restNext: 30,
  };
}

/** Parses the note; `trainingDays` (profile day names) assigns weekdays in order. Returns null when no exercises were found. */
export function noteToProgram(text: string, id: string, dayId: (index: number) => string, trainingDays: string[] = []): SavedProgram | null {
  const days = new Map<string, { title: string; drafts: Draft[] }>();
  let dayKey = '', mode: 'warmup' | 'working' = 'working', section: string | undefined;
  let current: Draft | null = null;
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const titleLine = lines.find(line => /program|workout plan/i.test(line) && !DAY.test(line));
  const ensureDay = (key: string) => { if (!days.has(key)) days.set(key, { title: DAY_TITLE[key] ?? titleCase(key), drafts: [] }); return days.get(key)!; };
  const flush = () => { if (current && dayKey) ensureDay(dayKey).drafts.push(current); current = null; };

  for (const line of lines) {
    const day = DAY.exec(line);
    if (day && !/\d+\s*(kg|lbs?)|\bx\s*\d/i.test(line)) {
      flush();
      dayKey = day[1].toLowerCase().replace(/^leg$/, 'legs');
      ensureDay(dayKey);
      section = undefined;
      continue;
    }
    if (SECTION.test(line)) { flush(); section = line; continue; }
    const exercise = /^(\d+)\s*[.)]\s+([A-Za-z].*)$/.exec(line);
    if (exercise && dayKey) {
      flush();
      const [rawName, rest = ''] = exercise[2].split(':');
      const declared = /(\d+)\s*sets?\s*x\s*(\d+(?:\s*-\s*\d+)?)\s*reps?/i.exec(rest);
      current = { order: Number(exercise[1]), name: rawName.replace(/\s*\(.*?\)\s*/g, ' ').trim(), section, working: [], ...(declared ? { declaredSets: Number(declared[1]), declaredReps: declared[2].replace(/\s/g, '') } : {}) };
      mode = 'working';
      continue;
    }
    if (!current) continue;
    if (/^warm-?\s*up/i.test(line)) { mode = 'warmup'; continue; }
    if (/^working/i.test(line)) { mode = 'working'; continue; }
    const reps = /x\s*(\d+)\s*$/i.exec(line) ?? /^(\d+)\s*reps?$/i.exec(line);
    if (!reps || mode === 'warmup') continue;
    const loads = [...line.matchAll(/(\d+(?:\.\d+)?)\s*(kg|lbs?)\b/gi)];
    const last = loads[loads.length - 1];
    const draft: Draft = current;
    draft.working.push({ reps: Number(reps[1]), ...(last ? { load: Number(last[1]), unit: /^lb/i.test(last[2]) ? 'lbs' as const : 'kg' as const } : {}) });
  }
  flush();

  const filled = [...days.entries()].filter(([, day]) => day.drafts.length);
  if (!filled.length) return null;
  const weekdays = trainingDays.map(name => WEEKDAYS.findIndex(day => day.toLowerCase() === name.trim().toLowerCase())).filter(index => index >= 0).sort((a, b) => a - b);
  const missing = [...days.values()].filter(day => !day.drafts.length).map(day => day.title);
  const result: ProgramDay[] = filled.slice(0, 7).map(([key, day], index) => ({
    id: dayId(index),
    title: day.title,
    weekday: weekdays.length >= filled.length ? weekdays[index] : index,
    exercises: [...day.drafts].sort((a, b) => a.order - b.order).map((draft, position) => toExercise(draft, key, position)).slice(0, 100),
  }));
  const notes = `Imported from notes. Weights are your heaviest logged working sets.${missing.length ? ` No exercises were listed for: ${missing.join(', ')}.` : ''}`;
  const split = [...days.values()].map(day => day.title[0]).join('');
  return { id, name: (titleLine ? titleCase(titleLine) : `${split} program`).slice(0, 60), notes: notes.slice(0, 500), source: 'custom', days: result };
}
