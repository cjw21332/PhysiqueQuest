import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Taipei' });

async function setup(page, failOnce = false, unmatched = false) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-10-17T04:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'apply-test', token: 'test' })));
  const exercises = ['pull-up', 'push-up', 'bodyweight squatting row'].map((name, index) => ({ exerciseId: `catalog-${index}`, name, equipment: 'Bodyweight', prescription: '3 × 12', tracking: 'Manual', sets: 3 }));
  const plan = { programVersion: 'current', libraryReady: true, duration: '20 min', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ index, name, label: name.slice(0, 3), title: 'Full Body', isWorkoutDay: true, exercises })) };
  const recording = (id, name, reps) => ({ _id: id, origin: 'recorded-set', status: 'completed', startedAt: '2026-10-12T03:00:00Z', activityDate: '2026-10-12', timezone: 'Asia/Taipei', exerciseIds: [id], exercises: [{ exerciseId: id, name, equipment: 'Bodyweight', sets: 1 }], sets: [{ setId: `${id}:0`, exerciseId: id, setIndex: 0, reps, status: 'completed', source: 'local-video', detectedReps: reps }] });
  const recordings = [recording('recording-pushup', unmatched ? 'Unidentified exercise' : 'Push-up', 4), recording('recording-zero', 'Bodyweight squat', 0)];
  let planned;
  const writes = [];
  await page.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = { name: 'Test', equipment: ['Bodyweight'] };
    if (path.endsWith('/settings')) json = { values: { inactivity: false } };
    if (path.endsWith('/auth/me')) json = { role: 'user' };
    if (path.endsWith('/coach/plan')) json = plan;
    if (path.endsWith('/workouts')) json = [...recordings, ...(planned ? [planned] : [])];
    if (path.endsWith('/active')) json = planned ?? null;
    if (path.endsWith('/applied-session')) json = planned;
    if (path.endsWith('/apply')) {
      writes.push(req.postDataJSON());
      if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { message: 'Temporary failure. Try again.' }, headers }); }
      const dto = req.postDataJSON();
      planned = { _id: 'applied-session', origin: 'planned', status: 'active', startedAt: '2026-10-17T04:00:00Z', scheduledDate: dto.scheduledDate, timezone: dto.timezone, dayIndex: dto.dayIndex, programVersion: dto.programVersion, exerciseIds: dto.exercises.map(exercise => exercise.exerciseId), exercises: dto.exercises, revision: 1, pausedSeconds: 0, appliedRecordingIds: ['recording-pushup'], sets: [{ ...recordings[0].sets[0], exerciseId: dto.exerciseId, setId: `${dto.exerciseId}:0`, sourceRecordingId: 'recording-pushup' }] };
      json = planned;
    }
    return route.fulfill({ json, headers });
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await expect(page.getByRole('status', { name: 'Set progress for Monday' })).toHaveText('0 of 9 sets completed · 0 skipped · 9 remaining');
  return { writes };
}

test('a reviewed four-rep recording becomes one Monday set, while zero reps do not count', async ({ page }) => {
  const { writes } = await setup(page);
  const select = page.getByRole('combobox', { name: 'Planned exercise for Push-up' });
  await expect(select).toHaveValue('catalog-1');
  await expect(page.getByText('No reps logged; this recording does not complete a planned set.')).toBeVisible();
  expect(writes).toHaveLength(0);
  await select.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/apply-to-set-controls.png', fullPage: true });
  await page.getByRole('button', { name: 'Apply Push-up · 4 reps to a planned set' }).click();
  await expect(page.getByRole('status', { name: 'Set progress for Monday' })).toHaveText('1 of 9 sets completed · 0 skipped · 8 remaining');
  await expect(page.getByLabel('Remaining sets for push-up')).toHaveText('2 sets remaining');
  await expect(page.getByText('Applied to a planned set.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Push-up · 4 reps to a planned set' })).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ exerciseId: 'catalog-1', dayIndex: 0, scheduledDate: '2026-10-12', programVersion: 'current' });
  expect(writes[0]).not.toHaveProperty('reps');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/recording-applied-to-plan.png', fullPage: true });
  await page.getByRole('button', { name: 'Wednesday, workout day' }).click();
  await expect(page.getByRole('status', { name: 'Set progress for Wednesday' })).toHaveText('0 of 9 sets completed · 0 skipped · 9 remaining');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await page.getByRole('button', { name: 'Resume session', exact: true }).click();
  await expect(page).toHaveURL(/\/workouts\/applied-session$/);
  await expect(page.getByRole('status', { name: 'Remaining sets in this workout' })).toHaveText('8 sets remaining in this workout · 1 completed · 0 skipped.');
});

test('an unmatched recording requires an explicit exercise choice and survives a failed apply', async ({ page }) => {
  const { writes } = await setup(page, true, true);
  const apply = page.getByRole('button', { name: 'Apply Unidentified exercise · 4 reps to a planned set' });
  await expect(apply).toBeDisabled();
  await page.getByRole('combobox', { name: 'Planned exercise for Unidentified exercise' }).selectOption('catalog-1');
  await apply.click();
  await expect(page.locator('.workout-history').getByRole('alert')).toContainText('Temporary failure');
  await expect(page.getByRole('status', { name: 'Set progress for Monday' })).toHaveText('0 of 9 sets completed · 0 skipped · 9 remaining');
  await apply.click();
  await expect(page.getByRole('status', { name: 'Set progress for Monday' })).toHaveText('1 of 9 sets completed · 0 skipped · 8 remaining');
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
});
