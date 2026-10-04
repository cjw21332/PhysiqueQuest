import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('admin analytics charts and export use only API results', async () => {
  const screen = await source('sections/Me Section/EngagementAnalytics.tsx');
  const api = await source('lib/api.ts');
  assert.match(screen, /getAdminAnalytics/);
  assert.match(screen, /data\.emergencyEvents/);
  assert.match(screen, /data\.completedSessions/);
  assert.match(screen, /\.csv/);
  assert.doesNotMatch(screen, /rangeData|428|1,284|emergencyEvents = \[/);
  assert.match(api, /\/admin\/analytics/);
});
