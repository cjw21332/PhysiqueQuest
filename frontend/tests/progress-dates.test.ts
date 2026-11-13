import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { endOfDay, localDate, localDateString, progressRange, validCustomRange } from '../lib/progressDates.ts';

test('week is Sunday through Saturday and month starts on the same day last month', () => {
  const now = new Date(2026, 10, 12, 14);
  const week = progressRange('week', now);
  assert.equal(localDateString(week.start), '2026-11-08');
  assert.equal(localDateString(week.end), '2026-11-14');
  const month = progressRange('month', now);
  assert.equal(localDateString(month.start), '2026-10-12');
  assert.equal(localDateString(month.end), '2026-11-12');
  assert.equal(localDateString(progressRange('day', now).start), '2026-11-12');
});
test('custom range stays between account creation and today', () => {
  const valid = (from: string, to: string) => validCustomRange(from, to, '2026-01-15', '2026-11-12');
  assert.equal(valid('2026-01-15', '2026-11-12'), true);
  assert.equal(valid('2026-01-14', '2026-11-12'), false);
  assert.equal(valid('2026-02-01', '2026-11-13'), false);
  assert.equal(valid('2026-05-01', '2026-04-01'), false);
  assert.equal(valid('', '2026-11-12'), false);
});
test('month handles shorter months and year boundaries', () => {
  assert.equal(localDateString(progressRange('month', new Date(2025, 2, 31)).start), '2025-02-28');
  assert.equal(localDateString(progressRange('month', new Date(2024, 2, 31)).start), '2024-02-29');
  assert.equal(localDateString(progressRange('month', new Date(2026, 0, 5)).start), '2025-12-05');
});
test('date inputs are local and invalid dates are rejected', () => {
  assert.equal(localDate('2026-02-30'), null);
  assert.equal(localDateString(localDate('2026-11-08')!), '2026-11-08');
  assert.equal(endOfDay(localDate('2026-11-08')!).getHours(), 23);
});
