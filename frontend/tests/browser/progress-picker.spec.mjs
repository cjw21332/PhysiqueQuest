import { test, expect } from '@playwright/test';

test('program pickers filter exercises and fit narrow screens', async ({ page }) => {
  const exercises = [
    { exerciseId: 'bench', name: 'barbell bench press', targetMuscle: 'Chest', group: 'Chest' },
    { exerciseId: 'curl', name: 'biceps curl', targetMuscle: 'Arms', group: 'Arms' },
  ];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'picker-user', name: 'Test', email: 'test@example.test', emailVerified: true } };
    else if (path.endsWith('/profile')) json = { name: 'Test', equipment: [], days: [], goal: 'General fitness' };
    else if (path.endsWith('/coach/plan')) json = { days: [{ index: 0, name: 'Monday', title: 'upper body', isWorkoutDay: true, exercises }] };
    else if (path.endsWith('/exercises/bench')) json = { _id: 'bench', targetMuscles: ['pectorals'] };
    else if (path.endsWith('/exercises/curl')) json = { _id: 'curl', targetMuscles: ['biceps'] };
    else if (path.endsWith('/workouts/summary')) json = { personalRecords: [] };
    else if (path.endsWith('/workouts') || path.includes('/progress')) json = [];
    else if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    else if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    else if (path.endsWith('/notifications')) json = { items: [] };
    await route.fulfill({ json });
  });
  await page.goto('/progress');
  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a Workout Day' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monday.*Upper Body/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose an Exercise' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an Exercise' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Barbell Bench Press' }).click();
  await expect(page.getByText('No weighted working sets logged for this exercise yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Muscles', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a Muscle Group' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chest' }).click();
  await page.getByRole('button', { name: 'Choose an Exercise' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Barbell Bench Press' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Biceps Curl' })).toHaveCount(0);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 700 });
    const box = await page.getByRole('dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
