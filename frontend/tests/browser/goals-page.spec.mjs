import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.addInitScript(() => sessionStorage.setItem('pq-whats-new-shown', '1')); });

test('goals use saved data, update weight and fit mobile widths', async ({ page }) => {
  let profile = { name: 'Test', goal: 'Build muscle', weight: '70', weightUnit: 'kg', targetWeight: '75', targetDate: '2027-12-31', days: ['Monday', 'Wednesday', 'Friday'], equipment: [] };
  let history = [{ _id: 'old', value: 69, unit: 'kg', measuredAt: '2026-10-01T12:00:00Z' }];
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'goals-user', name: 'Test', email: 'test@example.test', emailVerified: true } };
    else if (path.endsWith('/profile')) { if (request.method() === 'PUT') profile = { ...profile, ...request.postDataJSON() }; json = profile; }
    else if (path.endsWith('/workouts/summary')) json = { trainingDates: [], personalRecords: [] };
    else if (path.endsWith('/progress')) { if (request.method() === 'POST') history = [{ _id: 'new', ...request.postDataJSON() }, ...history]; json = request.method() === 'POST' ? history[0] : history; }
    else if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    await route.fulfill({ json });
  });
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/goals');
  await expect(page.getByRole('heading', { name: 'Build muscle' })).toBeVisible();
  await expect(page.getByText('5 kg below your target')).toBeVisible();
  await expect(page.getByText('3 days planned')).toBeVisible();
  await expect(page.getByLabel('Monday: planned')).toBeVisible();
  await expect(page.getByLabel('Tuesday: not planned')).toBeVisible();
  await page.getByRole('button', { name: 'Update weight' }).click();
  await page.getByLabel('Current weight (kg)').fill('72');
  await page.getByRole('button', { name: 'Save weight' }).click();
  await expect(page.getByText('3 kg below your target')).toBeVisible();
  await expect(page.getByText('Latest check-in')).toBeVisible();
  await page.screenshot({ path: 'test-results/goals-mobile.png', fullPage: true });
  for (const width of [320, 375, 430, 1280]) {
    await page.setViewportSize({ width, height: 760 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(/\/me\/goals(\?from=goals)?$/);
});

test('shows empty and recoverable error states', async ({ page }) => {
  let failHistory = true;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session/refresh')) return route.fulfill({ json: { access_token: 'test', expires_in: 3600, user: { id: 'empty-goals-user', name: 'Test', email: 'test@example.test', emailVerified: true } } });
    if (path.endsWith('/profile')) return route.fulfill({ json: { name: 'Test', goal: '', weight: '', weightUnit: 'kg', targetWeight: '', days: [] } });
    if (path.endsWith('/workouts/summary')) return route.fulfill({ json: { trainingDates: [] } });
    if (path.endsWith('/progress')) return failHistory ? route.fulfill({ status: 500, json: { message: 'Unavailable' } }) : route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  await page.goto('/goals');
  await expect(page.getByRole('heading', { name: 'Choose your goal' })).toBeVisible();
  await expect(page.getByText('No date set')).toBeVisible();
  const checkinsError = page.getByRole('alert').filter({ hasText: 'check-ins couldn’t be loaded' });
  await expect(checkinsError).toBeVisible();
  failHistory = false;
  await checkinsError.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Your first check-in starts here')).toBeVisible();
});
