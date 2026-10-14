import { test, expect } from '@playwright/test';

const prescribed = [
  { exerciseId: 'catalog-pushup', name: 'Push-up', equipment: 'Bodyweight', prescription: '3 × 12', tracking: 'Manual' },
  { exerciseId: 'catalog-bench', name: 'Dumbbell bench press', equipment: 'Dumbbell', prescription: '4 × 10', tracking: 'Manual' },
  { exerciseId: 'catalog-overhead', name: 'Overhead press', equipment: 'Dumbbell', prescription: '3 × 10', tracking: 'Manual' },
  { exerciseId: 'catalog-lateral', name: 'Lateral raise', equipment: 'Dumbbell', prescription: '3 × 15', tracking: 'Manual' },
  { exerciseId: 'catalog-triceps', name: 'Triceps extension', equipment: 'Dumbbell', prescription: '3 × 12', tracking: 'Manual' },
  { exerciseId: 'catalog-plank', name: 'Plank', equipment: 'Bodyweight', prescription: '3 × 45 s', tracking: 'Manual' },
];
const plan = { goal: 'Build muscle', weekLabel: 'Week 3 · 4 sessions planned', duration: '45 min', libraryReady: true, sets: '3 × 10', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ index, label: name.slice(0, 3), name, isWorkoutDay: [0, 2, 4, 5].includes(index), title: index === 0 ? 'Upper Body — Push' : 'Recovery day', exercises: index === 0 ? prescribed : [], equipmentLabel: 'Dumbbell + Bodyweight', formTip: index === 0 ? { exerciseName: 'Dumbbell bench press', text: 'Keep your wrists stacked over your elbows.' } : null })) };

test('reference Coach layout renders server prescriptions and starts the chosen catalog exercises', async ({ page }) => {
  let started;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test' })));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = { name: 'Test', equipment: ['Dumbbell'], duration: '45 min' };
    if (path.endsWith('/coach/plan')) json = plan;
    if (path.endsWith('/pose/status')) json = { available: false };
    if (path.endsWith('/workouts') && request.method() === 'POST') { started = request.postDataJSON(); json = { _id: 'saved-session', exerciseIds: started.exerciseIds, status: 'active' }; }
    return route.fulfill({ json, headers });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await expect(page.getByRole('heading', { name: 'Upper Body — Push' })).toBeVisible();
  await expect(page.locator('.exercise-item')).toHaveCount(6);
  await expect(page.locator('.exercise-item').last()).toContainText('3 × 45 s');
  await expect(page.getByText('Keep your wrists stacked over your elbows.')).toBeVisible();
  await expect(page.getByText('22 kg', { exact: false })).toHaveCount(0);
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.locator('.coach-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeInViewport();
    const start = await page.getByRole('button', { name: 'Start session', exact: true }).boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(start.y + start.height).toBeLessThanOrEqual(nav.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect.poll(() => started?.exerciseIds).toEqual(prescribed.map(item => item.exerciseId));
});
