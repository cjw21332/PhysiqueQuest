import { describe, expect, it } from 'vitest';
import { type DayData, personalQuests, questExp, weekStart, weeklyChallenges } from '../src/activity/quests.js';

// 2026-11-23 is a Monday.
const data = (over: Partial<DayData> = {}): DayData => ({ workouts: new Set(), records: new Set(), active: new Set(), water: new Map(), protein: new Map(), mealsDone: () => false, ...over });
const keys = (quests: { key: string }[]) => quests.map(quest => quest.key);
const lifter = { age: '25', weight: '80', weightUnit: 'kg', goal: 'Build muscle', days: ['Monday', 'Wednesday', 'Friday'] };

describe('personal quests', () => {
  it('needs a profile', () => expect(personalQuests(null, data(), '2026-11-23', '2026-11-25')).toEqual([]));

  it('follows the training plan, body weight and goal', () => {
    const quests = personalQuests(lifter, data({ workouts: new Set(['2026-11-23', '2026-11-25']), protein: new Map([['2026-11-23', 130]]) }), '2026-11-23', '2026-11-25');
    expect(quests[0]).toMatchObject({ key: 'plan', target: 3, progress: 2, complete: false });
    expect(quests[1]).toMatchObject({ key: 'protein', title: 'Reach 130 g of protein on 4 days', progress: 1 });
    expect(quests[2].key).toBe('record');
    // 180 lbs ≈ 81.6 kg → 130 g
    expect(personalQuests({ ...lifter, weight: '180', weightUnit: 'lbs' }, data(), '2026-11-23', '2026-11-23')[1].title).toContain('130 g');
  });

  it('differs by goal, age and consented health data', () => {
    expect(keys(personalQuests({ ...lifter, goal: 'Weight loss' }, data(), '2026-11-23', '2026-11-23'))).toEqual(['plan', 'hydration', 'record']);
    expect(personalQuests({ ...lifter, goal: 'Endurance' }, data(), '2026-11-23', '2026-11-23')[1]).toMatchObject({ key: 'active', target: 6 });
    expect(keys(personalQuests({ ...lifter, age: '52' }, data(), '2026-11-23', '2026-11-23'))).toEqual(['plan', 'protein', 'recovery']);
    expect(keys(personalQuests({ ...lifter, injuries: ['Knee injury'] }, data(), '2026-11-23', '2026-11-23'))).toEqual(['plan', 'protein', 'record']);
    expect(keys(personalQuests({ ...lifter, injuries: ['Knee injury'], healthConsentAt: new Date() }, data(), '2026-11-23', '2026-11-23'))).toEqual(['plan', 'active', 'recovery']);
    expect(personalQuests({ ...lifter, age: '16' }, data(), '2026-11-23', '2026-11-23')[1].key).toBe('active');
  });

  it('counts only finished days as rest days', () => {
    const recovery = personalQuests({ ...lifter, age: '60' }, data({ workouts: new Set(['2026-11-23']) }), '2026-11-23', '2026-11-25')[2];
    expect(recovery).toMatchObject({ key: 'recovery', progress: 1, complete: false });
  });
});

describe('weekly challenges', () => {
  it('are the same three for everyone and start from safe minimums', () => {
    expect(weeklyChallenges(data(), '2026-11-23', '2026-11-23').map(item => [item.key, item.target])).toEqual([['train', 2], ['hydrate', 3], ['meals', 3]]);
  });

  it('raise the target by one over last week, capped for recovery', () => {
    const lastWeek = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];
    const challenges = weeklyChallenges(data({ workouts: new Set(lastWeek), water: new Map(lastWeek.slice(0, 4).map(date => [date, 8])) }), '2026-11-23', '2026-11-23');
    expect(challenges[0].target).toBe(5);
    expect(challenges[1].target).toBe(5);
  });
});

describe('quest XP', () => {
  it('adds the points of every completed quest and challenge', () => {
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
    expect(questExp(null, data(), '2026-11-25')).toBe(0);
    const trained = data({ workouts: new Set(['2026-11-23', '2026-11-24']), active: new Set(['2026-11-23', '2026-11-24']) });
    expect(questExp(null, trained, '2026-11-25')).toBe(200); // the 2-day training challenge
    expect(questExp({ ...lifter, days: ['Monday', 'Tuesday'] }, trained, '2026-11-25')).toBe(400); // plus the 2-day plan quest
  });
});
