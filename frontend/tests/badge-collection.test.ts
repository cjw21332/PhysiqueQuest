import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBadgeCollection } from '../sections/Quests Section/badgeProgress.ts';
import { BADGE_CATEGORIES, badgeMeta } from '../sections/Quests Section/badgeCatalog.ts';

const workout = (endedAt: string, sets: { exerciseId: string; loadKg: number; reps: number }[] = []) => ({
  _id: endedAt, status: 'completed', startedAt: endedAt, endedAt, timezone: 'UTC', durationSeconds: 1800,
  sets: sets.map((set, index) => ({ ...set, setId: `${endedAt}-${index}`, setIndex: index, status: 'completed', source: 'manual' })),
}) as never;

const base = {
  activity: { timezone: 'UTC', level: 3, activityDates: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'], questWeeks: { personal: 1, plan: 4, challenges: 0 } },
  saved: [], ranking: null, summary: null, nutrition: null,
} as never as Parameters<typeof buildBadgeCollection>[0];

test('every badge belongs to a real category and Best Form is gone', () => {
  const badges = buildBadgeCollection({ ...base, workouts: [], profile: { weight: '80', weightUnit: 'kg' } });
  assert.equal(new Set(badges.map(b => b.id)).size, badges.length);
  assert.ok(badges.length >= 60);
  assert.ok(!badges.some(b => b.id === 'best-form'));
  const categories = new Set(BADGE_CATEGORIES.map(c => c.id));
  for (const badge of badges) assert.ok(categories.has(badgeMeta(badge.id).category), badge.id);
  assert.equal(badges.filter(b => badgeMeta(b.id).category === 'personal').length, 7);
});

test('new badges are earned from real data', () => {
  const workouts = [
    workout('2026-10-01T10:00:00Z', [{ exerciseId: 'squat', loadKg: 100, reps: 10 }]),
    // 23 days later: a comeback, at night, on a Saturday followed by Sunday.
    workout('2026-10-24T21:30:00Z', [{ exerciseId: 'bench', loadKg: 60, reps: 10 }]),
    workout('2026-10-25T09:00:00Z', [{ exerciseId: 'row', loadKg: 50, reps: 10 }]),
  ];
  const badges = buildBadgeCollection({ ...base, workouts, profile: { weight: '74', weightUnit: 'kg', goal: 'Weight loss', targetWeight: '75' } });
  const earned = (id: string) => badges.find(b => b.id === id)?.earned;
  assert.equal(earned('seven-suns'), true);
  assert.equal(earned('weekend-vanguard'), true);
  assert.equal(earned('night-owl'), true);
  assert.equal(earned('phoenix'), true);
  assert.equal(badges.find(b => b.id === 'volume-10000')?.progress?.current, 2100);
  assert.equal(earned('oath-4'), true);
  assert.equal(earned('oath-12'), false);
  assert.equal(earned('self-made-1'), true);
  assert.equal(earned('summit'), true);
});

test('the summit stays unavailable without a target weight', () => {
  const badges = buildBadgeCollection({ ...base, workouts: [], profile: { weight: '80', weightUnit: 'kg', goal: 'General fitness' } });
  assert.equal(badges.find(b => b.id === 'summit')?.available, false);
});
