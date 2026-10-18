import { test, expect } from '@playwright/test';

test('logs every exercise, restores drafts and saved results, then updates weekly goals without a full document reload', async ({ page }) => {
  let workout;
  let profileReads = 0, activityWrites = 0, setWrites = 0, createWrites = 0, pauseWrites = 0;
  const exercises = ['Squat', 'Curl', 'Plank'].map((name, index) => ({ exerciseId: `exercise-${index}`, name, equipment: 'Bodyweight', prescription: index === 2 ? '1 × 30 s' : '1 × 8', tracking: 'Manual' }));
  await page.addInitScript(() => { if (!localStorage.getItem('physiquequest-auth')) localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test' })); });
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) { profileReads++; json = { name: 'Test', equipment: ['Bodyweight'], days: ['Monday', 'Wednesday', 'Friday'], goal: 'Build muscle', weight: '70', weightUnit: 'kg', targetWeight: '72' }; }
    if (path.endsWith('/settings')) json = { values: { inactivity: true, threshold: 45 } };
    if (path.endsWith('/auth/me')) json = { role: 'user' };
    if (path.endsWith('/coach/plan')) json = { libraryReady: true, duration: '20 min', days: Array.from({ length: 7 }, (_, index) => ({ index, label: String(index + 1), name: 'Day ' + index, isWorkoutDay: true, title: 'Workout', exercises })) };
    if (path.endsWith('/pose/status')) json = { available: false };
    if (path.endsWith('/workouts')) {
      if (request.method() === 'POST') { createWrites++; workout = { _id: 'saved-workout', ...request.postDataJSON(), status: 'active', revision: 0, sets: [], pausedSeconds: 0 }; json = workout; }
      else json = workout ? [workout] : [];
    }
    if (path.endsWith('/active')) json = workout?.status === 'active' ? workout : null;
    if (path.endsWith('/saved-workout')) json = workout;
    if (path.endsWith('/pause')) { pauseWrites++; workout.pausedAt = request.postDataJSON().paused ? request.postDataJSON().occurredAt : null; workout.revision++; json = workout; }
    if (path.endsWith('/sets')) {
      const { expectedRevision, result } = request.postDataJSON();
      if (expectedRevision !== workout.revision) return route.fulfill({ status: 409, headers, json: { message: 'Revision conflict' } });
      setWrites++; workout.sets = [...workout.sets.filter(set => set.setId !== result.setId), result]; workout.revision++; json = workout;
    }
    if (path.endsWith('/complete')) { workout.status = 'completed'; workout.endedAt = request.postDataJSON().endedAt; workout.durationSeconds = 50; json = workout; }
    if (path.endsWith('/summary')) json = { trainingDates: workout?.status === 'completed' ? [new Intl.DateTimeFormat('en-CA').format(new Date())] : [], personalRecords: [], policyVersion: 2 };
    if (path.endsWith('/progress')) json = [];
    if (path.endsWith('/activity/state')) { if (request.method() !== 'GET') activityWrites++; json = { state: { level: 1 }, dailyMissions: [], badges: [] }; }
    return route.fulfill({ json: structuredClone(json), headers });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page).toHaveURL(/\/workouts\/saved-workout$/);
  await expect(page.getByRole('heading', { name: 'Exercise 1 of 3' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Start set', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('5');
  await page.getByRole('button', { name: 'Pause session', exact: true }).click();
  await expect(page.getByText('Session paused', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done set', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue session', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toHaveValue('5');
  await expect(page.getByRole('button', { name: 'Done set', exact: true })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('physiquequest-inactivity', { detail: { type: 'countdown-started' } })));
  await expect(page.getByRole('heading', { name: 'Exercise 1 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue session', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('physiquequest-inactivity', { detail: { type: 'monitoring-paused' } })));
  await expect(page.getByText('Safety monitoring paused', { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('physiquequest-inactivity', { detail: { type: 'countdown-started' } })));
  await expect(page.getByRole('heading', { name: 'Exercise 1 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume monitoring', exact: true }).click();
  await expect(page.getByText('Safety monitoring paused', { exact: true })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('8');
  await page.getByRole('spinbutton', { name: 'Set load in kg', exact: true }).fill('20');
  await page.getByRole('button', { name: 'Done set', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exercise 2 of 3' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Next set' })).toContainText('Ready for Curl?');
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toBeDisabled();
  await page.getByRole('status', { name: 'Next set' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/next-set-prompt.png', fullPage: true });
  await page.getByRole('button', { name: 'Start set', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set reps', exact: true }).fill('11');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Exercise 2 of 3' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Set reps', exact: true })).toHaveValue('11');
  await page.getByRole('button', { name: 'Skip this set' }).click();
  await expect(page.getByRole('heading', { name: 'Exercise 3 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Start set', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Set seconds', exact: true }).fill('30');
  await page.getByRole('button', { name: 'Done set', exact: true }).click();
  await expect(page.getByText('3 of 3 sets reviewed.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and finish workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  expect(workout.sets.map(set => [set.exerciseId, set.status, set.reps])).toEqual([['exercise-0', 'completed', 8], ['exercise-1', 'skipped', 0], ['exercise-2', 'completed', 0]]);
  expect(workout.sets[2].durationSeconds).toBe(30);
  expect(createWrites).toBe(1); expect(setWrites).toBe(3); expect(pauseWrites).toBe(2);
  await page.evaluate(() => { window.documentIdentity = 'same-document'; });
  await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect.poll(() => activityWrites).toBe(0);
  expect(await page.evaluate(() => window.documentIdentity)).toBe('same-document');
  await page.getByRole('button', { name: /Goals.*milestones/ }).click();
  await expect(page.getByRole('img', { name: /33% of this week's 3 planned training days completed/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/cohesion-goals.png', fullPage: true });
  expect(profileReads).toBe(4); // Initial load and two explicit reloads; internal navigation reuses the profile.
});
