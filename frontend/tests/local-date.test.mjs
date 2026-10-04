import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLocalDate } from '../lib/localDate.mjs';

test('formats device-local year, month, and day without converting through UTC', () => {
  const localDate = new Date(2026, 0, 5, 0, 30, 0);
  assert.equal(formatLocalDate(localDate), '2026-01-05');
});

test('pads single-digit calendar parts for stable API date keys', () => {
  assert.equal(formatLocalDate(new Date(2026, 8, 4, 23, 59)), '2026-09-04');
});
