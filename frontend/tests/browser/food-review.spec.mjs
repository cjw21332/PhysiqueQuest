import { test, expect } from '@playwright/test';

test('reviews a scan, replaces a food, adds another and saves only included items', async ({ page }, testInfo) => {
  let scans = 0, saved;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'review', token: 'test' })));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let json = {};
    if (path.includes('/auth/session/')) json = { access_token: 'test', expires_in: 3600, user: { id: 'review', name: 'Test', email: 'test@example.test', emailVerified: true } };
    else if (path.endsWith('/profile')) json = { name: 'Test', goal: 'General fitness', equipment: [], days: [] };
    else if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    else if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    else if (path.endsWith('/workouts')) json = [];
    else if (path.endsWith('/nutrition/scan')) { scans++; json = { request_id: '1', model: 'test', degraded: false, unmatched: [], totals: { kcal: 100, protein_g: 10, carbs_g: 0, fat_g: 1 }, items: [{ food_name: 'chicken', est_weight_g: 100, confidence: 0.8, found: true, fdc_id: 1, description: 'Old chicken', per_100g: { kcal: 100, protein_g: 10, carbs_g: 0, fat_g: 1 }, kcal: 100, protein_g: 10, carbs_g: 0, fat_g: 1 }] }; }
    else if (path.endsWith('/nutrition/foods/search')) { const query = new URL(request.url()).searchParams.get('q'); json = { candidates: [{ fdc_id: query.toLowerCase().includes('egg') ? 3 : 2, description: query.toLowerCase().includes('egg') ? 'Fried egg' : 'Roasted chicken breast', data_type: 'Survey' }] }; }
    else if (path.endsWith('/nutrition/foods/2') || path.endsWith('/nutrition/foods/3')) { const egg = path.endsWith('/3'); json = { fdc_id: egg ? 3 : 2, description: egg ? 'Fried egg' : 'Roasted chicken breast', data_type: 'Survey', per_100g: { kcal: egg ? 200 : 165, protein_g: egg ? 10 : 31, carbs_g: 0, fat_g: 4 } }; }
    else if (path.endsWith('/nutrition/meals/from-scan')) { saved = request.postDataJSON(); json = { meals: [], water: [] }; }
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/scan');
  await page.getByRole('button', { name: /Scan your meal/ }).click();
  await page.getByLabel('Upload a meal photo').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aP8AAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('heading', { name: 'Review estimate' })).toBeVisible();
  await page.getByRole('button', { name: 'Change food' }).click();
  await page.getByRole('searchbox', { name: 'Food name' }).fill('roasted chicken');
  await page.getByRole('button', { name: /Roasted Chicken Breast/ }).click();
  await expect(page.getByText(/Selected: Roasted chicken breast/)).toBeVisible();
  await page.getByRole('button', { name: 'Use food' }).click();
  await page.getByLabel('Estimated weight for Roasted chicken breast in grams').fill('120');
  await expect(page.locator('.detected-items li').first().getByText(/198 kcal/)).toBeVisible();
  await page.getByRole('button', { name: 'Add missing food' }).click();
  await page.getByRole('searchbox', { name: 'Food name' }).fill('egg');
  await page.getByRole('button', { name: /Fried Egg/ }).click();
  await expect(page.getByText(/Selected: Fried egg/)).toBeVisible();
  await page.getByLabel('Weight (g)', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Use food' }).click();
  const egg = page.locator('.detected-items li').filter({ hasText: 'Fried Egg' });
  await egg.getByRole('button', { name: 'Exclude' }).click();
  await expect(egg.getByRole('button', { name: 'Restore' })).toBeVisible();
  await expect(page.locator('.estimated-macros').getByText('198', { exact: true })).toBeVisible();
  await egg.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.estimated-macros').getByText('298', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect.poll(() => saved).toBeTruthy();
  expect(saved.items).toHaveLength(2);
  expect(saved.idempotency_key).toMatch(/^[a-f0-9]{32}$/);
  expect(saved.items[0]).toMatchObject({ fdc_id: 2, est_weight_g: 120, identification_method: 'corrected' });
  expect(saved.items[1]).toMatchObject({ fdc_id: 3, est_weight_g: 50, identification_method: 'manual' });
  expect(scans).toBe(1);
});
