import { describe, expect, it } from 'vitest';
import { type DayData, planKept, questExp, questHistory, weekStart, weeklyChallenges } from '../src/activity/quests.js';

// 2026-11-23 is a Monday.
const data = (over: Partial<DayData> = {}): DayData => ({ workouts: new Set(), records: new Set(), active: new Set(), water: new Map(), mealsDone: () => false, ...over });

describe('weekly challenges', () => {
  it('are the same three for everyone and start from safe minimums', () => {
    expect(weeklyChallenges(data(), '2026-11-23', '2026-11-23').map(item => [item.key, item.target])).toEqual([['train', 2], ['hydrate', 3], ['meals', 3]]);
  });

  it('raise the target by one over last week, capped for recovery', () => {
    const lastWeek = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];
    const challenges = weeklyChallenges(data({ workouts: new Set(lastWeek), water: new Map(lastWeek.slice(0, 4).map(date => [date, 8])) }), '2026-11-23', '2026-11-23');
    expect(challenges[0]).toMatchObject({ target: 5, reason: 'Last week: 6 days' });
    expect(challenges[1].target).toBe(5);
  });
});

describe('plan weeks', () => {
  it('count only when every planned weekday had a workout', () => {
    const plan = { days: ['Monday', 'Wednesday'] };
    expect(planKept(plan, data({ workouts: new Set(['2026-11-23', '2026-11-25']) }), '2026-11-23', '2026-11-29')).toBe(true);
    expect(planKept(plan, data({ workouts: new Set(['2026-11-23', '2026-11-24']) }), '2026-11-23', '2026-11-29')).toBe(false);
    expect(planKept({ days: [] }, data({ workouts: new Set(['2026-11-23']) }), '2026-11-23', '2026-11-29')).toBe(false);
  });
});

describe('quest XP and history', () => {
  it('adds the points of every completed weekly challenge and counts kept plans', () => {
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
    expect(questExp(null, data(), '2026-11-25')).toBe(0);
    const trained = data({ workouts: new Set(['2026-11-23', '2026-11-24']), active: new Set(['2026-11-23', '2026-11-24']) });
    expect(questExp(null, trained, '2026-11-25')).toBe(200); // the 2-day training challenge
    expect(questHistory({ days: ['Monday', 'Tuesday'] }, trained, '2026-11-25')).toMatchObject({ planWeeks: 1, challengeWeeks: 0 });
  });
});
