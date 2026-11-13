import type { WorkoutSessionRecord } from './api';

export function exerciseHistory(workouts: WorkoutSessionRecord[], exerciseId: string) {
  return workouts.filter(w => w.status === 'completed').flatMap(w => {
    const sets = (w.sets ?? []).filter(s => s.exerciseId === exerciseId && s.status === 'completed' && (!s.setType || s.setType === 'normal') && s.reps > 0 && typeof s.loadKg === 'number' && s.loadKg > 0);
    return sets.length ? [{ date: w.endedAt || w.startedAt, routine: w.routineName || 'Workout', sets, maxLoad: Math.max(...sets.map(s => s.loadKg!)), maxReps: Math.max(...sets.map(s => s.reps)) }] : [];
  }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function nextTrainingSuggestion(workouts: WorkoutSessionRecord[], exerciseId: string, equipment: string, goal: string, expectedSets: number, dietaryGoal?: string) {
  const history = exerciseHistory(workouts, exerciseId);
  const latest = history.at(-1);
  if (!latest) return 'Log a completed working set first to receive a suggestion.';
  const range = /strength/i.test(goal) ? [6, 8] : /endurance/i.test(goal) ? [12, 15] : [8, 12];
  const loads = new Set(latest.sets.map(s => s.loadKg));
  if (loads.size !== 1 || latest.sets.length < expectedSets) return 'Your last session used different loads or had incomplete working sets. Repeat a consistent load before considering an increase.';
  const weight = latest.sets[0].loadKg!;
  const minReps = Math.min(...latest.sets.map(s => s.reps));
  if (minReps < range[1]) return `Last working sets: ${weight} kg, minimum ${minReps} reps. Keep the load and work toward ${range[1]} reps in every working set.`;
  if (/weight loss|cut/i.test(dietaryGoal ?? '')) {
    const previous = history.at(-2);
    const confirmed = previous && previous.sets.length >= expectedSets && previous.sets.every(set => set.loadKg === weight && set.reps >= range[1]);
    if (!confirmed) return `You reached ${range[1]} reps. During your weight-loss phase, repeat this performance at ${weight} kg before considering an increase; maintaining strength is also progress.`;
  }
  if (/body.?weight|band|assisted|none/i.test(equipment)) return `You reached ${range[1]} reps in all recorded working sets. Consider a harder variation or a small added load when practical.`;
  const increment = /barbell/i.test(equipment) ? 2.5 : /dumbbell/i.test(equipment) ? 1 : null;
  if (!increment) return `You reached ${range[1]} reps in all working sets. Consider the smallest available equipment increment, then aim for ${range[0]}–${range[1]} reps.`;
  return `You reached ${range[1]} reps in all working sets. Consider ${weight + increment} kg next time (${/dumbbell/i.test(equipment) ? 'per dumbbell if logged per hand' : 'total bar load'}), starting around ${range[0]} reps. Use the smallest available increment.`;
}
