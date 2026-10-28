import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every nested section header places its back control before the page heading', async () => {
  const pages = [
    'Home/GoalsMilestones', 'Home/Progress', 'Home/Notifications',
    'Coach/ExerciseLibrary', 'Coach/CameraCheck', 'Coach/WorkoutReport',
    'Scan/ReviewEstimate', 'Scan/AddFood', 'Scan/DailyLog', 'Scan/FoodHistory', 'Scan/EditMeal',
    'Quests Section/QuestSection', 'Me Section/MeEditLayout',
    'Me Section/AdminExerciseLibrary', 'Me Section/EngagementAnalytics', 'Me Section/EmergencyAlertLog',
  ];
  for (const page of pages) {
    const content = await source(`sections/${page}.tsx`);
    const back = content.search(/<button\b[^>]*(?:className="(?:coach-back|leaderboard-back|ghost back-btn)"|aria-label="Back to AI Coach")/);
    assert.ok(back >= 0, `${page} has a back control`);
    const headerStart = content.lastIndexOf('<header', back);
    const headerEnd = content.indexOf('</header>', back);
    const heading = content.indexOf('<h2', headerStart);
    assert.ok(headerStart >= 0 && heading > back && heading < headerEnd, `${page}: back icon precedes heading in its header`);
  }
});

test('Scan and Exercise Library visually keep back controls beside the title', async () => {
  const css = await source('app/globals.css');
  assert.doesNotMatch(css, /\.scan-reference[^{}]*coach-back\s*\{[^}]*\border\s*:/);
  assert.match(css, /\.coach-library \.library-header\s*\{[^}]*justify-content:\s*flex-start/);
  assert.match(css, /\.scan-reference \.scan-header\.add-food-header\s*\{[^}]*justify-content:\s*flex-start/);
});

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
