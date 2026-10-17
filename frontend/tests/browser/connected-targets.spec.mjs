import { test, expect } from '@playwright/test';

test('one saved nutrition target is reused by Home and Nutrition without activity preference writes', async ({ page }) => {
  let settings = { inactivity: false }, settingsWrites = 0, activityWrites = 0;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'nutrition-test', token: 'test' })));
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = { name: 'Test', goal: 'Build muscle', days: ['Monday'], equipment: ['Bodyweight'] };
    if (path.endsWith('/settings')) { if (request.method() === 'PUT') { settingsWrites++; settings = { ...settings, ...request.postDataJSON().values }; } json = { values: settings }; }
    if (path.endsWith('/activity/state')) { if (request.method() !== 'GET') activityWrites++; json = { state: { level: 1 }, dailyMissions: [], badges: [] }; }
    if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    if (path.endsWith('/coach/plan')) json = { days: [], libraryReady: false };
    if (path.endsWith('/auth/me')) json = { role: 'user' };
    return route.fulfill({ json, headers });
  });
  await page.goto('/me');
  await page.getByText('Daily nutrition targets', { exact: true }).click();
  for (const [key, value] of Object.entries({ calories: 2100, protein: 120, carbs: 220, fats: 65 })) await page.getByRole('spinbutton', { name: `Daily ${key} target` }).fill(String(value));
  await page.getByRole('button', { name: 'Save nutrition targets' }).click();
  await expect(page.getByText('Targets saved.', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('img', { name: '0 of 2100 calories logged' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('img', { name: '0 of 2100 calories logged' })).toBeVisible();
  expect(settingsWrites).toBe(1); expect(activityWrites).toBe(0);
  await page.getByRole('button', { name: /Log.*water intake/ }).click();
  await expect(page.getByRole('img', { name: '0 of 2100 calories logged' })).toBeVisible();
});
