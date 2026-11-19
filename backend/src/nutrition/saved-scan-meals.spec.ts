import { describe, expect, it } from 'vitest';
import { savedScanMealDates } from './saved-scan-meals.js';

describe('saved scan meal counting', () => {
  it('groups legacy scan rows by receipt even when saved timestamps differ', () => {
    const meals = [
      { id: 'a', date: '2026-11-18', scanSavedAt: '2026-11-18T01:00:00.000Z' },
      { id: 'b', date: '2026-11-18', scanSavedAt: '2026-11-18T01:00:00.010Z' },
      { id: 'manual', date: '2026-11-18' },
    ];
    expect(savedScanMealDates(meals, [{ key: 'save-1', mealIds: ['a', 'b'] }])).toEqual(['2026-11-18']);
  });

  it('counts separate confirmed saves even when they share a date and timestamp', () => {
    const scanSavedAt = new Date('2026-11-18T01:00:00Z');
    expect(savedScanMealDates([
      { date: '2026-11-18', scanSavedAt, scanGroupId: 'one' },
      { date: '2026-11-18', scanSavedAt, scanGroupId: 'one' },
      { date: '2026-11-18', scanSavedAt, scanGroupId: 'two' },
    ])).toEqual(['2026-11-18', '2026-11-18']);
  });

  it('groups unkeyed historical rows with the same saved timestamp', () => {
    expect(savedScanMealDates([
      { date: '2026-11-18', scanSavedAt: '2026-11-18T01:00:00Z' },
      { date: '2026-11-18', scanSavedAt: '2026-11-18T01:00:00Z' },
    ])).toEqual(['2026-11-18']);
  });
});
