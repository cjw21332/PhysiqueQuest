import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('standalone Goals and Progress pages return to the Home dashboard', async () => {
  const goals = await source('sections/Home/GoalsMilestones.tsx');
  const progress = await source('sections/Home/Progress.tsx');

  assert.match(goals, /aria-label="Back to Home"[^>]*><Icon name="arrow"/);
  assert.match(goals, /onClick=\{\(\) => navigate\('\/home'\)\}/);
  assert.match(progress, /aria-label="Back to Home"[^>]*><Icon name="arrow"/);
  assert.match(progress, /onClick=\{\(\) => navigate\('\/home'\)\}/);
});

test('Scan Today log returns to Nutrition and retains its history action', async () => {
  const dailyLog = await source('sections/Scan/DailyLog.tsx');
  const scanSection = await source('sections/Scan/ScanSection.tsx');

  assert.match(dailyLog, /aria-label="Back to Nutrition"[^>]*><Icon name="arrow"/);
  assert.match(scanSection, /onBack=\{\(\)\s*=>\s*setView\('nutrition'\)\}/);
  assert.match(dailyLog, /onClick=\{onHistory\}/);
});

test('Me alert log and Coach workout report return to their section roots', async () => {
  const alerts = await source('sections/Me Section/EmergencyAlertLog.tsx');
  const report = await source('sections/Coach/WorkoutReport.tsx');
  const coach = await source('sections/Coach/CoachSection.tsx');

  assert.match(alerts, /aria-label="Back to account settings"[^>]*><Icon name="arrow"/);
  assert.match(report, /aria-label="Back to AI Coach"[^>]*><Icon name="arrow"/);
  assert.match(coach, /<WorkoutReport[^>]*onBack=\{\(\) => setView\('plan'\)\}/);
});
