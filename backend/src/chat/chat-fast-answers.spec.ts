import { describe, expect, it } from 'vitest';
import { fastRecordAnswer, asksForPersonalRecord } from './chat-fast-answers.js';
const source = (id: string, data: unknown) => ({ id, label: 'Internal evidence', data });
describe('validated fast answers', () => {
  it('keeps goal, current weight and target weight independent', () => {
    const sources = [source('user-profile', { goal: null, weight: '72', targetWeight: null, weightUnit: 'kg' })];
    expect(fastRecordAnswer('What is my saved goal?', sources)?.reply).toBe('Your saved goal is unavailable.');
    expect(fastRecordAnswer('What is my current weight?', sources)?.reply).toContain('72 kg');
    expect(fastRecordAnswer('What is my target weight?', sources)?.reply).toBe('Your target weight is unavailable.');
  });
  it('distinguishes total XP, earned within-level XP and remaining XP', () => {
    const sources = [source('user-activity', { state: { level: 7, currentExp: 40, nextLevelExp: 100, totalExperience: 640, experienceToNextLevel: 60, dayStreak: 3 } })];
    expect(fastRecordAnswer('What is my total XP?', sources)?.reply).toContain('640');
    expect(fastRecordAnswer('What XP do I need for my next level?', sources)?.reply).toContain('60');
    expect(fastRecordAnswer('What is my XP within this level?', sources)?.reply).toContain('40 XP toward');
    expect(fastRecordAnswer('What is my level and streak?', sources)?.reply).toContain('3 days');
  });
  it('does not invent records or treat procedural help as a private-data request', () => {
    expect(fastRecordAnswer('What is my weight?', [])).toBeUndefined();
    expect(asksForPersonalRecord('How do I change my goal?')).toBe(false);
    expect(fastRecordAnswer('Why is my weight changing?', [source('user-profile', { weight: '72', weightUnit: 'kg' })])).toBeUndefined();
  });
  it('reports only supplied latest measurements with their actual units', () => {
    const answer = fastRecordAnswer('What is my latest waist measurement?', [source('user-progress', { measurements: [{ metric: 'waist', value: 83, unit: 'cm', measuredAt: '2026-10-29' }] })]);
    expect(answer?.reply).toContain('83 cm'); expect(answer?.reply).toContain('2026-10-29');
    expect(answer?.reply).not.toContain('Sources:');
  });
  it('answers body measurements, notification counts and reminder times exactly', () => {
    expect(fastRecordAnswer('What is my waist?', [source('user-profile', { waist: '83', waistUnit: 'cm' })])?.reply).toContain('83 cm');
    const notices = [source('user-notifications', { unreadCount: 2, reminder: { enabled: true, hour: 9, minute: 5, timezone: 'Asia/Singapore' } })];
    expect(fastRecordAnswer('How many unread notifications do I have in my account?', notices)?.reply).toContain('2');
    expect(fastRecordAnswer('When is my reminder?', notices)?.reply).toContain('09:05');
  });
});
