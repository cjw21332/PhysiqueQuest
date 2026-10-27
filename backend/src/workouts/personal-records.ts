import { activityDate } from './workout-contract.js';
type Session = { userId?: unknown; endedAt?: Date; timezone?: string; status?: string; sets?: { exerciseId: string; status: string; loadKg?: number; reps?: number }[] };
export function personalRecordDays(sessions: Session[], fallbackTimezone = 'UTC'): Map<string, Set<string>> {
  const best = new Map<string, number>(), days = new Map<string, Set<string>>();
  for (const session of [...sessions].sort((a, b) => Number(new Date(a.endedAt ?? 0)) - Number(new Date(b.endedAt ?? 0)))) {
    if (session.status !== 'completed' || !session.endedAt) continue;
    const owner = String(session.userId ?? ''), date = activityDate(session.endedAt, session.timezone || fallbackTimezone);
    const sessionBest = new Map<string, number>();
    for (const set of session.sets ?? []) {
      if (set.status !== 'completed' || !set.exerciseId || !Number.isFinite(set.loadKg) || !(set.loadKg! > 0) || !Number.isInteger(set.reps) || !(set.reps! > 0)) continue;
      const key = `${owner}:${set.exerciseId}`;
      sessionBest.set(key, Math.max(sessionBest.get(key) ?? 0, set.loadKg!));
    }
    for (const [key, load] of sessionBest) { const previous = best.get(key); if (previous !== undefined && load > previous) { if (!days.has(owner)) days.set(owner, new Set()); days.get(owner)!.add(date); } best.set(key, Math.max(previous ?? 0, load)); }
  }
  return days;
}
