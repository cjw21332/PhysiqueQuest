/**
 * Progressive personal quests built from the user's own training log. Three slots run in parallel:
 * beat a record in one exercise, add a rep to every exercise of a routine, and out-lift your best
 * session volume. Completing a quest immediately generates the next one in that slot from the new
 * best, one level harder, so the chain never ends.
 */
export type LogSet = { exerciseId?: string; reps?: number; loadKg?: number; status?: string; setType?: string };
export type LogSession = { endedAt?: Date | string; routineName?: string; exercises?: { exerciseId: string; name: string }[]; sets?: LogSet[] };
export type Slot = 'record' | 'routine' | 'volume';
type Spec =
  | { kind: 'record'; exerciseId: string; name: string; bestLoad: number; bestReps: number }
  | { kind: 'routine'; routine: string; baseline: { exerciseId: string; name: string; reps: number; load: number }[] }
  | { kind: 'volume'; best: number }
  | { kind: 'starter' };
export type ChainQuest = { slot: Slot; level: number; createdAt: string; title: string; reason: string; target: number; points: number; spec: Spec };
/** A finished quest. slot and level are absent on entries saved before v1.6.3. */
export type ChainLogEntry = { title: string; points: number; completedAt: string; slot?: Slot; level?: number };
export type ChainState = { version: number; completed: number; xp: number; quests: ChainQuest[]; recent: ChainLogEntry[] };
/** Finished quests kept for the View all page; older ones still count in `completed` and `xp`. */
export const MAX_QUEST_HISTORY = 100;
export type ChainView = { key: string; title: string; reason: string; target: number; progress: number; points: number; complete: boolean; level: number };

const SLOTS: Slot[] = ['record', 'routine', 'volume'];
const BASE_POINTS: Record<Slot, number> = { record: 150, routine: 200, volume: 150 };
const time = (value: Date | string | undefined) => value ? new Date(value).getTime() : NaN;
const kg = (value: number) => `${Number(value.toFixed(1))} kg`;

/** Completed working sets with a positive rep count; warm-ups never count. */
function workingSets(session: LogSession) {
  return (session.sets ?? []).filter(set => set.status === 'completed' && set.exerciseId && (set.reps ?? 0) > 0 && set.setType !== 'warmup');
}
const loadOf = (set: LogSet) => Number.isFinite(set.loadKg) && (set.loadKg ?? 0) > 0 ? set.loadKg! : 0;
const nameOf = (sessions: LogSession[], exerciseId: string) => {
  for (let i = sessions.length - 1; i >= 0; i--) { const found = sessions[i].exercises?.find(item => item.exerciseId === exerciseId); if (found?.name) return found.name; }
  return 'this exercise';
};
const volumeOf = (session: LogSession) => workingSets(session).reduce((sum, set) => sum + loadOf(set) * (set.reps ?? 0), 0);
const after = (sessions: LogSession[], since: string) => sessions.filter(session => time(session.endedAt) > time(since));
const titleCase = (text: string) => text.replace(/\b\w/g, letter => letter.toUpperCase());

function points(slot: Slot, level: number) { return BASE_POINTS[slot] + Math.min(150, 25 * (level - 1)); }

/** Builds the next quest for a slot from the full log, rotating away from the previous exercise or routine. */
export function generateQuest(slot: Slot, level: number, sessions: LogSession[], now: string, previous?: Spec): ChainQuest {
  const base = { slot, level, createdAt: now, points: points(slot, level) };
  if (slot === 'record') {
    const bests = new Map<string, { load: number; reps: number; sessions: number }>();
    for (const session of sessions) {
      const seen = new Set<string>();
      for (const set of workingSets(session)) {
        const load = loadOf(set); if (!load) continue;
        const best = bests.get(set.exerciseId!) ?? { load: 0, reps: 0, sessions: 0 };
        if (load > best.load || (load === best.load && set.reps! > best.reps)) { best.load = load; best.reps = set.reps!; }
        if (!seen.has(set.exerciseId!)) { best.sessions++; seen.add(set.exerciseId!); }
        bests.set(set.exerciseId!, best);
      }
    }
    const ranked = [...bests].sort((a, b) => b[1].sessions - a[1].sessions || b[1].load - a[1].load);
    const skip = previous?.kind === 'record' && ranked.length > 1 ? previous.exerciseId : undefined;
    const pick = ranked.find(([id]) => id !== skip);
    if (!pick) return { ...base, points: 100, title: 'Log a weighted set to unlock record quests', reason: 'Record quests are built from the loads you lift', target: 1, spec: { kind: 'starter' } };
    const [exerciseId, best] = pick, name = titleCase(nameOf(sessions, exerciseId));
    return { ...base, title: `Beat your record in ${name}`, reason: `Best: ${kg(best.load)} × ${best.reps}. Lift heavier, or do ${best.reps + 1}+ reps at ${kg(best.load)}`, target: 1, spec: { kind: 'record', exerciseId, name, bestLoad: best.load, bestReps: best.reps } };
  }
  if (slot === 'routine') {
    const routines = sessions.filter(session => session.routineName && workingSets(session).length).reverse();
    const skip = previous?.kind === 'routine' ? previous.routine : undefined;
    const last = routines.find(session => session.routineName !== skip) ?? routines[0];
    if (!last) return { ...base, points: 100, title: 'Finish a full routine from your plan', reason: 'Routine quests build on what you did last time', target: 1, spec: { kind: 'starter' } };
    const byExercise = new Map<string, { reps: number; load: number }>();
    for (const set of workingSets(last)) {
      const current = byExercise.get(set.exerciseId!), load = loadOf(set);
      if (!current || load > current.load || (load === current.load && set.reps! > current.reps)) byExercise.set(set.exerciseId!, { reps: set.reps!, load });
    }
    const baseline = [...byExercise].map(([exerciseId, best]) => ({ exerciseId, name: nameOf([last], exerciseId), ...best }));
    const routine = titleCase(last.routineName!);
    return { ...base, title: `One more rep on every exercise in ${routine}`, reason: `Last time: ${baseline.length} ${baseline.length === 1 ? 'exercise' : 'exercises'}. Beat each one by a rep at the same weight or more`, target: baseline.length, spec: { kind: 'routine', routine: last.routineName!, baseline } };
  }
  const best = Math.max(0, ...sessions.map(volumeOf));
  if (!best) return { ...base, points: 100, title: 'Complete a workout with weights', reason: 'Volume quests grow from your heaviest session', target: 1, spec: { kind: 'starter' } };
  const target = Math.max(best + 50, Math.ceil(best * 1.05 / 50) * 50);
  return { ...base, title: `Move ${target.toLocaleString('en-US')} kg in a single workout`, reason: `Your best session: ${Math.round(best).toLocaleString('en-US')} kg (load × reps)`, target, spec: { kind: 'volume', best } };
}

/** Progress made since the quest was created. */
export function progressOf(quest: ChainQuest, sessions: LogSession[]) {
  const recent = after(sessions, quest.createdAt);
  const spec = quest.spec;
  if (spec.kind === 'starter') {
    if (quest.slot === 'record') return Number(recent.some(session => workingSets(session).some(set => loadOf(set) > 0)));
    if (quest.slot === 'routine') return Number(recent.some(session => session.routineName && workingSets(session).length));
    return Number(recent.some(session => volumeOf(session) > 0));
  }
  if (spec.kind === 'record') return Number(recent.some(session => workingSets(session).some(set => set.exerciseId === spec.exerciseId && (loadOf(set) > spec.bestLoad || (loadOf(set) >= spec.bestLoad && set.reps! > spec.bestReps)))));
  if (spec.kind === 'routine') return Math.max(0, ...recent.filter(session => session.routineName === spec.routine).map(session => {
    const sets = workingSets(session);
    return spec.baseline.filter(base => sets.some(set => set.exerciseId === base.exerciseId && loadOf(set) >= base.load && set.reps! >= base.reps + 1)).length;
  }));
  return Math.round(Math.max(0, ...recent.map(volumeOf)));
}

/**
 * Fills empty slots, completes any finished quest (awarding XP and generating the next, harder one)
 * and returns the new state plus what to show. `changed` tells the caller whether to save.
 */
export function advanceChain(stored: ChainState | undefined, sessions: LogSession[], now: string) {
  const ordered = [...sessions].filter(session => Number.isFinite(time(session.endedAt))).sort((a, b) => time(a.endedAt) - time(b.endedAt));
  const state: ChainState = stored ? { ...stored, quests: [...stored.quests], recent: [...stored.recent] } : { version: 0, completed: 0, xp: 0, quests: [], recent: [] };
  let changed = !stored;
  const view: ChainView[] = [];
  for (const slot of SLOTS) {
    let quest = state.quests.find(item => item.slot === slot);
    if (!quest) { quest = generateQuest(slot, 1, ordered, now); state.quests.push(quest); changed = true; }
    if (progressOf(quest, ordered) >= quest.target) {
      state.completed++; state.xp += quest.points;
      state.recent = [{ title: quest.title, points: quest.points, completedAt: now, slot, level: quest.level }, ...state.recent].slice(0, MAX_QUEST_HISTORY);
      const next = generateQuest(slot, quest.level + 1, ordered, now, quest.spec);
      state.quests = state.quests.map(item => item.slot === slot ? next : item);
      quest = next; changed = true;
    }
    view.push({ key: slot, title: quest.title, reason: quest.reason, target: quest.target, progress: Math.min(progressOf(quest, ordered), quest.target), points: quest.points, complete: false, level: quest.level });
  }
  if (changed) state.version = (stored?.version ?? 0) + 1;
  return { state, changed, view };
}
