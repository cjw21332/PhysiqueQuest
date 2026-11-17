import type { WorkoutSessionRecord } from './api';

/** Completed working sets, including bodyweight sets where no load was logged. */
export function exerciseAnalytics(workouts: WorkoutSessionRecord[], exerciseId: string) {
  return workouts.filter(workout => workout.status === 'completed').flatMap(workout => {
    const sets = (workout.sets ?? []).filter(set => set.exerciseId === exerciseId && set.status === 'completed' && (!set.setType || set.setType === 'normal') && set.reps > 0);
    if (!sets.length) return [];
    const weighted = sets.filter(set => typeof set.loadKg === 'number' && set.loadKg > 0);
    return [{ date: workout.endedAt || workout.startedAt, sets, maxLoad: weighted.length ? Math.max(...weighted.map(set => set.loadKg!)) : null, maxReps: Math.max(...sets.map(set => set.reps)), volumeKg: weighted.length ? weighted.reduce((sum, set) => sum + set.loadKg! * set.reps, 0) : null }];
  }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function exerciseHistory(workouts: WorkoutSessionRecord[], exerciseId: string) {
  return workouts.filter(w => w.status === 'completed').flatMap(w => {
    const sets = (w.sets ?? []).filter(s => s.exerciseId === exerciseId && s.status === 'completed' && (!s.setType || s.setType === 'normal') && s.reps > 0 && typeof s.loadKg === 'number' && s.loadKg > 0).sort((a, b) => a.setIndex - b.setIndex);
    return sets.length ? [{ date: w.endedAt || w.startedAt, routine: w.routineName || 'Workout', equipment: w.exercises?.find(item => item.exerciseId === exerciseId)?.equipment ?? '', sets, maxLoad: Math.max(...sets.map(s => s.loadKg!)), maxReps: Math.max(...sets.map(s => s.reps)) }] : [];
  }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/** A starting point, never a saved set. Weight is the entered load, excluding a known bar. */
export function suggestedWorkingSet(workouts: WorkoutSessionRecord[], exerciseId: string, equipment: string, sessionAt: string, usesBar = false, workingSetIndex?: number) {
  const at = Date.parse(sessionAt);
  if (!Number.isFinite(at)) return null;
  const latest = exerciseAnalytics(workouts, exerciseId).filter(row => Number.isFinite(Date.parse(row.date)) && Date.parse(row.date) <= at).at(-1);
  if (!latest) return null;
  const ordered = [...latest.sets].sort((a, b) => a.setIndex - b.setIndex);
  const last = workingSetIndex === undefined ? ordered.at(-1)! : ordered[Math.min(Math.max(0, workingSetIndex), ordered.length - 1)];
  const elapsed = at - Date.parse(latest.date);
  const bodyweight = /body\s*weight|bodyweight|none/i.test(equipment);
  const loadKg = last.loadKg;
  // Older bar records may include a bar without recording its weight. Do not
  // silently treat that total as added plates.
  const canSuggestLoad = typeof loadKg === 'number' && loadKg >= 0 && (!usesBar || last.barWeightKg !== undefined);
  const addedKg = canSuggestLoad ? Math.max(0, loadKg - (last.barWeightKg ?? 0)) : undefined;
  const longBreak = elapsed >= 14 * 24 * 60 * 60 * 1000;
  const suggestedKg = addedKg === undefined || bodyweight ? undefined : longBreak ? Math.floor(addedKg * .9 * 2) / 2 : addedKg;
  return {
    reps: last.reps,
    weightKg: suggestedKg,
    preferredUnit: last.loadUnit,
    note: elapsed < 48 * 60 * 60 * 1000 ? 'Less than 48 hours since your last session. Consider more rest.' : longBreak ? 'A lighter starting load after your break.' : 'Based on your last working sets.',
    unknownBar: usesBar && !canSuggestLoad,
  };
}

export function nextTrainingSuggestion(workouts: WorkoutSessionRecord[], exerciseId: string, equipment: string, goal: string, expectedSets: number, dietaryGoal?: string, sessionAt = new Date().toISOString()) {
  const sessionTime = Date.parse(sessionAt);
  const history = exerciseHistory(workouts, exerciseId).filter(row => Number.isFinite(Date.parse(row.date)) && (!Number.isFinite(sessionTime) || Date.parse(row.date) <= sessionTime));
  const latest = history.at(-1);
  if (!latest) return 'Log a completed working set first to receive a suggestion.';
  const range = /strength/i.test(goal) ? [6, 8] : /endurance/i.test(goal) ? [12, 15] : [8, 12];
  const last = latest.sets[latest.sets.length - 1];
  const unit = last.loadUnit === 'lbs' && last.loadValue !== undefined ? 'lbs' : 'kg';
  const addedKg = last.loadKg! - (last.barWeightKg ?? 0);
  const displayedWeight = last.barWeightKg !== undefined ? addedKg * (unit === 'lbs' ? 2.2046226218 : 1) : unit === 'lbs' ? last.loadValue! : last.loadKg!;
  const weightLabel = `${Number(displayedWeight.toFixed(2))} ${unit}${last.barWeightKg !== undefined ? ' added plates' : ''}`;
  const elapsed = Number.isFinite(sessionTime) ? sessionTime - Date.parse(latest.date) : NaN;
  const loadBasis = last.barWeightKg !== undefined || /added plates only/i.test(latest.equipment) ? ` This is added plate weight, excluding the bar${last.barWeightKg !== undefined ? ` (estimated ${last.barWeightKg} kg)` : ''}.` : /assumed|estimated/i.test(latest.equipment) ? ` ${latest.equipment}; confirm the actual bar weight before choosing a load.` : '';
  const baseline = `Last set: ${weightLabel} × ${last.reps} reps.${loadBasis} `;
  if (Number.isFinite(elapsed) && elapsed < 48 * 60 * 60 * 1000) return `${baseline}Less than 48 hours since your last session: consider more rest. If training, start with up to ${last.reps} reps at ${weightLabel}.`;
  if (Number.isFinite(elapsed) && elapsed >= 14 * 24 * 60 * 60 * 1000) return `${baseline}After a longer break, start lighter than ${weightLabel}, for up to ${last.reps} reps.`;
  const loads = new Set(latest.sets.map(s => s.loadKg));
  if (loads.size !== 1 || latest.sets.length < expectedSets) return `${baseline}Try ${weightLabel} for ${last.reps} reps again before increasing.`;
  const weight = latest.sets[0].loadKg!;
  const minReps = Math.min(...latest.sets.map(s => s.reps));
  if (minReps < range[1]) return `${baseline}Keep ${weightLabel}; aim for ${minReps}–${range[1]} reps per set.`;
  if (history.length === 1) return `${baseline}Start with ${weightLabel} and aim for ${minReps} reps again. One session does not show how difficult the sets felt; repeat it before considering an increase.`;
  if (/weight loss|cut/i.test(dietaryGoal ?? '')) {
    const previous = history.at(-2);
    const confirmed = previous && previous.sets.length >= expectedSets && previous.sets.every(set => set.loadKg === weight && set.reps >= range[1]);
    if (!confirmed) return `You reached ${range[1]} reps. During your weight-loss phase, repeat this performance at ${weightLabel} before considering an increase; maintaining strength is also progress.`;
  }
  if (/body.?weight|band|assisted|none/i.test(equipment)) return `You reached ${range[1]} reps in all recorded working sets. Consider a harder variation or a small added load when practical.`;
  const increment = /barbell/i.test(equipment) ? 2.5 : /dumbbell/i.test(equipment) ? 1 : null;
  if (!increment) return `You reached ${range[1]} reps in all working sets. Consider the smallest available equipment increment, then aim for ${range[0]}–${range[1]} reps.`;
  const suggested = unit === 'lbs' ? Number(((weight + increment - (last.barWeightKg ?? 0)) * 2.2046226218).toFixed(1)) : Number((weight + increment - (last.barWeightKg ?? 0)).toFixed(2));
  return `You reached ${range[1]} reps in all working sets. Consider ${suggested} ${unit} next time (${last.barWeightKg !== undefined ? 'added plates, excluding the estimated bar' : /dumbbell/i.test(equipment) ? 'per dumbbell if logged per hand' : 'total bar load'}), starting around ${range[0]} reps. Use the smallest available increment.`;
}
