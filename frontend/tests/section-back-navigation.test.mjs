import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every nested section header places its back control before the page heading', async () => {
  const pages = [
    'Home/GoalsMilestones', 'Home/Progress', 'Home/Notifications',
    'Coach/ExerciseLibrary', 'Coach/CameraCheck', 'Coach/WorkoutReport', 'Coach/SquatFormPreview', 'Coach/PoseTrackerSession',
    'Scan/ReviewEstimate', 'Scan/AddFood', 'Scan/FoodHistory', 'Scan/EditMeal', 'Scan/DietaryPlan',
    'Quests Section/QuestSection', 'Me Section/MeEditLayout',
    'Me Section/AdminExerciseLibrary', 'Me Section/EngagementAnalytics', 'Me Section/EmergencyAlertLog', 'Me Section/PersonalExercises',
  ];
  for (const page of pages) {
    const content = await source(`sections/${page}.tsx`);
    const back = content.search(/<button\b[^>]*(?:className="(?:coach-back|leaderboard-back|ghost back-btn|pq-progress-back)"|aria-label="Back to AI Coach")/);
    assert.ok(back >= 0, `${page} has a back control`);
    const headerStart = content.lastIndexOf('<header', back);
    const headerEnd = content.indexOf('</header>', back);
    const heading = content.slice(headerStart, headerEnd).search(/<h[12]\b/) + headerStart;
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
  assert.match(goals, /onClick=\{\(\) => push\('\/home'\)\}/);
  assert.match(progress, /className="coach-back"/);
  assert.match(progress, /<Icon name="arrow" size=\{20\}\/>/);
  assert.match(progress, /navigate\(new URLSearchParams\(window\.location\.search\)\.get\('from'\) === 'goals' \? '\/goals' : '\/home'\)/);
});

test('Scan dashboard retains its history action and old route redirects', async () => {
  const dashboard = await source('sections/Scan/NutritionDashboard.tsx');
  const scanSection = await source('sections/Scan/ScanSection.tsx');

  assert.match(scanSection, /onBack=\{\(\)\s*=>\s*setView\('nutrition'\)\}/);
  assert.match(dashboard, /onClick=\{onHistory\}/);
  assert.match(await source('app/(app)/scan/[view]/page.tsx'), /view === 'today'\) redirect\('\/scan'\)/);
});

test('Me alert log and Coach workout report return to their section roots', async () => {
  const alerts = await source('sections/Me Section/EmergencyAlertLog.tsx');
  const report = await source('sections/Coach/WorkoutReport.tsx');
  const coach = await source('sections/Coach/CoachSection.tsx');

  assert.match(alerts, /aria-label="Back to account settings"[^>]*><Icon name="arrow"/);
  assert.match(report, /aria-label="Back to AI Coach"[^>]*><Icon name="arrow"/);
  assert.match(coach, /<WorkoutReport[^>]*onBack=\{\(\) => setView\('plan'\)\}/);
});
