import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('admin analytics preserves API mode and selects mock data only through the explicit preview flag', async () => {
  const screen = await source('sections/Me Section/EngagementAnalytics.tsx');
  const api = await source('lib/api.ts');
  assert.match(screen, /getAdminAnalytics/);
  assert.match(screen, /data\.emergencyEvents/);
  assert.match(screen, /shown\.completedSessions/);
  assert.match(screen, /preview = false/);
  assert.match(screen, /if \(preview\) return/);
  assert.match(screen, /preview \? analyticsPreview\(range\) : null/);
  assert.match(screen, /\.csv/);
  assert.doesNotMatch(screen, /rangeData|428|1,284|emergencyEvents = \[/);
  assert.match(api, /\/admin\/analytics/);
});
