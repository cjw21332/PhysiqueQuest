import type { CoachExercise, WorkoutExerciseSnapshot, WorkoutSetResult } from '../../lib/api';

/** Fallback rest (seconds) between sets and before the next exercise when a routine sets none. */
export const DEFAULT_REST_SECONDS = 30;

export function routineSnapshot(exercises: Pick<CoachExercise, 'exerciseId' | 'name' | 'equipment' | 'prescription'>[]): WorkoutExerciseSnapshot[] {
  return exercises.map(({ exerciseId, name, equipment, prescription }) => ({ exerciseId, name, equipment, prescription, sets: Math.min(10, Math.max(1, Number(prescription?.match(/^(\d+)\s*[×x]/i)?.[1] ?? 1))) }));
}
export function prescribedWork(prescription?: string): { reps: number; durationSeconds?: number } {
  const match = prescription?.match(/[×x]\s*(\d+)(?:\s*(s|sec|min)\b)?/i);
  const count = Number(match?.[1] ?? 0);
  return match?.[2] ? { reps: 0, durationSeconds: count * (match[2].toLowerCase() === 'min' ? 60 : 1) } : { reps: count };
}
export function exerciseProgress(exercise: Pick<WorkoutExerciseSnapshot, 'exerciseId' | 'sets'>, sets: Pick<WorkoutSetResult, 'exerciseId' | 'setIndex' | 'status'>[]) {
  const rows = sets.filter(set => set.exerciseId === exercise.exerciseId && set.setIndex >= 0 && set.setIndex < exercise.sets);
  if (rows.filter(set => set.status === 'completed').length === exercise.sets) return 'completed';
  if (rows.length === exercise.sets) return 'skipped';
  return rows.length ? 'in progress' : 'upcoming';
}
// "@ 40 kg", "· 22 kg" or "@ Bar + 25 kg" (plates added to a bar).
const PLANNED_LOAD = /(?:@|·)\s*(?:([A-Za-z][A-Za-z .-]{0,30}?)\s*\+\s*)?(\d+(?:\.\d+)?)\s*(kg|lbs?)\b/i;
/** Planned load from a prescription such as "3 × 8-12 @ 40 kg" or "4 × 10 · 22 kg", in kilograms. */
export function plannedLoadKg(prescription?: string): number | undefined {
  const match = prescription?.match(PLANNED_LOAD);
  if (!match) return undefined;
  return Number(match[2]) / (match[3].toLowerCase() === 'kg' ? 1 : 2.2046226218);
}
/** True when the planned load is plates on a bar ("@ Bar + 25 kg"), so the bar is not subtracted again. */
export const plannedOnBar = (prescription?: string) => Boolean(prescription?.match(PLANNED_LOAD)?.[1]);
export function plannedLoadUnit(prescription?: string): 'kg' | 'lbs' | undefined {
  const unit = prescription?.match(PLANNED_LOAD)?.[3]?.toLowerCase();
  return unit === undefined ? undefined : unit === 'kg' ? 'kg' : 'lbs';
}
