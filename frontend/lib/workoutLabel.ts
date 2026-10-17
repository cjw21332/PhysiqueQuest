import type { WorkoutSessionRecord } from './api';

export function workoutLabel(workout: WorkoutSessionRecord) {
  const name = workout.exercises?.[0]?.name ?? (workout.origin === 'recorded-set' ? 'Recorded set' : 'Workout');
  if (workout.origin !== 'recorded-set') return name;
  const results = workout.sets?.length ? workout.sets.filter(set => set.status === 'completed') : workout.exerciseResults ?? [];
  if (!results.length) return name;
  const reps = results.reduce((sum, result) => sum + result.reps, 0);
  return `${name} · ${reps} ${reps === 1 ? 'rep' : 'reps'}`;
}
