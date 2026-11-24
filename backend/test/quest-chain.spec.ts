import { describe, expect, it } from 'vitest';
import { advanceChain, generateQuest, type LogSession } from '../src/activity/quest-chain.js';

const session = (endedAt: string, routineName: string, sets: [string, number, number][]): LogSession => ({
  endedAt, routineName,
  exercises: [...new Set(sets.map(([id]) => id))].map(exerciseId => ({ exerciseId, name: exerciseId.replace(/-/g, ' ') })),
  sets: sets.map(([exerciseId, loadKg, reps]) => ({ exerciseId, loadKg, reps, status: 'completed', setType: 'normal' })),
});
const upper = (endedAt: string, bench: [number, number], row: [number, number]) => session(endedAt, 'upper body circuit', [['bench-press', ...bench], ['dumbbell-row', ...row]]);

describe('personal quest chain', () => {
  it('starts with starter quests when there is no training log', () => {
    const { view, changed } = advanceChain(undefined, [], '2026-11-25T00:00:00.000Z');
    expect(changed).toBe(true);
    expect(view.map(quest => quest.title)).toEqual(['Log a weighted set to unlock record quests', 'Finish a full routine from your plan', 'Complete a workout with weights']);
  });

  it('builds quests from real exercises, routines and session volume', () => {
    const log = [upper('2026-11-20T10:00:00Z', [40, 12], [20, 10])];
    const { view } = advanceChain(undefined, log, '2026-11-21T00:00:00.000Z');
    expect(view[0]).toMatchObject({ key: 'record', title: 'Beat your record in Bench Press', reason: expect.stringContaining('40 kg × 12'), level: 1 });
    expect(view[1]).toMatchObject({ key: 'routine', title: 'One more rep on every exercise in Upper Body Circuit', target: 2, progress: 0 });
    // Best session: 40×12 + 20×10 = 680 kg; next target is 5% above, rounded up to 50.
    expect(view[2]).toMatchObject({ key: 'volume', title: 'Move 750 kg in a single workout', target: 750 });
  });

  it('completes a quest, awards XP and immediately sets a harder one from the new best', () => {
    const before = [upper('2026-11-20T10:00:00Z', [40, 12], [20, 10])];
    const first = advanceChain(undefined, before, '2026-11-21T00:00:00.000Z');
    // Next session: one more rep on both exercises, and a heavier bench.
    const log = [...before, upper('2026-11-23T10:00:00Z', [42.5, 12], [20, 11])];
    const next = advanceChain(first.state, log, '2026-11-23T12:00:00.000Z');
    expect(next.changed).toBe(true);
    // Bench 42.5 kg beats the record; the routine is 1 of 2 (bench kept 12 reps); 730 kg misses the 750 kg volume target.
    expect(next.state.completed).toBe(1);
    expect(next.state.recent[0].title).toBeTruthy();
    const routine = next.view.find(quest => quest.key === 'routine')!;
    expect(routine).toMatchObject({ level: 1, progress: 1, target: 2 });
    expect(next.view[2]).toMatchObject({ level: 1, progress: 730 });
    expect(next.state.xp).toBeGreaterThan(0);
    // The record quest rotates to the other exercise once Bench Press was beaten.
    expect(next.view[0]).toMatchObject({ title: 'Beat your record in Dumbbell Row', level: 2, points: 175 });
  });

  it('does not count sessions from before the quest was created', () => {
    const log = [upper('2026-11-20T10:00:00Z', [40, 12], [20, 10]), upper('2026-11-22T10:00:00Z', [45, 12], [25, 12])];
    const { view } = advanceChain(undefined, log, '2026-11-23T00:00:00.000Z');
    expect(view.every(quest => quest.progress === 0)).toBe(true);
  });

  it('ignores warm-up sets', () => {
    const quest = generateQuest('record', 1, [session('2026-11-20T10:00:00Z', 'legs', [['squat', 60, 5]])], '2026-11-21T00:00:00.000Z');
    const warmup: LogSession = { endedAt: '2026-11-22T10:00:00Z', routineName: 'legs', sets: [{ exerciseId: 'squat', loadKg: 80, reps: 5, status: 'completed', setType: 'warmup' }] };
    expect(advanceChain({ version: 1, completed: 0, xp: 0, quests: [quest, generateQuest('routine', 1, [], quest.createdAt), generateQuest('volume', 1, [], quest.createdAt)], recent: [] }, [warmup], '2026-11-22T12:00:00.000Z').view[0].progress).toBe(0);
  });
});
