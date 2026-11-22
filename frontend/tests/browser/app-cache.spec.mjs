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
  let mode = 'ready', title = 'Saved workout', release, account = 'cached-user';
  let nutritionState = savedWater ? { meals: [], water: [{ date: '2026-10-19', glasses: 1 }] } : structuredClone(nutrition);
  let barrier = Promise.resolve();
  const calls = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/auth/session/migrate') || path.endsWith('/auth/session/refresh')) {
      if (mode === 'unauthorized') return route.fulfill({ status: 401, json: { message: 'Session expired' }, headers });
      if (path.endsWith('/migrate')) account = request.headers().authorization === 'Bearer other-session' ? 'other-user' : 'cached-user';
      return route.fulfill({ json: { user: { id: account, name: profile.name, email: profile.email, emailVerified: true }, access_token: 'test-session', expires_in: 3600 }, headers });
    }
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
    if (path.endsWith('/notifications')) json = { items: [], reminder: null };
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
  await expect.poll(() => new Set(fixture.calls.map(call => call.path)).size).toBeGreaterThanOrEqual(4);
  expect(fixture.calls.every(call => call.method === 'GET')).toBe(true);
  fixture.release();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  expect(fixture.calls.filter(call => call.path.endsWith('/coach/plan'))).toHaveLength(1);
  expect(fixture.calls.filter(call => call.path.endsWith('/nutrition'))).toHaveLength(1);
});

test('Me shows saved information offline and prevents edits until reconnecting', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Inactivity monitoring' })).toBeVisible();
  fixture.offline();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const offlineDialog = page.getByRole('button', { name: 'Continue offline' });
  await expect(offlineDialog).toBeVisible();
  await offlineDialog.click();
  await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
  await expect(page.getByText(profile.name)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Inactivity monitoring' })).toBeDisabled();
  await page.getByRole('button', { name: /Personal data/ }).click();
  await expect(page.getByLabel('Full name')).toHaveValue(profile.name);
  await expect(page.getByLabel('Full name')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go back' }).click();
  fixture.release();
  await page.evaluate(() => window.dispatchEvent(new Event('physiquequest:connection-restored')));
  await expect(page.getByRole('switch', { name: 'Inactivity monitoring' })).toBeEnabled();
});

test('offline tabs open their own screens and personal exercises persist locally', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto('/scan');
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  await expect(page.locator('.greeting-meta')).toContainText('October 19, 2026');
  await page.waitForTimeout(1500);
  fixture.offline();
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
  const continueOffline = page.getByRole('button', { name: 'Continue offline' });
  await expect(continueOffline).toBeVisible();
  await continueOffline.click();
  await page.evaluate(() => { window.offlineNavigationMarker = 'preserved'; });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Me, account and settings' }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
  expect(await page.evaluate(() => window.offlineNavigationMarker)).toBe('preserved');
  await page.getByRole('button', { name: /My exercises/ }).click();
  await expect(page.getByText('Offline · your saved exercises are read-only.')).toHaveCount(0);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByLabel('Exercise Name').fill('Offline cable row');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page.getByText('Offline Cable Row', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to account settings' }).click();
  await page.getByRole('button', { name: /My exercises/ }).click();
  await expect(page.getByText('Offline Cable Row', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to account settings' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Scan food and nutrition' }).click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  await expect(page.getByText('Offline · showing saved nutrition')).toHaveCount(0);
});

test('offline leaderboard shows a preview and reconnects only after a successful check', async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() => sessionStorage.setItem('pq-offline-dismissed', '1'));
  await page.addLocatorHandler(page.getByRole('dialog', { name: "You're offline" }), async dialog => {
    await dialog.getByRole('button', { name: 'Continue offline' }).click();
  });
  let leaderboardAvailable = false;
  await page.route('**/api/leaderboard?*', route => leaderboardAvailable
    ? route.fulfill({ json: { entries: [], self: { rank: 1, points: 0, movement: 0 } } })
    : route.abort('failed'));
  await page.goto('/quests');
  await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
  fixture.offline();
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect to see rankings' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.leaderboard-offline-preview')).toBeVisible();
  await expect(page.locator('.leaderboard-offline-preview')).toHaveAttribute('inert', '');
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog.getByRole('status')).toContainText('Still offline');
  await dialog.getByRole('button', { name: 'Back to quests' }).click();
  await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  fixture.release(); leaderboardAvailable = true;
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }));
  await page.getByRole('dialog', { name: 'Connect to see rankings' }).getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('dialog', { name: 'Connect to see rankings' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Leaderboard', exact: true })).toBeVisible();
});

test('measurement errors use clear language without exposing technical details', async ({ page }) => {
  await setup(page);
  await page.route('**/api/progress', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, json: { message: 'Internal server error' } })
    : route.fulfill({ json: [] }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/progress');
  await page.getByRole('button', { name: 'Chest', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Log chest (cm)').fill('90');
  await page.getByRole('button', { name: 'Save measurement' }).click();
  const dialog = page.getByRole('dialog', { name: 'Something went wrong' });
  await expect(dialog).toContainText('Something went wrong on our end. Please try again in a moment.');
  await expect(dialog).not.toContainText(/api|server|database|500/i);
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toHaveCount(0);
});

test('page headings align the back icon and title consistently', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [url, title] of [['/goals', 'Goals'], ['/progress', 'Progress'], ['/me/personal-data', 'Personal data']]) {
    await page.goto(url);
    const header = page.locator('.pq-page-heading').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(header).toBeVisible();
    const back = header.locator('.coach-back');
    const heading = header.getByRole('heading', { name: title, exact: true });
    const iconBox = await back.boundingBox();
    const titleBox = await heading.boundingBox();
    expect(iconBox.width).toBe(44);
    expect(titleBox.x - (iconBox.x + iconBox.width)).toBe(8);
    expect(Math.abs((iconBox.y + iconBox.height / 2) - (titleBox.y + titleBox.height / 2))).toBeLessThan(2);
    expect(await heading.evaluate(node => getComputedStyle(node).fontSize)).toBe('17px');
  }
});

test('Progress keeps the same divided header as Goals while scrolling', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const styles = [];
  for (const [url, title] of [['/goals', 'Goals'], ['/progress', 'Progress']]) {
    await page.goto(url);
    const header = page.locator('.section-page-head').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(header).toBeVisible();
    const before = await header.boundingBox();
    styles.push(await header.evaluate(node => ({ position: getComputedStyle(node).position, border: getComputedStyle(node).borderBottomWidth, color: getComputedStyle(node).borderBottomColor, height: getComputedStyle(node).height })));
    await page.locator('.home-content').evaluate(node => { node.scrollTop = 400; });
    await expect.poll(() => page.locator('.home-content').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    const after = await header.boundingBox();
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    await expect(header.getByRole('button', { name: /back/i })).toBeVisible();
  }
  expect(styles[1]).toEqual(styles[0]);
  expect(styles[1].position).toBe('sticky');
  expect(styles[1].border).toBe('1px');
});

test('dietary plan keeps its divided header visible while scrolling', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/scan/plan');
  const header = page.locator('.diet-header');
  await expect(header.getByRole('heading', { name: 'My Dietary Plan' })).toBeVisible();
  const before = await header.boundingBox();
  const styles = await header.evaluate(node => ({ position: getComputedStyle(node).position, border: getComputedStyle(node).borderBottomWidth }));
  await page.locator('.scan-content').evaluate(node => { node.scrollTop = 400; });
  await expect.poll(() => page.locator('.scan-content').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const after = await header.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  expect(styles).toEqual({ position: 'sticky', border: '1px' });
  await expect(header.getByRole('button', { name: 'Back to Nutrition' })).toBeVisible();
});

test('meal schedule displays calculated allocations in a compact mobile layout', async ({ page }, info) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/scan/plan');
  await page.getByRole('button', { name: 'Meal Schedule' }).click();
  await expect(page.getByRole('heading', { name: 'Suggested Meal Schedule' })).toBeVisible();
  const meals = page.locator('.diet-schedule-meal');
  await expect(meals).toHaveCount(4);
  await expect(meals.first()).toContainText('~506 kcal');
  await expect(meals.first()).toContainText('38g P');
  await expect(page.getByText(/Meal allocations and timing are suggestions/)).toHaveCount(1);
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const meal of await meals.all()) expect(await meal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('meal-schedule.png') });
});

test('restores saved Home, Coach and Scan data while refreshing, then replaces it', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  fixture.block();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saved workout' })).toBeVisible();
  await expect(page.locator('.cache-notice')).toHaveCount(0);
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
  await expect(page.locator('.cache-notice')).toHaveCount(0);
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
  await expect.poll(async () => {
    const counts = [first.calls.length, other.calls.length];
    await page.waitForTimeout(500);
    return first.calls.length === counts[0] && other.calls.length === counts[1];
  }, { timeout: 10_000 }).toBe(true);
  await second.evaluate(() => localStorage.setItem('physiquequest-logout', String(Date.now())));
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
  const tabName = tab => ({ Scan: 'Scan food and nutrition', Me: 'Me, account and settings' }[tab] ?? tab);
  for (const from of tabs) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: tabName(from), exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${from.toLowerCase()}$`));
    for (const to of tabs) {
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: tabName(to), exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${to.toLowerCase()}$`));
      await expect(page.locator('.cache-notice')).toHaveCount(0);
      await expect(page.getByText(/Showing (?:available )?saved data while checking for updates/i)).toHaveCount(0);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => window.tabNavigationMarker)).toBe('same-document');
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: tabName(from), exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${from.toLowerCase()}$`));
    }
  }
  expect(await page.evaluate(() => window.tabLoadingFlashes)).toEqual([]);
});
