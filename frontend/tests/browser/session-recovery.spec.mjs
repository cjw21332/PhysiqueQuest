import { test, expect } from '@playwright/test';

for (const response of ['empty-200', 'empty-204', 'null', 'active', 'unavailable', 'malformed']) {
  test(`Coach session recovery handles ${response}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'recovery-test', token: 'test' })));
    const active = { _id: 'active-workout', status: 'active', startedAt: new Date().toISOString(), exerciseIds: ['squat'], sets: [] };
    let checked = false;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (path.endsWith('/workouts/active')) {
        checked = true;
        if (response.startsWith('empty')) return route.fulfill({ status: response === 'empty-204' ? 204 : 200, body: '', headers });
        if (response === 'unavailable') return route.fulfill({ status: 503, json: { message: 'Workout service unavailable' }, headers });
        if (response === 'malformed') return route.fulfill({ status: 200, body: '{', contentType: 'application/json', headers });
        return route.fulfill({ json: response === 'active' ? active : null, headers });
      }
      const json = path.endsWith('/profile') ? { name: 'Test', equipment: [] }
        : path.endsWith('/coach/plan') ? { days: [], libraryReady: false }
        : path.endsWith('/workouts') ? [] : {};
      return route.fulfill({ json, headers });
    });
    await page.goto('/coach');
    await expect(page.getByRole('heading', { name: 'Saved workouts and recordings' })).toBeVisible();
    await expect.poll(() => checked).toBe(true);
    // A completed history request proves the screen has loaded; recovery is
    // independently checked below so errors cannot masquerade as no session.
    await expect(page.getByText('No saved workouts yet.')).toBeVisible();
    if (response === 'active') await expect(page.getByRole('button', { name: 'Resume saved workout' })).toBeVisible();
    else if (response === 'unavailable' || response === 'malformed') await expect(page.getByRole('alert').filter({ hasText: 'Session recovery is unavailable' })).toBeVisible();
    else {
      await expect(page.getByText(/Session recovery is unavailable/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Resume saved workout' })).toHaveCount(0);
    }
  });
}
