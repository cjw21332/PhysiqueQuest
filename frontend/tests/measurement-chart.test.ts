import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dayTimeAxis, measurementAxis, recordedDateAxis } from '../lib/measurementChart.ts';

test('measurement axis uses half units for small changes and includes all values', () => {
  const axis = measurementAxis([84.5, 86])!;
  assert.deepEqual(axis.ticks, [86, 85.5, 85, 84.5]);
  const single = measurementAxis([85])!;
  assert.ok(single.low < 85 && single.high > 85);
  const mixed = measurementAxis([70.234, 74.6])!;
  assert.ok(mixed.low <= 70.234 && mixed.high >= 74.6);
  assert.equal(measurementAxis([]), null);
});
test('recording dates are unique, ordered and map every point on the same date to one tick', () => {
  const first = new Date(2026, 10, 8, 8).getTime();
  const later = new Date(2026, 10, 8, 19).getTime();
  const last = new Date(2026, 10, 14, 9).getTime();
  const axis = recordedDateAxis([last, later, first]);
  assert.equal(axis.ticks.length, 2);
  assert.equal(axis.position(first), 0);
  assert.equal(axis.position(later), 0);
  assert.equal(axis.position(last), 100);
  assert.equal(recordedDateAxis([first]).position(first), 50);
});
test('day axis begins at first recording hour and advances in hours through current time', () => {
  const recorded = new Date(2026, 10, 12, 8, 27).getTime();
  const axis = dayTimeAxis([recorded], new Date(2026, 10, 12, 11, 20));
  assert.equal(new Date(axis.start).getHours(), 8);
  assert.equal(new Date(axis.end).getHours(), 12);
  assert.equal(axis.ticks.length, 5);
  assert.ok(axis.ticks.every((time, index) => time === axis.start + index * 3600000));
});
