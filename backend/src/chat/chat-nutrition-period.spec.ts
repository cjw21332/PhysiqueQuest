import { describe, expect, it } from 'vitest';
import { nutritionPeriod, nutritionSelectedDate } from './chat-nutrition-period.js';

describe('account-calendar nutrition periods', () => {
  it.each([
    ['yesterday', '2026-10-29'], ['day before yesterday', '2026-10-28'], ['tomorrow', '2026-10-31'],
    ['2 days ago', '2026-10-28'], ['last monday', '2026-10-26'], ['last friday', '2026-10-23'],
    ['on friday', '2026-10-30'], ['next monday', '2026-11-02'], ['on 2026-01-15', '2026-01-15'],
  ])('selects %s without falling back to today', (question, expected) => {
    expect(nutritionSelectedDate(question, '2026-10-30')).toBe(expected);
  });
  it.each([
    ['this month', '2026-03-01', '2026-03-01', '2026-03-01'],
    ['this year', '2026-03-01', '2026-01-01', '2026-03-01'],
    ['last year', '2026-03-01', '2025-01-01', '2025-12-31'],
    ['last month', '2026-03-01', '2026-02-01', '2026-02-28'],
    ['last month', '2024-03-01', '2024-02-01', '2024-02-29'],
    ['last month', '2026-01-01', '2025-12-01', '2025-12-31'],
    ['this week', '2026-11-01', '2026-10-26', '2026-11-01'],
    ['last week', '2026-11-02', '2026-10-26', '2026-11-01'],
    ['the past 7 days', '2026-01-03', '2025-12-28', '2026-01-03'],
    ['the last 1 day', '2026-10-30', '2026-10-30', '2026-10-30'],
    ['from 2026-02-01 through 2026-02-28', '2026-10-30', '2026-02-01', '2026-02-28'],
  ])('resolves %s relative to %s', (question, today, start, end) => {
    expect(nutritionPeriod(question, today)).toEqual({ start, end });
  });
  it.each(['today', 'past 0 days', 'past 367 days', 'from 2026-03-01 to 2026-02-01', 'from 2026-02-30 to 2026-03-02'])('does not turn an unsupported period into a daily total: %s', question => {
    expect(nutritionPeriod(question, '2026-10-30')).toBeUndefined();
  });
});
