import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Taipei' });
const exercise = { exerciseId: 'catalog-curl', name: 'Biceps curl', equipment: 'Dumbbell', prescription: '3 × 10', tracking: 'Manual' };
const plan = { programVersion: 'current', libraryReady: true, duration: '20 min', sets: '3 × 10', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ name, label: name.slice(0, 3), index, isWorkoutDay: index !== 6, title: index === 6 ? 'Recovery day' : 'Strength', exercises: index === 6 ? [] : [exercise] })) };
const result = (index, status = 'completed') => ({ setId: `catalog-curl:${index}`, exerciseId: 'catalog-curl', setIndex: index, reps: status === 'skipped' ? 0 : 10, status, source: 'manual' });
const monday = { _id: 'monday-session', origin: 'planned', programVersion: 'current', dayIndex: 0, scheduledDate: '2026-10-12', timezone: 'Asia/Taipei', startedAt: '2026-10-12T03:00:00Z', status: 'active', revision: 0, pausedSeconds: 0, exerciseIds: ['catalog-curl'], exercises: [{ ...exercise, name: 'Monday saved curl', sets: 3 }], sets: [result(0), result(1, 'skipped')] };

async function setup(page, extra = [], initial = monday) {
  await page.clock.install({ time: new Date('2026-10-17T04:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'day-test', token: 'test' })));
  let workout = structuredClone(initial), created;
  const reads = new Map();
  await page.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = { name: 'Test', equipment: ['Dumbbell'] };
    if (path.endsWith('/coach/plan')) json = plan;
    if (path.endsWith('/settings')) json = { values: { inactivity: false } };
    if (path.endsWith('/auth/me')) json = { role: 'user' };
    if (path.endsWith('/pose/status')) json = { available: false };
    if (path.endsWith('/active') || path.endsWith('/monday-session')) json = workout;
    if (path.endsWith('/sets')) { workout = { ...workout, revision: workout.revision + 1, sets: [...workout.sets.filter(set => set.setId !== req.postDataJSON().result.setId), req.postDataJSON().result] }; json = workout; }
    if (path.endsWith('/workouts')) {
      if (req.method() === 'POST') { created = req.postDataJSON(); json = { ...created, _id: 'created', status: 'active', sets: [], revision: 0 }; }
      else {
        const date = url.searchParams.get('date');
        reads.set(date, (reads.get(date) || 0) + 1);
        // Deliberately return all dates: local filtering must also protect
        // tab changes while the selected-day resource is being replaced.
        json = [workout, ...extra];
      }
    }
    return route.fulfill({ json, headers });
  });
  return { reads, created: () => created };
}

test('weekday tabs isolate saved results and planned remaining sets by date, week and program', async ({ page }) => {
  const extra = [
    { ...monday, _id: 'last-week', scheduledDate: '2026-10-05', startedAt: '2026-10-05T03:00:00Z', exercises: [{ ...monday.exercises[0], name: 'Last week curl' }] },
    { ...monday, _id: 'old-program', programVersion: 'old', sets: [result(2)], exercises: [{ ...monday.exercises[0], name: 'Previous program curl' }] },
    { ...monday, _id: 'recording', origin: 'recorded-set', status: 'completed', startedAt: '2026-10-14T03:00:00Z', activityDate: '2026-10-14', exercises: [{ ...monday.exercises[0], name: 'Wednesday recording' }], sets: [{ ...result(0), reps: 6 }] },
  ];
  const { reads } = await setup(page, extra);
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await expect(page.getByRole('status', { name: 'Set progress for Monday' })).toHaveText('1 of 3 sets completed · 1 skipped · 1 remaining');
  await expect(page.getByLabel('Remaining sets for Biceps curl')).toHaveText('1 set remaining · 1 skipped');
  await expect(page.getByRole('link', { name: /Monday saved curl/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Last week curl|Wednesday recording/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume saved workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Wednesday, workout day' }).click();
  await expect(page.getByRole('status', { name: 'Set progress for Wednesday' })).toHaveText('0 of 3 sets completed · 0 skipped · 3 remaining');
  await expect(page.getByRole('link', { name: /Monday saved curl|Previous program curl|Last week curl/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Wednesday recording · 6 reps/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume saved workout' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sunday, recovery day' }).click();
  await expect(page.getByText('No saved workouts yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: /saved curl|recording|Last week/ })).toHaveCount(0);
  expect(reads.get('2026-10-12')).toBe(1);
  expect(reads.get('2026-10-14')).toBe(1);
  await page.getByRole('button', { name: 'View all workout history' }).click();
  await expect(page.getByRole('heading', { name: 'All workout history' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Last week curl/ })).toBeVisible();
  await page.getByRole('button', { name: 'Wednesday, workout day' }).click();
  await expect(page.getByRole('heading', { name: 'All workout history' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Monday saved curl|Last week curl/ })).toHaveCount(0);
});

test('remaining sets update after saving, skipping and editing without counting a set twice', async ({ page }) => {
  await setup(page);
  await page.goto('/workouts/monday-session');
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toHaveText('1 set remaining in this workout · 1 completed · 1 skipped.');
  await expect(page.getByRole('status', { name: 'Remaining sets for this exercise' })).toHaveText('1 set remaining for this exercise.');
  await page.getByRole('button', { name: 'Start set', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('7');
  await page.getByRole('button', { name: 'Done set', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toHaveText('0 sets remaining in this workout · 2 completed · 1 skipped.');
  await page.getByRole('button', { name: 'Edit Monday saved curl, set 1', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toHaveText('0 sets remaining in this workout · 2 completed · 1 skipped.');
  await page.getByRole('button', { name: 'Edit Monday saved curl, set 2', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toHaveText('0 sets remaining in this workout · 3 completed · 0 skipped.');
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await expect(page.getByRole('status', { name: 'Set progress for Monday' })).toHaveText('3 of 3 sets completed · 0 skipped · 0 remaining');
});

test('starting a selected weekday saves its explicit calendar date', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Wednesday, workout day' }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect.poll(() => state.created()?.scheduledDate).toBe('2026-10-14');
  expect(state.created()).toMatchObject({ dayIndex: 2, programVersion: 'current', origin: 'planned' });
});


test('each set waits for Start set and failed saves retain the current set for retry', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page, [], { ...monday, sets: [] });
  let fail = true;
  await page.route('**/api/workouts/monday-session/sets', route => {
    if (!fail) return route.fallback();
    fail = false;
    return route.fulfill({ status: 503, json: { message: 'Temporary save failure' } });
  });
  await page.goto('/workouts/monday-session');
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Start set', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('9');
  await page.getByRole('button', { name: 'Done set', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saving reviewed set' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toContainText('3 sets remaining');
  await page.getByRole('button', { name: 'Retry saving reviewed set' }).click();
  await expect(page.getByRole('status', { name: 'Next set' })).toContainText('start set 2');
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start set', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toContainText('2 sets remaining');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
