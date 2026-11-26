import { test, expect } from '@playwright/test';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const planExercises = [
  { exerciseId: 'catalog-bench', name: 'Dumbbell bench press', equipment: 'Dumbbell', prescription: '4 × 10', tracking: 'Manual' },
  { exerciseId: 'catalog-row', name: 'Dumbbell row', equipment: 'Dumbbell', prescription: '3 × 12', tracking: 'Manual' },
  { exerciseId: 'catalog-plank', name: 'Plank', equipment: 'Bodyweight', prescription: '3 × 45 s', tracking: 'Manual' },
];
const plan = { goal: 'Build muscle', weekLabel: 'Week 2 · 7 sessions planned', duration: '45 min', libraryReady: true, sessionCount: 7, sets: '3 × 10', programVersion: 'a'.repeat(64), days: days.map((name, index) => ({ index, label: name.slice(0, 3), name, isWorkoutDay: true, title: 'Upper Body — Push', exercises: planExercises, formTip: null })) };

async function fixture(page) {
  const state = { profile: { name: 'Jamie Cruz', gender: 'Male', age: '27', weight: '78', weightUnit: 'kg', height: '178', heightUnit: 'cm', goal: 'Build muscle', activity: 'Moderate', equipment: ['Dumbbells'], days: [] }, programs: [], puts: [], routine: null, started: null };
  await page.addInitScript(() => sessionStorage.setItem('pq-whats-new-shown', '1'));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.includes('/auth/session/')) json = { access_token: 'test', expires_in: 3600, user: { id: 'programs-user', name: 'Jamie', email: 'jamie@example.test', emailVerified: true } };
    else if (path.endsWith('/profile')) json = state.profile;
    else if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
    else if (path.endsWith('/coach/plan')) json = plan;
    else if (path.endsWith('/coach/programs')) json = { items: state.programs };
    else if (/\/coach\/programs\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.split('/').at(-1));
      if (method === 'PUT') { const body = request.postDataJSON(); state.puts.push(body); state.programs = [body, ...state.programs.filter(item => item.id !== id)]; }
      if (method === 'DELETE') state.programs = state.programs.filter(item => item.id !== id);
      json = { items: state.programs };
    }
    else if (path.endsWith('/workouts/summary')) json = { trainingDates: [], personalRecords: [] };
    else if (path.endsWith('/workouts/active')) json = null;
    else if (path.endsWith('/workouts') && method === 'POST') { state.started = request.postDataJSON(); json = { _id: 'program-session', status: 'active', revision: 0, startedAt: state.started.startedAt, exerciseIds: state.started.exerciseIds, exercises: state.started.exercises, routineName: state.started.routineName, sets: [], pausedSeconds: 0 }; }
    else if (path.endsWith('/routine')) { state.routine = request.postDataJSON(); json = { _id: 'program-session', status: 'active', revision: 1, startedAt: state.started.startedAt, exerciseIds: state.routine.exercises.map(row => row.exerciseId), exercises: state.routine.exercises, routineName: state.routine.routineName, sets: [], pausedSeconds: 0 }; }
    else if (path.endsWith('/workouts')) json = [];
    else if (path.endsWith('/exercises')) json = { items: [], total: 0, page: 1, limit: 20, pages: 1 };
    else if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    else if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    else if (path.endsWith('/notifications')) json = { items: [] };
    return route.fulfill({ json, headers });
  });
  return state;
}
// Another tab (e.g. Me › Training preferences) saving the profile announces a 'profile' change.
async function announceProfileChange(page) {
  const other = await page.context().newPage();
  await other.goto('/launch');
  await other.evaluate(() => localStorage.setItem('physiquequest-data-change-v1', JSON.stringify({ scope: `${location.origin}/api:programs-user`, resources: ['profile'], nonce: String(Math.random()) })));
  await other.close();
}
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const shot = (page, info, name) => page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });

test('Today shows personalised loads and rest, and the Programs tab lists splits and athlete programs', async ({ page }, info) => {
  await fixture(page);
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  await expect(page.locator('.exercise-item')).toHaveCount(3);
  await expect(page.locator('.exercise-item').first()).toContainText(/kg each/);
  await expect(page.locator('.exercise-item').first()).toContainText(/Rest \d:\d\d/);
  expect(await noOverflow(page)).toBe(true);
  await shot(page, info, '01-today');
  await page.getByRole('navigation', { name: 'Coach sections' }).getByRole('button', { name: 'Programs' }).click();
  await expect(page).toHaveURL(/\/coach\/programs$/);
  await expect(page.getByRole('heading', { name: 'Training splits' })).toBeVisible();
  await expect(page.locator('.cq-split-card')).toHaveCount(11);
  await expect(page.locator('.cq-athlete-card')).toHaveCount(8);
  await expect(page.getByText('Matched to your equipment:')).toContainText('Dumbbells');
  await page.getByRole('button', { name: '4 days', exact: true }).click();
  await expect(page.locator('.cq-split-card')).toHaveCount(3);
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 800 }); expect(await noOverflow(page)).toBe(true); }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await shot(page, info, '02-programs');
});

test('splits adapt live to equipment changes, athlete programs do not, and saved copies stay canonical', async ({ page }, info) => {
  const state = await fixture(page);
  await page.goto('/coach/programs');
  await page.locator('.cq-split-card', { hasText: 'Push / Pull / Legs' }).click();
  await page.getByRole('tab', { name: /Push/ }).first().click();
  await expect(page.locator('.cq-exercise', { hasText: 'Dumbbell Bench Press' })).toBeVisible();
  await expect(page.getByText(/Adapted to your equipment · \d+ swap/)).toBeVisible();
  await shot(page, info, '03-split-adapted');
  // Equipment changes elsewhere in the app (Me › Training preferences) re-render the open program.
  state.profile = { ...state.profile, equipment: ['Full gym'] };
  await announceProfileChange(page);
  await expect(page.locator('.cq-exercise', { hasText: 'Barbell Bench Press' }).first()).toBeVisible();
  await expect(page.getByText('Fits your equipment')).toBeVisible();
  state.profile = { ...state.profile, equipment: ['Bodyweight only'] };
  await announceProfileChange(page);
  await expect(page.locator('.cq-exercise', { hasText: 'Push-Up' }).first()).toBeVisible();
  await expect(page.locator('.cq-exercise').filter({ hasText: /Barbell|Dumbbell|Cable|Machine|Resistance bands/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect(page.getByText(/saved to My programs/)).toBeVisible();
  expect(JSON.stringify(state.puts[0])).toContain('Barbell Bench Press');
  await page.getByRole('button', { name: 'Back to programs' }).click();
  await expect(page.locator('.cq-program-row')).toContainText('Adapted to your equipment');

  await page.getByRole('button', { name: /Golden Era Double Split/ }).click();
  await expect(page.locator('.cq-exercise', { hasText: 'Barbell Bench Press' }).first()).toBeVisible();
  await expect(page.getByText(/Adapted to your equipment|Fits your equipment/)).toHaveCount(0);
  await expect(page.getByText(/Not affiliated|not the athlete/).first()).toBeVisible();
  await shot(page, info, '04-athlete');
});

test('a custom program keeps optional reps and weight blank, saves rests, and starts with them', async ({ page }, info) => {
  const state = await fixture(page);
  await page.goto('/coach/programs');
  await page.getByRole('button', { name: /Create a program/ }).click();
  await page.getByLabel('Program name').fill('Garage Strength');
  await page.getByLabel('Day name').fill('Heavy upper');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog', { name: 'Add exercise' });
  await picker.getByRole('searchbox', { name: 'Search exercises' }).fill('incline dumbbell');
  await picker.getByRole('button', { name: /Incline Dumbbell Press/ }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await picker.getByRole('searchbox', { name: 'Search exercises' }).fill('Zercher carry');
  await picker.getByRole('button', { name: /Add “Zercher carry” as a custom exercise/ }).click();
  await page.getByRole('button', { name: 'Increase rest between sets' }).first().click();
  await page.getByLabel('Weight for Zercher Carry in kg').fill('60');
  expect(await noOverflow(page)).toBe(true);
  await shot(page, info, '05-builder');
  await page.getByRole('button', { name: 'Save program' }).click();
  await expect(page.getByRole('heading', { name: 'Garage Strength' })).toBeVisible();
  const saved = state.puts.at(-1);
  expect(saved.days[0].exercises).toHaveLength(2);
  expect(saved.days[0].exercises[0].reps).toBeUndefined();
  expect(saved.days[0].exercises[0].weight).toBeUndefined();
  expect(saved.days[0].exercises[0].restSets).toBe(135);
  expect(saved.days[0].exercises[1].weight).toBe(60);
  await shot(page, info, '06-custom-detail');
  await page.getByRole('button', { name: /Start Heavy upper/ }).click();
  await page.getByRole('dialog', { name: 'Choose how to train' }).getByRole('button', { name: /Log manually/ }).click();
  await expect(page).toHaveURL(/\/coach\/session$/);
  // Workouts are journaled locally first, so check the session itself for the program's rest and load.
  await page.getByRole('button', { name: 'Options for Incline Dumbbell Press' }).click();
  await expect(page.getByRole('button', { name: 'Decrease between sets rest for Incline Dumbbell Press' }).locator('xpath=..')).toContainText('2:15');
  await page.getByRole('button', { name: /View Zercher Carry/ }).click();
  await expect(page.getByLabel('Weight (kg), set 1')).toHaveValue('60');
  await shot(page, info, '07-session');
});

test.describe('on a touch phone', () => {
  // Touch screens apply a global 48px minimum to buttons; the week strip and builder must still fit.
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
  test('Today, Programs and the builder never scroll sideways', async ({ page }, info) => {
    await fixture(page);
    await page.goto('/coach');
    await expect(page.locator('.cq-day')).toHaveCount(7);
    const last = await page.locator('.cq-day').last().boundingBox();
    expect(last.x + last.width).toBeLessThanOrEqual(360);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, info, '08-touch-today');
    await page.goto('/coach/programs');
    await expect(page.getByRole('heading', { name: 'Training splits' })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: /Create a program/ }).click();
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('searchbox', { name: 'Search exercises' }).fill('incline dumbbell');
    await page.getByRole('dialog', { name: 'Add exercise' }).getByRole('button', { name: /Incline Dumbbell Press/ }).click();
    expect(await noOverflow(page)).toBe(true);
    await shot(page, info, '09-touch-builder');
  });
});
