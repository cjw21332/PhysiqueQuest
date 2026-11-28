import type { CoachExercise, ProgramDay, ProgramExercise, SavedProgram } from '../../lib/api';
import { EXERCISES, adaptToEquipment, templateDays, type ProgramTemplate } from '../../lib/programCatalog';
import { prescriptionText, suggestFor, type TrainingContext } from '../../lib/programSuggest';
import { createRequestKey } from '../../lib/requestKey';
import { programWeek } from '../../lib/programWeek';

export const newId = (prefix: string) => `${prefix}_${createRequestKey(prefix).replace(/[^A-Za-z0-9]/g, '').slice(-16)}`;

/**
 * Turns a template into a program with personal suggestions filled in. Ids are stable per template;
 * callers assign a fresh id when saving a copy. Equipment is applied only when given (never for athletes).
 */
export function templateToProgram(template: ProgramTemplate, ctx: TrainingContext, equipment: string[] = []): SavedProgram {
  return {
    id: `tpl_${template.id}`, name: template.name, source: template.kind, templateId: template.id,
    notes: template.athlete ? `Inspired by ${template.athlete}. ${template.summary}` : template.summary,
    days: templateDays(template).map((day, dayIndex) => {
      const picked = [...new Map(day.items.map(key => adaptToEquipment(key, equipment)).map(item => [item.key, item])).values()];
      return {
        id: `d${dayIndex}`, title: day.title, weekday: day.weekday,
        exercises: picked.map(item => {
          const s = suggestFor({ exerciseId: `pq-${item.key}`, name: item.name, equipment: item.equipment, kind: item.kind, reps: item.reps }, ctx, template.style);
          return { exerciseId: `pq-${item.key}`, name: item.name, targetMuscle: item.muscle, equipment: item.equipment, sets: s.sets, reps: s.reps, ...(s.weight !== undefined && { weight: s.weight }), unit: s.unit, restSets: s.restSets, restNext: s.restNext };
        }),
      };
    }),
  };
}

/**
 * Live equipment fit for splits and the user's own programs (athlete programs stay as designed).
 * Built-in exercises the user can't do are swapped for the closest same-muscle, same-pattern
 * alternative, with load, reps and rest re-suggested for the new exercise. Other exercises are kept.
 */
export function adaptProgram(program: SavedProgram, equipment: string[] = [], ctx: TrainingContext) {
  const swaps: { from: string; to: string }[] = [];
  if (program.source === 'athlete') return { program, swaps };
  const days = program.days.map(day => {
    const seen = new Set<string>();
    const exercises = day.exercises.flatMap(row => {
      const key = row.exerciseId.startsWith('pq-') ? row.exerciseId.slice(3) : '';
      const fit = EXERCISES[key] ? adaptToEquipment(key, equipment) : null;
      let next = row;
      if (fit && fit.key !== key) {
        const s = suggestFor({ exerciseId: `pq-${fit.key}`, name: fit.name, equipment: fit.equipment, kind: fit.kind, reps: fit.reps }, ctx);
        next = { ...row, exerciseId: `pq-${fit.key}`, name: fit.name, targetMuscle: fit.muscle, equipment: fit.equipment, reps: s.reps, weight: s.weight, unit: s.unit, restSets: s.restSets, restNext: s.restNext };
        if (!swaps.some(item => item.from === row.name)) swaps.push({ from: row.name, to: fit.name });
      }
      if (seen.has(next.exerciseId)) return [];
      seen.add(next.exerciseId);
      return [next];
    });
    return { ...day, exercises };
  });
  return { program: swaps.length ? { ...program, days } : program, swaps };
}

export function blankExercise(item: { exerciseId: string; name: string; targetMuscle: string; equipment: string }, ctx: TrainingContext): ProgramExercise {
  const s = suggestFor(item, ctx);
  return { ...item, sets: s.sets, unit: ctx.unit, restSets: s.restSets, restNext: s.restNext };
}

/** Session rows for a program day; blank reps/weight stay blank so the user fills them in during the workout. */
export function dayToSession(day: ProgramDay): CoachExercise[] {
  return day.exercises.map(row => ({ exerciseId: row.exerciseId, name: row.name, group: row.targetMuscle, targetMuscle: row.targetMuscle, equipment: row.equipment, tracking: 'Manual', prescription: prescriptionText(row.sets, row.reps, row.weight, row.unit, row.loadBase), restBetweenSets: row.restSets, restAfterExercise: row.restNext }));
}

export const weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const weekdayLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Plan rows for the weekly plan (the backend accepts only these fields); duplicate exercises are dropped. */
export function planExercises(day: ProgramDay): CoachExercise[] {
  const rows = dayToSession(day).map(row => ({ exerciseId: row.exerciseId.slice(0, 80), name: row.name.slice(0, 120), group: (row.group ?? '').slice(0, 120), targetMuscle: (row.targetMuscle ?? '').slice(0, 120), equipment: (row.equipment ?? '').slice(0, 120), tracking: row.tracking, prescription: row.prescription, restBetweenSets: row.restBetweenSets, restAfterExercise: row.restAfterExercise }));
  return [...new Map(rows.map(row => [row.exerciseId, row])).values()].slice(0, 50);
}

export { programWeek };
export const weekPayload = (program: SavedProgram) => programWeek(program).map(({ day, dayIndex }) => ({ dayIndex, title: day.title.trim().slice(0, 80) || 'Workout', exercises: planExercises(day) }));
export const programExerciseCount = (program: SavedProgram) => program.days.reduce((sum, day) => sum + day.exercises.length, 0);
