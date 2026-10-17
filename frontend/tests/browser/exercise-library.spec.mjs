import { test, expect } from '@playwright/test';

const exercise = { _id: 'api-press', slug: 'api-press', name: 'Backend seated press', targetMuscle: 'Shoulders', equipment: 'Dumbbells', trackingStatus: 'Manual', instructions: ['Keep feet planted.', 'Press overhead slowly.'], gifUrl: 'https://exercise.test/demo.gif', pose: 'missing', status: 'published', source: 'ExerciseDB V1' };
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function setup(page, catalog, detailHandler, role = 'user') {
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test-token' })));
  await page.route('https://exercise.test/demo.gif', route => route.fulfill({ contentType: 'image/gif', body: gif }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { id: 'test', role }, headers });
    if (url.pathname.endsWith('/exercises')) return catalog(route, url, headers);
    if (url.pathname.endsWith('/exercises/api-press')) return detailHandler ? detailHandler(route, headers) : route.fulfill({ json: { ...exercise, instructions: ['Keep feet planted.', 'Fresh detail: press overhead slowly.'] }, headers });
    const json = url.pathname.endsWith('/workouts') ? [] : url.pathname.endsWith('/active') ? null : url.pathname.endsWith('/profile') ? { name: 'Test', equipment: [] } : url.pathname.endsWith('/coach/plan') ? { days: [], weekLabel: 'Week' } : {};
    return route.fulfill({ json, headers });
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: /Exercise library/ }).click();
}

test('Coach library loads API records, searches, filters, pages and opens real details', async ({ page }) => {
  const queries = [];
  await setup(page, (route, url, headers) => {
    queries.push(Object.fromEntries(url.searchParams));
    const item = url.searchParams.get('page') === '2' ? { ...exercise, _id: 'second', name: 'Second page press' } : exercise;
    return route.fulfill({ json: { items: [item], total: 13, page: Number(url.searchParams.get('page') || 1), limit: 12, pages: 2 }, headers });
  });
  await expect(page.getByRole('button', { name: /Backend seated press/ })).toBeVisible();
  await expect(page.getByText('Sample library')).toHaveCount(0);
  await page.getByRole('button', { name: /Backend seated press/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Fresh detail: press overhead slowly.')).toBeVisible();
  await expect(page.getByText('AI tracked', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Not specified')).toHaveCount(0);
  const demonstration = page.getByRole('img', { name: `Exercise demonstration - ${exercise.name}`, exact: true });
  await page.getByRole('button', { name: 'Play exercise demonstration' }).click();
  await expect(demonstration).toBeVisible();
  await expect(demonstration).toHaveAttribute('src', exercise.gifUrl);
  const picture = await demonstration.boundingBox();
  const sheet = await page.getByRole('dialog').boundingBox();
  expect(picture.y).toBeGreaterThanOrEqual(sheet.y);
  expect(picture.width).toBeLessThanOrEqual(sheet.width);
  await page.getByRole('button', { name: 'Pause exercise demonstration' }).click();
  await expect(page.locator('.library-demo canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play exercise demonstration' })).toBeVisible();
  await page.getByRole('button', { name: 'Close exercise details' }).click();
  await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('seated');
  await expect.poll(() => queries.at(-1)?.search).toBe('seated');
  await page.getByRole('button', { name: 'Shoulders', exact: true }).click();
  await page.getByRole('button', { name: 'Dumbbells', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.equipment).toBe('Dumbbells');
  expect(queries.at(-1).muscle).toBe('Shoulders');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('button', { name: /Second page press/ })).toBeVisible();
});

test('details failure retries the provider and Escape returns focus to the exercise', async ({ page }) => {
  let attempts = 0;
  await setup(page, (route, url, headers) => route.fulfill({ json: { items: [exercise], total: 1, page: 1, limit: 12, pages: 1, source: 'ExerciseDB V1' }, headers }), (route, headers) => {
    attempts += 1;
    return attempts === 1 ? route.fulfill({ status: 503, json: { message: 'Exercise details unavailable' }, headers }) : route.fulfill({ json: exercise, headers });
  });
  const row = page.getByRole('button', { name: /Backend seated press/ });
  await row.click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Exercise details unavailable');
  await expect(page.getByText('Press overhead slowly.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry details' }).click();
  await expect(page.getByText('Press overhead slowly.')).toBeVisible();
  expect(attempts).toBe(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toBeFocused();
});

test('failed GIF reloads provider detail and stays truthful about media', async ({ page }) => {
  let detailRequests = 0;
  await setup(page, (route, url, headers) => route.fulfill({ json: { items: [exercise], total: 1, page: 1, limit: 12, pages: 1 }, headers }), (route, headers) => {
    detailRequests += 1;
    return route.fulfill({ json: { ...exercise, gifUrl: detailRequests === 1 ? 'https://exercise.test/broken.gif' : exercise.gifUrl }, headers });
  });
  await page.route('https://exercise.test/broken.gif', route => route.fulfill({ status: 404, body: '' }));
  await page.getByRole('button', { name: /Backend seated press/ }).click();
  await expect(page.getByText('Could not load this demonstration.')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry demonstration' }).click();
  await expect(page.getByRole('button', { name: 'Play exercise demonstration' })).toBeVisible();
  expect(detailRequests).toBe(2);
});

test('library and bottom sheet fit narrow phones and desktop', async ({ page }) => {
  await setup(page, (route, url, headers) => route.fulfill({ json: { items: [exercise], total: 1, page: 1, limit: 12, pages: 1 }, headers }));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'Any equipment', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Backend seated press/ }).click();
    await expect(page.getByText('Fresh detail: press overhead slowly.')).toBeVisible();
    const sheet = await page.getByRole('dialog').boundingBox();
    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(width);
    expect(Math.round(sheet.y + sheet.height)).toBe(844);
    expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Close exercise details' }).click();
  }
});

test('API failure stays visible, retry loads an honest empty library', async ({ page }) => {
  let fail = true;
  await setup(page, (route, url, headers) => fail ? route.fulfill({ status: 503, json: { message: 'Catalog temporarily unavailable' }, headers }) : route.fulfill({ json: { items: [], total: 0, page: 1, limit: 12, pages: 0 }, headers }));
  await expect(page.locator('.coach-library').getByRole('alert')).toContainText('Catalog temporarily unavailable');
  await expect(page.getByText('Dumbbell bench press', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No exercises match those filters.')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('No exercises match those filters.')).toBeVisible();
});

test('Me opens the backend admin catalog and saves muscle/equipment before refreshing', async ({ page }) => {
  let saved;
  const records = [{ ...exercise, group: 'Shoulders · Dumbbell' }];
  await setup(page, async (route, url, headers) => {
    if (!url.pathname.includes('/admin/')) return route.fulfill({ json: { items: [], total: 0, page: 1, limit: 12, pages: 0 }, headers });
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      records.push({ ...saved, _id: 'created' });
      return route.fulfill({ json: records.at(-1), headers });
    }
    return route.fulfill({ json: records, headers });
  }, undefined, 'admin');
  await page.goto('/me');
  await page.getByRole('button', { name: /Manage exercises/ }).click();
  await expect(page.getByText('Backend seated press', { exact: true })).toBeVisible();
  await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /New/ }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Catalog test row');
  await page.getByRole('textbox', { name: 'Equipment', exact: true }).fill('Dumbbell');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Catalog test row', { exact: true })).toBeVisible();
  expect(saved).toMatchObject({ name: 'Catalog test row', targetMuscle: 'Chest', equipment: 'Dumbbell', status: 'draft', pose: 'missing' });
});

test('Me admin denial renders authorization error without sample exercises', async ({ page }) => {
  await setup(page, (route, url, headers) => url.pathname.includes('/admin/') ? route.fulfill({ status: 403, json: { message: 'Forbidden' }, headers }) : route.fulfill({ json: { items: [], total: 0, page: 1, limit: 12, pages: 0 }, headers }), undefined, 'admin');
  await page.goto('/me');
  await page.getByRole('button', { name: /Manage exercises/ }).click();
  await expect(page.locator('.admin-tools-screen').getByRole('alert')).toContainText('Admin access is required');
  await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0);
});
