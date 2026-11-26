import { test, expect } from '@playwright/test';

// The release "What's new" dialog would cover the page under test.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => sessionStorage.setItem('pq-whats-new-shown', '1')); });

const prescribed = [
  { exerciseId: 'catalog-pushup', name: 'Push-up', equipment: 'Bodyweight', prescription: '3 × 12', tracking: 'Manual' },
  { exerciseId: 'catalog-bench', name: 'Dumbbell bench press', equipment: 'Dumbbell', prescription: '4 × 10', tracking: 'Manual' },
  { exerciseId: 'catalog-overhead', name: 'Overhead press', equipment: 'Dumbbell', prescription: '3 × 10', tracking: 'Manual' },
  { exerciseId: 'catalog-lateral', name: 'Lateral raise', equipment: 'Dumbbell', prescription: '3 × 15', tracking: 'Manual' },
  { exerciseId: 'catalog-triceps', name: 'Triceps extension', equipment: 'Dumbbell', prescription: '3 × 12', tracking: 'Manual' },
  { exerciseId: 'catalog-plank', name: 'Plank', equipment: 'Bodyweight', prescription: '3 × 45 s', tracking: 'Manual' },
];
const plan = { goal: 'Build muscle', weekLabel: 'Week 3 · 4 sessions planned', duration: '45 min', libraryReady: true, sets: '3 × 10', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ index, label: name.slice(0, 3), name, isWorkoutDay: [0, 2, 4, 5].includes(index), title: index === 0 ? 'Upper Body — Push' : 'Recovery day', exercises: index === 0 ? prescribed : [], equipmentLabel: 'Dumbbell + Bodyweight', formTip: index === 0 ? { exerciseName: 'Dumbbell bench press', text: 'Keep your wrists stacked over your elbows.' } : null })) };

test('personal exercises fit the library and offer manual or video options without live tracking', async ({ page }) => {
  const item = { _id: 'personal-test', name: 'Machine Pec Deck Fly With An Extra Long Exercise Name', targetMuscle: 'Chest', equipment: 'Machine', pose: 'missing' };
  let started;
  await page.addInitScript(value => {
    const key = `physiquequest-personal-exercises:${encodeURIComponent(location.origin + '/api')}:choice-user`;
    localStorage.setItem(key, JSON.stringify([value]));
  }, item);
  const customPlan = { ...plan, days: plan.days.map(day => day.index === 0 ? { ...day, exercises: [{ exerciseId: item._id, name: item.name, group: 'Chest', targetMuscle: 'Chest', equipment: 'Machine', tracking: 'Manual', prescription: '3 × 10' }] } : day) };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'choice-user', name: 'Test', email: 'test@example.test', emailVerified: true } };
    else if (path.endsWith('/profile')) json = { name: 'Test', equipment: [], days: [], goal: 'General fitness' };
    else if (path.endsWith('/coach/plan')) json = customPlan;
    else if (path.endsWith('/workouts/active')) json = null;
    else if (path.endsWith('/exercises')) json = { items: [], total: 0, page: 1, limit: 12, pages: 1 };
    else if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    else if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    else if (path.endsWith('/notifications')) json = { items: [] };
    else if (path.endsWith('/workouts') && route.request().method() === 'POST') { started = route.request().postDataJSON(); json = { _id: 'manual-personal', status: 'active', revision: 0, startedAt: started.startedAt, exerciseIds: started.exerciseIds, exercises: started.exercises, sets: [], pausedSeconds: 0 }; }
    else if (path.endsWith('/workouts')) json = [];
    await route.fulfill({ json });
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  const choices = page.getByRole('dialog', { name: 'Choose how to train' });
  await expect(choices.getByRole('button', { name: /Live session/ })).toHaveCount(0);
  await expect(choices.getByRole('button', { name: /Review a video/ })).toBeVisible();
  await expect(choices.getByRole('button', { name: /Log manually/ })).toBeVisible();
  await choices.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: /Exercise library/ }).click();
  const card = page.locator('.personal-exercise-card');
  await expect(card.getByRole('heading', { name: item.name })).toBeVisible();
  await expect(card.getByRole('button', { name: /Log .* manually/ })).toBeVisible();
  await expect(card.getByRole('button', { name: /Review a video/ })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Start workout' })).toHaveCount(0);
  expect(await card.locator('h4').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await card.screenshot({ path: test.info().outputPath('personal-exercise-card.png') });
  await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('not a match');
  await expect(page.getByText('No personal exercises match these filters.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('pec');
  await card.getByRole('button', { name: /Review a video/ }).click();
  await expect(page.getByRole('heading', { name: 'Review a video' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable camera' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to AI Coach' }).click();
  await expect(page.getByRole('heading', { name: 'My exercises' })).toBeVisible();
  await card.getByRole('button', { name: /Log .* manually/ }).click();
  await expect.poll(() => started?.exerciseIds).toEqual([item._id]);
  await expect(page).toHaveURL(/\/coach\/session$/);
});

test('a restored session opens Home instead of account setup', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'returning-user', name: 'Test', email: 'test@example.test', emailVerified: true } };
    if (path.endsWith('/profile')) json = { name: 'Test', equipment: [], days: [], goal: 'General fitness' };
    if (path.endsWith('/coach/plan')) json = plan;
    if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    if (path.endsWith('/notifications')) json = { items: [] };
    if (path.endsWith('/workouts')) json = [];
    await route.fulfill({ json });
  });
  await page.goto('/launch');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Continue setup')).toHaveCount(0);
  await page.goto('/launch');
  await expect(page).toHaveURL(/\/home$/);
});

test('session choices open separate live and video preparation screens', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'choice-user', name: 'Test', email: 'test@example.test', emailVerified: true } };
    if (path.endsWith('/profile')) json = { name: 'Test', equipment: [], days: [], goal: 'General fitness' };
    if (path.endsWith('/coach/plan')) json = plan;
    if (path.endsWith('/workouts/active')) json = null;
    if (path.endsWith('/settings')) json = { values: {} };
    if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    if (path.endsWith('/notifications')) json = { items: [] };
    if (path.endsWith('/workouts')) json = [];
    await route.fulfill({ json });
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Monday, workout day' }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: /Review a video/ }).click();
  await expect(page.getByRole('heading', { name: 'Review a video' })).toBeVisible();
  await expect(page.getByText('Upload a recorded set')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable camera' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to AI Coach' }).click();
  await page.getByRole('button', { name: /Live session/ }).click();
  await expect(page.getByRole('heading', { name: 'Live camera setup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable camera' })).toBeVisible();
});

test('reference Coach layout renders server prescriptions and starts the chosen catalog exercises', async ({ page }) => {
  let started;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test' })));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/auth/session/migrate') || path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'test', name: 'Test', email: 'test@example.test', emailVerified: true } };
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
    await page.locator('.coach-scroll').evaluate(element => { element.scrollTop = 0; });
    expect(await page.locator('.cq-hero').evaluate(element => getComputedStyle(element).position)).toBe('static');
    // Start lives in the hero card; it must be reachable and clear of the bottom navigation.
    await page.getByRole('button', { name: 'Start session', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeInViewport();
    const start = await page.getByRole('button', { name: 'Start session', exact: true }).boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    const chat = await page.getByRole('button', { name: 'Open Phiq coach' }).boundingBox();
    expect(start.y + start.height).toBeLessThanOrEqual(nav.y);
    expect(chat.y + chat.height).toBeLessThanOrEqual(nav.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  const choices = page.getByRole('dialog', { name: 'Choose how to train' });
  await expect(choices.getByRole('button', { name: /Live session/ })).toBeVisible();
  await expect(choices.getByRole('button', { name: /Review a video/ })).toBeVisible();
  await choices.getByRole('button', { name: /Log manually/ }).click();
  await expect.poll(() => started?.exerciseIds).toEqual(prescribed.map(item => item.exerciseId));
});
