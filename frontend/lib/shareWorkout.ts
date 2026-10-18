import type { WorkoutSessionRecord } from './api';
export function workoutShareText(workout: WorkoutSessionRecord) {
  const names = new Map(workout.exercises?.map(exercise => [exercise.exerciseId, exercise.name]) ?? []);
  const lines = (workout.sets ?? []).filter(set => set.status === 'completed').map(set =>
    `${names.get(set.exerciseId) ?? 'Exercise'}: ${set.durationSeconds === undefined ? `${set.reps} reps` : `${set.durationSeconds} seconds`}${set.loadKg === undefined ? '' : ` at ${set.loadKg} kg`}`);
  return ['PhysiqueQuest workout', `Duration: ${Math.floor((workout.durationSeconds ?? 0) / 60)} min ${(workout.durationSeconds ?? 0) % 60} sec`, ...lines].join('\n');
}
export async function shareWorkout(workout: WorkoutSessionRecord): Promise<string> {
  const text = workoutShareText(workout);
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage: (message: string) => void } }).ReactNativeWebView;
  if (bridge) {
    return new Promise(resolve => {
      const requestId = crypto.randomUUID();
      let timer: ReturnType<typeof setTimeout>;
      const finish = (notice: string) => { clearTimeout(timer); window.removeEventListener('physiquequest-share-result', result); resolve(notice); };
      const result = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.requestId === requestId) finish(detail.status === 'shared' ? 'Workout summary sent to the share sheet.' : detail.status === 'cancelled' ? '' : 'Sharing failed. Try again.'); };
      window.addEventListener('physiquequest-share-result', result);
      timer = setTimeout(() => finish('The share sheet did not respond. Try again.'), 120_000);
      try { bridge.postMessage(JSON.stringify({ type: 'share-workout', requestId, text })); }
      catch { finish('Sharing failed. Try again.'); }
    });
  }
  if (navigator.share) {
    try { await navigator.share({ title: 'PhysiqueQuest workout', text }); return ''; }
    catch (error) { if ((error as Error).name === 'AbortError') return ''; }
  }
  if (navigator.clipboard) { try { await navigator.clipboard.writeText(text); return 'Workout summary copied.'; } catch { /* Download fallback. */ } }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'physiquequest-workout.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Workout summary downloaded.';
}
