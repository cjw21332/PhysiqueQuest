import { describe, expect, it } from 'vitest';
import { assertLoggableDate } from '../src/nutrition/nutrition.service.js';

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('loggable meal and water dates', () => {
  it('allow today, yesterday and up to 30 days back, plus a time-zone day ahead', () => {
    for (const offset of [0, -1, -2, -30, 1]) expect(() => assertLoggableDate(day(offset))).not.toThrow();
    expect(() => assertLoggableDate(undefined)).not.toThrow();
  });
  it('reject older back-fills and future dates', () => {
    expect(() => assertLoggableDate(day(-32))).toThrow(/30 days back/);
    expect(() => assertLoggableDate(day(3))).toThrow(/30 days back/);
  });
});
