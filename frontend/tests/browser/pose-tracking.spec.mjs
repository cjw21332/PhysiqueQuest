import { test, expect } from '@playwright/test';

test('camera counting beta is hidden and old tracking links do not start workouts', async ({ page }) => {
  let created = 0;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test' })));
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/workouts') && request.method() === 'POST') created++;
    const json = path.endsWith('/profile') ? { name: 'Test' } : path.endsWith('/coach/plan') ? { days: [], libraryReady: false } : path.endsWith('/exercises') ? { items: [], total: 0, page: 1, limit: 12, pages: 0 } : {};
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  });
  await page.goto('/coach?track=camera-curl');
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  await expect(page.getByText(/Camera rep counting/)).toHaveCount(0);
  await page.getByRole('button', { name: /Exercise library/ }).click();
  await expect(page.getByText(/Camera rep counting/)).toHaveCount(0);
  expect(created).toBe(0);
});

test('library remains reachable when the account/profile service is unavailable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test' })));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    return path.endsWith('/profile') ? route.fulfill({ status: 503, json: { message: 'Account service offline' }, headers }) : route.fulfill({ json: { items: [], total: 0, page: 1, limit: 12, pages: 0 }, headers });
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Browse exercise library' }).click();
  await expect(page.getByRole('heading', { name: 'Exercise library', exact: true })).toBeVisible();
  await expect(page.getByText('No exercises match those filters.')).toBeVisible();
});
