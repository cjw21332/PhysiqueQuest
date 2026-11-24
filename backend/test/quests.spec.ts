import { describe, expect, it } from 'vitest';
import { type DayData, personalQuests, questExp, questHistory, weekStart, weeklyChallenges } from '../src/activity/quests.js';

// 2026-11-23 is a Monday.
const data = (over: Partial<DayData> = {}): DayData => ({ workouts: new Set(), records: new Set(), active: new Set(), water: new Map(), protein: new Map(), mealsDone: () => false, ...over });
const keys = (quests: { key: string }[]) => quests.map(quest => quest.key);
const lifter = { age: '25', weight: '80', weightUnit: 'kg', goal: 'Build muscle', days: ['Monday', 'Wednesday', 'Friday'] };

describe('personal quests', () => {
  it('needs a profile', () => expect(personalQuests(null, data(), '2026-11-23', '2026-11-25')).toEqual([]));

  it('counts only workouts on the planned weekdays and explains why each quest is yours', () => {
    // Mon 23 is planned, Tue 24 is not.
    const quests = personalQuests(lifter, data({ workouts: new Set(['2026-11-23', '2026-11-24']), protein: new Map([['2026-11-23', 130]]) }), '2026-11-23', '2026-11-25');
    expect(keys(quests)).toEqual(['plan', 'protein', 'weigh-in']);
    expect(quests[0]).toMatchObject({ target: 3, progress: 1, reason: 'You planned Mon · Wed · Fri' });
    expect(quests[1]).toMatchObject({ title: 'Hit 130 g of protein on 4 days', progress: 1 });
    expect(quests.every(item => item.reason)).toBe(true);
  });

  it('never repeats a daily mission or weekly challenge, whatever the goal', () => {
    const shared = new Set(['workout', 'meals', 'water', 'personal-record', 'train', 'hydrate']);
    for (const goal of ['Build muscle', 'Strength', 'Weight loss', 'Endurance', 'General fitness'])
      for (const age of ['16', '25', '52'])
        for (const item of personalQuests({ ...lifter, goal, age }, data({ calorieTarget: 2000 }), '2026-11-23', '2026-11-25')) expect(shared.has(item.key)).toBe(false);
  });

  it('follows the goal: calories, back-to-back training or steady activity', () => {
    const loss = personalQuests({ ...lifter, goal: 'Weight loss' }, data({ calorieTarget: 2000, calories: new Map([['2026-11-23', 1800], ['2026-11-24', 2500]]) }), '2026-11-23', '2026-11-25');
    expect(loss[1]).toMatchObject({ key: 'calories', progress: 1, reason: 'Your plan: 2,000 kcal a day' });
    expect(personalQuests({ ...lifter, goal: 'Weight loss' }, data(), '2026-11-23', '2026-11-23')[1]).toMatchObject({ key: 'active', reason: expect.stringMatching(/dietary plan/) });
    expect(personalQuests({ ...lifter, goal: 'Endurance' }, data({ workouts: new Set(['2026-11-23', '2026-11-24']) }), '2026-11-23', '2026-11-25')[1]).toMatchObject({ key: 'back-to-back', complete: true });
    expect(personalQuests({ ...lifter, age: '16' }, data(), '2026-11-23', '2026-11-23')[1].key).toBe('active');
  });

  it('adds rest for age 35+ or consented health risks, and tracks weigh-ins', () => {
    expect(personalQuests({ ...lifter, age: '52' }, data(), '2026-11-23', '2026-11-23').at(-1)).toMatchObject({ key: 'recovery', reason: 'Recovery matters more from age 35' });
    expect(keys(personalQuests({ ...lifter, injuries: ['Knee injury'] }, data(), '2026-11-23', '2026-11-23'))).not.toContain('recovery');
    expect(personalQuests({ ...lifter, injuries: ['Knee injury'], healthConsentAt: new Date() }, data(), '2026-11-23', '2026-11-23').at(-1)).toMatchObject({ key: 'recovery', reason: 'Because of your health profile' });
    const weighIn = personalQuests({ ...lifter, targetWeight: '75' }, data({ weighIns: new Set(['2026-11-24']) }), '2026-11-23', '2026-11-25').find(item => item.key === 'weigh-in');
    expect(weighIn).toMatchObject({ complete: true, reason: 'Track the way to 75 kg' });
  });

  it('counts only finished days as rest days', () => {
    const recovery = personalQuests({ ...lifter, age: '60' }, data({ workouts: new Set(['2026-11-23']) }), '2026-11-23', '2026-11-25').find(item => item.key === 'recovery');
    expect(recovery).toMatchObject({ progress: 1, complete: false });
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
  it('counts the weeks each quest set was fully completed', () => {
    const trained = data({ workouts: new Set(['2026-11-23', '2026-11-24']), active: new Set(['2026-11-23', '2026-11-24']) });
    const history = questHistory({ age: '25', goal: 'General fitness', days: ['Monday', 'Tuesday'] }, trained, '2026-11-25');
    expect(history).toMatchObject({ planWeeks: 1, personalWeeks: 0, challengeWeeks: 0 });
  });
});
