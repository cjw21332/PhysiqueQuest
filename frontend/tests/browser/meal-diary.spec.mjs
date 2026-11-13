import { test, expect } from '@playwright/test';

test('meal diary expands individually saved foods and opens one for editing', async ({ page }) => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const meals = [
    { id: 'a', name: 'Egg', meal: 'Breakfast', date, calories: 80, protein: 7, carbs: 0, fat: 5, detail: '', source: 'Scanned', time: '08:00' },
    { id: 'b', name: 'Toast', meal: 'Breakfast', date, calories: 100, protein: 3, carbs: 20, fat: 1, detail: '', source: 'Scanned', time: '08:00' },
  ];
  let water = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'diary-user', name: 'Test', email: 'test@example.test', emailVerified: true } };
    if (path.endsWith('/profile')) json = { name: 'Test', goal: 'General fitness', equipment: [], days: [] };
    if (path.endsWith('/nutrition/water')) { water = route.request().postDataJSON().glasses; json = { meals, water: [{ date, glasses: water }], dietaryPlan: { goal: 'Maintenance', calories: 2000, protein: 30, carbs: 45, fat: 25 } }; }
    else if (path.endsWith('/nutrition')) json = { meals, water: [{ date, glasses: water }], dietaryPlan: { goal: 'Maintenance', calories: 2000, protein: 30, carbs: 45, fat: 25 } };
    if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    if (path.endsWith('/notifications')) json = { items: [] };
    if (path.endsWith('/workouts')) json = [];
    if (path.endsWith('/coach/plan')) json = { days: [] };
    await route.fulfill({ json });
  });
  await page.goto('/home');
  await expect(page.getByRole('img', { name: '180 of 2000 calories logged' })).toBeVisible();
  await expect(page.getByText('10 / 150 g')).toBeVisible();
  await page.goto('/scan');
  await expect(page.getByRole('img', { name: '180 of 2000 calories logged' })).toBeVisible();
  await page.getByRole('button', { name: 'Add one glass of water' }).click();
  await expect(page.getByRole('progressbar', { name: 'Water intake toward eight glasses' })).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Remove one glass of water' }).click();
  await expect(page.getByRole('progressbar', { name: 'Water intake toward eight glasses' })).toHaveAttribute('aria-valuenow', '0');
  const breakfast = page.getByRole('button', { name: /Breakfast.*Egg and 1 more/i });
  await expect(breakfast).toBeVisible();
  await expect(breakfast).toHaveAttribute('aria-expanded', 'false');
  await breakfast.click();
  await expect(page.getByRole('button', { name: 'Edit Egg in Breakfast' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Toast in Breakfast' })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Add food to Breakfast' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Edit Toast in Breakfast' }).click();
  await expect(page.getByRole('heading', { name: 'Edit meal' })).toBeVisible();
  await expect(page.getByLabel('Food name')).toHaveValue('Toast');
});
