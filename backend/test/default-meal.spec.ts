import { describe, expect, it } from 'vitest';
import { defaultMeal } from '../../frontend/sections/Scan/defaultMeal.js';

describe('default meal at local time boundaries', () => {
  it.each([[3,59,'Dinner'],[4,0,'Breakfast'],[10,29,'Breakfast'],[10,30,'Lunch'],[14,59,'Lunch'],[15,0,'Snack'],[17,29,'Snack'],[17,30,'Dinner']] as const)(
    '%i:%i selects %s', (hour, minute, expected) => expect(defaultMeal(new Date(2026, 0, 1, hour, minute))).toBe(expected),
  );
});
