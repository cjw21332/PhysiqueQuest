import { test, expect } from '@playwright/test';

const profile = { name: 'Toji Fushiguro', email: 'member@example.test', goal: 'Build muscle', duration: '45 min', equipment: ['Dumbbells'] };
const nutrition = { meals: [], water: [] };
const activity = { state: { level: 2, currentExp: 10, nextLevelExp: 100, dayStreak: 1, earnedPoints: 0 }, dailyMissions: [{ key: 'water', title: 'Drink 8 glasses of water', progress: 1, target: 8, points: 40, complete: false }], badges: [] };
const makePlan = title => ({ goal: 'Build muscle', duration: '45 min', weekLabel: 'Your weekly plan', libraryReady: true, sets: '3 × 10', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ name, index, isWorkoutDay: true, title, equipmentLabel: 'Dumbbells', exercises: [{ exerciseId: 'row', name: 'Dumbbell row', tracking: 'Manual', prescription: '3 × 10' }] })) });

async function setup(page, savedWater = false) {
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('cache-test-auth-seeded')) {
      localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'cached-user', token: 'test-session' }));
      sessionStorage.setItem('cache-test-auth-seeded', 'true');
    }
  });
  let mode = 'ready', title = 'Saved workout', release;
  let nutritionState = savedWater ? { meals: [], water: [{ date: '2026-10-19', glasses: 1 }] } : structuredClone(nutrition);
  let barrier = Promise.resolve();
  const calls = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    calls.push({ path, method: request.method() });
    if (mode === 'offline') return route.abort('failed');
    if (mode === 'unauthorized') return route.fulfill({ status: 401, json: { message: 'Session expired' }, headers });
    if (mode === 'blocked' || mode === 'profile-blocked' && path.endsWith('/profile')) await barrier;
    let json = {};
    if (path.endsWith('/profile')) json = profile;
    if (path.endsWith('/nutrition')) json = nutritionState;
    if (path.endsWith('/nutrition/water') && request.method() === 'PUT') {
      const { date, glasses } = request.postDataJSON();
      nutritionState = { ...nutritionState, water: [{ date, glasses }] };
      json = nutritionState;
    }
    if (path.endsWith('/activity/state')) json = activity;
    if (path.endsWith('/coach/plan')) json = makePlan(title);
    if (path.endsWith('/settings')) json = { values: {} };
    return route.fulfill({ json, headers });
  });
  return {
    calls,
    block(nextMode = 'blocked') { mode = nextMode; barrier = new Promise(resolve => { release = resolve; }); },
    release(nextTitle = title) { title = nextTitle; mode = 'ready'; release?.(); },
    offline() { mode = 'offline'; },
    unauthorized() { mode = 'unauthorized'; },
  };
}

test('starts all four reads before the profile finishes and deduplicates Home consumers', async ({ page }) => {
  const fixture = await setup(page);
  fixture.block('profile-blocked');
  await page.goto('/home');
  await expect.poll(() => new Set(fixture.calls.map(call => call.path)).size).toBe(4);
  expect(fixture.calls.every(call => call.method === 'GET')).toBe(true);
  fixture.release();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  expect(fixture.calls.filter(call => call.path.endsWith('/coach/plan'))).toHaveLength(1);
  expect(fixture.calls.filter(call => call.path.endsWith('/nutrition'))).toHaveLength(1);
});

test('restores saved Home, Coach and Scan data while refreshing, then replaces it', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  fixture.block();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  await expect(page.locator('.cache-notice')).toContainText('Showing saved data');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  fixture.release('Updated workout');
  await expect(page.getByRole('heading', { name: 'Updated workout' })).toBeVisible();
  await expect(page.locator('.cache-notice')).toHaveCount(0);
  fixture.block();
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: 'Updated workout' })).toBeVisible();
  await page.goto('/scan');
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  await page.goto('/quests');
  await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
  await expect(page.getByText('Drink 8 glasses of water', { exact: true })).toBeVisible();
  fixture.release();
});

test('offline refresh keeps saved data, but another account never sees it', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  fixture.offline();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  await expect(page.locator('.cache-notice')).toContainText('Could not refresh');
  await page.evaluate(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'other-user', token: 'other-session' })));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /retry|try again/i })).toBeVisible();
});

test('an expired login leaves cached screens and returns to launch', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  fixture.unauthorized();
  await page.reload();
  await expect(page).toHaveURL(/\/launch$/);
  expect(await page.evaluate(() => localStorage.getItem('physiquequest-auth'))).toBeNull();
});

test('a confirmed water write updates the saved snapshot and survives a slow reload', async ({ page }) => {
  const fixture = await setup(page, true);
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Log & water intake' }).click();
  await page.getByRole('button', { name: 'Set water intake to 3 glasses', exact: true }).click();
  await expect(page.locator('.target-log-water')).toContainText('3 / 8 glasses');
  fixture.block();
  await page.reload();
  await page.getByRole('button', { name: 'Log & water intake' }).click();
  await expect(page.locator('.target-log-water')).toContainText('3 / 8 glasses');
  fixture.release();
});

test('two tabs settle their reads and cross-tab logout exits both protected views', async ({ page, context }) => {
  const first = await setup(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  const second = await context.newPage();
  const other = await setup(second);
  await second.goto('/home');
  await expect(second.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(first.calls).toHaveLength(4);
  expect(other.calls).toHaveLength(4);
  await second.evaluate(() => localStorage.removeItem('physiquequest-auth'));
  await expect(page).toHaveURL(/\/launch$/);
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toHaveCount(0);
  await second.close();
});

test('every main tab switches without reloading the document or flashing cached loading screens', async ({ page }) => {
  test.setTimeout(45_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page, true);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  await page.evaluate(() => {
    window.tabNavigationMarker = 'same-document';
    window.tabLoadingFlashes = [];
    const check = () => {
      const text = document.querySelector('main')?.textContent ?? '';
      for (const label of ['Loading your profile', 'Loading quests', 'Loading nutrition', 'Building your plan']) {
        if (text.includes(label)) window.tabLoadingFlashes.push(label);
      }
    };
    window.tabLoadingObserver = new MutationObserver(check);
    window.tabLoadingObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  const tabs = ['Home', 'Coach', 'Scan', 'Quests', 'Me'];
  for (const from of tabs) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: from, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${from.toLowerCase()}$`));
    for (const to of tabs) {
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: to, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${to.toLowerCase()}$`));
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => window.tabNavigationMarker)).toBe('same-document');
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: from, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${from.toLowerCase()}$`));
    }
  }
  expect(await page.evaluate(() => window.tabLoadingFlashes)).toEqual([]);
});
