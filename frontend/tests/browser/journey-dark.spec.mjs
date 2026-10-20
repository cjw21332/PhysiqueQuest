import { test, expect } from '@playwright/test';
import { expectDarkPalette, expectReferenceLayout, expectHomeBack } from './theme-layout-helpers.mjs';

async function fixtures(page) {
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  const profile = { name: 'Toji', email: 'toji@example.test', goal: 'Build muscle', weight: '59.5', weightUnit: 'kg', targetWeight: '74', targetDate: '2027-03-31', duration: '45 min', equipment: ['Dumbbells'], days: ['Monday', 'Wednesday', 'Friday', 'Saturday'], createdAt: '2026-10-05' };
  const weights = Array.from({ length: 8 }, (_, i) => ({ _id: `weight-${i}`, metric: 'weight', unit: 'kg', value: Number((66.4 + i * .3).toFixed(1)), measuredAt: new Date(Date.UTC(2026, 7, 24 + i * 8)).toISOString() }));
  let measurements = [...weights];
  let items = [
    { id: 'safety', icon: 'shield', title: 'Emergency alert sent — Nov 14, 7:42 PM', subtitle: '', body: 'Maria Dela Cruz was notified. Review the flagged session.', time: 'now', unread: true, group: 'Earlier' },
    { id: 'missions', icon: 'target', title: '2 missions left', subtitle: '', body: 'Finish before midnight to keep your 12-day streak', time: '2h', unread: true, group: 'Today' },
    { id: 'report', icon: 'clipboard', title: 'Post-workout report ready', subtitle: '', body: 'Upper Body — Push · 88% form score', time: '5h', unread: true, group: 'Today' },
    { id: 'rank', icon: 'trend', title: 'You moved up to rank 14', subtitle: '', body: 'Weekly leaderboard · friends', time: '8h', unread: true, group: 'Today' },
    { id: 'streak', icon: 'minus-circle', title: 'Streak penalty applied', subtitle: '', body: '−50 points · 1 strike for a missed day', time: '2d', unread: false, group: 'Earlier' },
  ];
  let marks = 0;
  let saved;
  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = profile;
    if (path.endsWith('/workouts')) json = [];
    if (path.endsWith('/settings')) json = { values: {} };
    if (path.endsWith('/activity/state')) json = { state: { level: 7, dayStreak: 12, earnedPoints: 1840, currentExp: 600, nextLevelExp: 1000 }, dailyMissions: [
      { key: 'workout', title: 'Complete one workout', progress: 0, target: 1, complete: false },
      { key: 'meals', title: 'Log 3 meals', progress: 2, target: 3, complete: false },
      { key: 'water', title: 'Drink 8 glasses of water', progress: 5, target: 8, complete: false },
    ] };
    if (path.endsWith('/nutrition')) json = { meals: [{ id: 'meal', date: '2026-10-19', calories: 1400, protein: 96, carbs: 180, fat: 42 }], water: [{ date: '2026-10-19', glasses: 5 }] };
    if (path.endsWith('/coach/plan')) json = { duration: '45 min', days: Array.from({ length: 7 }, (_, i) => ({ index: i, isWorkoutDay: true, title: 'Upper Body — Push', exercises: Array.from({ length: 6 }, () => ({ name: 'Exercise', tracking: 'AI tracked' })) })) };
    if (path.endsWith('/progress')) {
      if (req.method() === 'POST') { saved = req.postDataJSON(); measurements.push({ ...saved, _id: 'new-weight' }); json = measurements.at(-1); }
      else json = url.searchParams.get('metric') === 'weight' ? measurements : [];
    }
    if (req.method() === 'DELETE' && /\/progress\/[^/]+$/.test(path)) {
      measurements = measurements.filter(item => item._id !== path.split('/').at(-1));
      json = { deleted: true };
    }
    if (path.endsWith('/notifications')) json = { items };
    if (path.endsWith('/notifications/read-all')) { marks++; items = items.map(item => ({ ...item, unread: false })); json = { items }; }
    if (/\/notifications\/[^/]+\/read$/.test(path)) { const id = path.split('/').at(-2); items = items.map(item => item.id === id ? { ...item, unread: false } : item); json = { items }; }
    return route.fulfill({ json, headers });
  });
  return { get marks() { return marks; }, get saved() { return saved; } };
}

async function capture(page, info, name) {
  await page.evaluate(() => document.fonts.ready);
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
}

test('account dark references preserve all editor navigation and save controls', async ({ page }, info) => {
  await fixtures(page);
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
  await expect(page.locator('.account-dark-theme')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('.me-row-copy b').first()).toHaveCSS('color', 'rgb(248, 250, 252)');
  await capture(page, info, 'account-dark');
  for (const title of ['Personal data', 'Goals', 'Training preference', 'Health profile', 'Emergency contact']) {
    await page.locator('.me-row').filter({ has: page.locator('b', { hasText: title }) }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.me-reference-edit')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    const footer = await page.locator('.edit-footer').boundingBox();
    expect(footer.y + footer.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    await capture(page, info, `edit-${title.replaceAll(' ', '-')}`);
    await page.getByRole('button', { name: 'Go back' }).click();
  }
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('Updated name');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.me-profile-name b')).toHaveText('Toji');
  let saved;
  await page.route('**/api/profile', async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: saved, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('Saved name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.me-profile-name b')).toHaveText('Saved name');
  expect(saved.name).toBe('Saved name');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dark quests retain leaderboard period selection and return navigation', async ({ page }, info) => {
  await fixtures(page);
  await page.route('**/api/leaderboard**', route => route.fulfill({ json: {
    entries: Array.from({ length: 7 }, (_, i) => ({ userId: `player-${i}`, rank: i + 1, name: ['Levi M.', 'Charles W.', 'Michael A.', 'Rico M.', 'Angel P.', 'Karl D.', 'Bea S.'][i], points: 4210 - i * 180, movement: i % 2 ? 2 : null })),
    self: { rank: 14, points: 1840, movement: 3 },
  }, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/quests');
  await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
  await expect(page.locator('.quest-v2-level-card')).toHaveCSS('background-color', 'rgb(20, 59, 38)');
  await capture(page, info, 'quests-dark');
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await expect(page.locator('.podium-player')).toHaveCount(3);
  await page.getByRole('tab', { name: 'This month' }).click();
  await expect(page.getByRole('tab', { name: 'This month' })).toHaveAttribute('aria-selected', 'true');
  await capture(page, info, 'leaderboard-dark');
  await page.getByRole('button', { name: 'Back to quests' }).click();
  await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
});

test('dark dashboard, goals and progress match reference layouts and preserve measurement saving', async ({ page }, info) => {
  const state = await fixtures(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  await expect(page.getByText('1,840', { exact: true })).toBeVisible();
  await expect(page.locator('.home-section')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expectReferenceLayout(page, ['.home-section', '.home-content', '.home-ref-dashboard', '.home-ref-header', '.home-ref-workout', '.home-bottom-nav']);
  await capture(page, info, '01-dashboard');
  await page.locator('.home-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, info, '02-dashboard-scrolled');
  await page.getByRole('button', { name: /Goals & milestones/ }).click();
  await expect(page.getByRole('heading', { name: 'Goals', exact: true })).toBeVisible();
  await expectHomeBack(page);
  await expectReferenceLayout(page, ['.home-ref-goals-page', '.section-page-head', '.home-ref-goal', '.home-ref-milestones']);
  await expect(page.getByRole('progressbar', { name: 'Progress toward target weight' })).toHaveAttribute('aria-valuenow', '62');
  await capture(page, info, '03-goals');
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await page.getByRole('button', { name: /Progress Review saved measurements/ }).click();
  await expect(page.getByText('68.5 kg', { exact: true }).first()).toBeVisible();
  await expectHomeBack(page);
  await expect(page.locator('.section-page-head').getByRole('button', { name: 'Add measurement', exact: true })).toBeVisible();
  await expectReferenceLayout(page, ['.home-ref-progress-page', '.section-page-head', '.home-ref-metric-tabs', '.home-ref-chart', '.home-ref-history']);
  await capture(page, info, '04-progress');
  await page.locator('.home-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, info, '05-progress-scrolled');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add measurement', exact: true }).click();
  await page.getByLabel('Log weight (kg)').fill('69');
  await page.getByRole('button', { name: 'Save measurement', exact: true }).click();
  await expect.poll(() => state.saved?.value).toBe(69);
  await expect(page.locator('.home-ref-measurement strong')).toHaveText('69 kg');
  await page.locator('.home-ref-history summary').click();
  await page.getByRole('button', { name: 'Delete 69 kg measurement', exact: true }).click();
  await expect(page.locator('.home-ref-measurement strong')).toHaveText('68.5 kg');
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
});

test('dark notifications preserve individual and mark-all read actions', async ({ page }, info) => {
  const state = await fixtures(page);
  await page.goto('/home');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expectHomeBack(page);
  await expectReferenceLayout(page, ['.home-notifications', '.section-page-head', '.notification-safety-card', '.notification-item']);
  await expect(page.getByRole('region', { name: 'Pinned safety notice' })).toBeVisible();
  await capture(page, info, '06-notifications');
  await page.getByRole('button', { name: '2 missions left, unread', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 missions left', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect.poll(() => state.marks).toBe(1);
  await expect(page.locator('.unread-dot')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
});

test('Scan nutrition, estimate, and log use the dark reference palette', async ({ page }, info) => {
  await fixtures(page);
  await page.route('**/api/nutrition', route => route.fulfill({
    json: { meals: [], water: [] },
    headers: { 'access-control-allow-origin': '*' },
  }));

  await page.goto('/scan');
  await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();
  await page.getByRole('button', { name: 'View sample nutrition' }).click();
  await expect(page.locator('.scan-dark-theme')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('.scan-reference')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expect(page.locator('.home-bottom-nav')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  await expect(page.locator('.circle-bg')).toHaveCSS('stroke', 'rgb(39, 52, 68)');
  await expect(page.locator('.scan-dashboard-scan')).toHaveCSS('color', 'rgb(11, 15, 21)');
  await expect(page.locator('.scan-dashboard-header h1')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.scan-reference')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.calorie-amount')).toHaveText('1,420');
  await expect(page.locator('.calorie-amount')).toHaveCSS('color', 'rgb(248, 250, 252)');
  await expect(page.locator('.home-calorie-progress')).toHaveCSS('width', '110px');
  await expect(page.locator('.scan-calories-remaining')).toHaveCSS('font-size', '14px');
  await capture(page, info, 'scan-dark-dashboard');

  await page.getByRole('button', { name: /Scan your meal/ }).click();
  await page.getByRole('button', { name: 'View sample estimate' }).click();
  await expect(page.getByRole('heading', { name: 'Review estimate' })).toBeVisible();
  await expect(page.locator('.scan-warning')).toHaveCSS('background-color', 'rgb(72, 9, 9)');
  await expect(page.locator('.detected-items > li').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.detected-item-body b').first()).toHaveCSS('font-size', '15px');
  await expect(page.locator('.review-estimate-footer .primary')).toHaveCSS('color', 'rgb(11, 15, 21)');
  await capture(page, info, 'scan-dark-review');

  await page.getByRole('button', { name: 'Back to Nutrition' }).click();
  await page.getByRole('button', { name: 'Log & water intake' }).click();
  await expect(page.getByRole('heading', { name: "Today's log" })).toBeVisible();
  await expect(page.locator('.scan-reference')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expect(page.locator('.target-log-macro > div:first-child').first()).toHaveCSS('font-size', '13px');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await capture(page, info, 'scan-dark-log');
});

test('Scan add, edit, and history views use readable dark type and semantic colors', async ({ page }, info) => {
  await fixtures(page);
  await page.route('**/api/nutrition/foods/search**', route => route.fulfill({
    json: { request_id: 'scan-ui', candidates: [{ fdc_id: 123, description: 'Chicken breast', data_type: 'Foundation' }] },
    headers: { 'access-control-allow-origin': '*' },
  }));
  await page.route('**/api/nutrition', route => route.fulfill({
    json: {
      meals: [{
        id: 'breakfast-1', date: '2026-10-19', name: 'Oats and eggs', meal: 'Breakfast',
        calories: 420, protein: 28, carbs: 54, fat: 12, detail: 'Rolled oats and egg',
        time: '07:20', source: 'Scanned',
      }],
      water: [{ date: '2026-10-19', glasses: 5 }],
    },
    headers: { 'access-control-allow-origin': '*' },
  }));

  await page.goto('/scan');
  await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();
  await page.getByRole('button', { name: 'Manual entry' }).click();
  await expect(page.getByRole('heading', { name: 'Add food' })).toBeVisible();
  await expect(page.locator('.food-search input')).toHaveCSS('color', 'rgb(248, 250, 252)');
  await expect(page.locator('.recent-foods button').first()).toHaveCSS('font-size', '13px');
  await expect(page.locator('.calculated-head h3')).toHaveCSS('font-size', '16px');
  await page.getByRole('textbox', { name: 'Search food' }).fill('Chicken');
  await expect(page.getByRole('button', { name: /Chicken breast/ })).toBeVisible();
  await expect(page.locator('.food-result-list > button b')).toHaveCSS('font-size', '15px');
  await capture(page, info, 'scan-dark-add-food');

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Log & water intake' }).click();
  await page.getByRole('button', { name: 'Edit Breakfast: Oats and eggs' }).click();
  await expect(page.getByRole('heading', { name: 'Edit meal' })).toBeVisible();
  await expect(page.locator('.meal-edit-caption')).toHaveCSS('font-size', '14px');
  await expect(page.getByRole('searchbox', { name: 'Food name' })).toHaveCSS('font-size', '16px');
  await expect(page.locator('.meal-food-search-hint')).toHaveCSS('color', 'rgb(148, 163, 184)');
  await page.getByRole('searchbox', { name: 'Food name' }).fill('Egg');
  await expect(page.locator('.meal-food-suggestions .food-result-list > button b')).toHaveCSS('font-size', '15px');
  await capture(page, info, 'scan-dark-edit-meal');

  await page.getByRole('button', { name: "Back to Today's Log" }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Food history' })).toBeVisible();
  await expect(page.locator('.history-caption')).toHaveCSS('font-size', '14px');
  await expect(page.locator('.history-entry b').first()).toHaveCSS('font-size', '15px');
  await expect(page.locator('.history-chart')).toBeVisible();
  await capture(page, info, 'scan-dark-food-history');

  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
