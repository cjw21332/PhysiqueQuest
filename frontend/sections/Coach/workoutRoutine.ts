import type { CoachExercise, WorkoutExerciseSnapshot, WorkoutSetResult } from '../../lib/api';

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
