import { describe, expect, it } from 'vitest';
import { bodyMassIndex, fitnessTier } from './body-index.js';
import { weeklyChallenges, type DayData } from '../activity/quests.js';
import { CoachPlanner } from '../coach/coach-planner.js';

describe('body index', () => {
  it('computes BMI in metric and imperial units', () => {
    expect(bodyMassIndex({ height: '180', heightUnit: 'cm', weight: '81', weightUnit: 'kg' })).toBeCloseTo(25, 1);
    expect(bodyMassIndex({ height: '5', heightInches: '11', heightUnit: 'ft & in.', weight: '180', weightUnit: 'lbs' })).toBeCloseTo(25.1, 1);
    expect(bodyMassIndex({ height: '', weight: '70' })).toBeNull();
  });
  it('places users in tiers by activity and BMI', () => {
    expect(fitnessTier({ height: '170', weight: '95', activity: 'Active' })).toBe('starter');
    expect(fitnessTier({ height: '175', weight: '70', activity: 'Sedentary' })).toBe('starter');
    expect(fitnessTier({ height: '175', weight: '70', activity: 'Athlete' })).toBe('advanced');
    expect(fitnessTier({ height: '175', weight: '70', activity: 'Moderate' })).toBe('building');
    expect(fitnessTier(null)).toBe('building');
  });
});

describe('tiered weekly quests', () => {
  const empty: DayData = { workouts: new Set(), records: new Set(), active: new Set(), water: new Map(), mealsDone: () => false };
  it('sets a lower starting training target for starters and a higher one for advanced users', () => {
    const train = (tier: 'starter' | 'building' | 'advanced') => weeklyChallenges(empty, '2026-11-23', '2026-11-27', tier).find(item => item.key === 'train')!.target;
    expect([train('starter'), train('building'), train('advanced')]).toEqual([1, 2, 3]);
  });
});

describe('tiered coach intensity', () => {
  const library = [{ id: '1', name: 'Box Jump', group: 'legs', targetMuscle: 'quads', equipment: 'body weight', pose: '', instructions: [] }];
  it('lowers sets for starters and raises them for advanced users', () => {
    const base = { goal: 'Build muscle', age: '25', days: ['Monday'], height: '175' };
    expect(new CoachPlanner().build({ ...base, weight: '100', activity: 'Moderate' }, library).sets).toBe('2 × 10');
    expect(new CoachPlanner().build({ ...base, weight: '70', activity: 'Athlete' }, library).sets).toBe('4 × 10');
    expect(new CoachPlanner().build({ ...base, weight: '70', activity: 'Moderate' }, library).sets).toBe('3 × 10');
  });
});
