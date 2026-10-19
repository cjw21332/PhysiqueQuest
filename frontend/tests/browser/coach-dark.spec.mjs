import { test, expect } from '@playwright/test';
import { expectDarkPalette, expectReferenceLayout } from './theme-layout-helpers.mjs';

const exercises = [
  { exerciseId: 'push-up', name: 'Push-up', equipment: 'Bodyweight', prescription: '3 × 12', tracking: 'AI tracked' },
  { exerciseId: 'bench-press', name: 'Dumbbell bench press', equipment: 'Dumbbells', prescription: '4 × 10 · 22 kg', tracking: 'AI tracked' },
  { exerciseId: 'overhead-press', name: 'Overhead press', equipment: 'Dumbbells', prescription: '3 × 10 · 16 kg', tracking: 'AI tracked' },
  { exerciseId: 'lateral-raise', name: 'Lateral raise', equipment: 'Dumbbells', prescription: '3 × 15 · 6 kg', tracking: 'AI tracked' },
  { exerciseId: 'triceps-extension', name: 'Triceps extension', equipment: 'Dumbbells', prescription: '3 × 12 · 10 kg', tracking: 'Manual' },
  { exerciseId: 'plank', name: 'Plank', equipment: 'Bodyweight', prescription: '3 × 45 s', tracking: 'AI tracked' },
];

async function fixture(page) {
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  const profile = { name: 'Toji', equipment: ['Dumbbells'], duration: '45 min', contactName: 'Maria', contactPhone: '09123456789' };
  const catalog = exercises.map((item, i) => ({ ...item, _id: item.exerciseId, slug: item.exerciseId, targetMuscle: i === 1 ? 'Chest' : 'Shoulders', difficulty: 'Intermediate', trackingStatus: item.tracking, pose: 'ready', gifUrl: 'https://coach.test/demo.gif', recommended: '4 × 10', instructions: ['Lie flat with feet planted and a dumbbell in each hand at chest height.', 'Press both dumbbells up until your arms are straight over your shoulders.', 'Lower slowly until your elbows sit just below the bench line.', 'Pause for a beat, then press back up without bouncing.'], checks: ['Wrists stacked over elbows', 'Elbows at roughly 45° from your torso', 'Shoulder blades pinned to the bench'] }));
  await page.route('https://coach.test/demo.gif', route => route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
  let paused;
  let ended = false;
  let session;
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = profile;
    if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
    if (path.endsWith('/auth/me')) json = { id: 'visual', role: 'user' };
    if (path.endsWith('/coach/plan')) json = { weekLabel: 'Week 3 · 4 sessions planned', duration: '45 min', libraryReady: true, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ index, name, isWorkoutDay: [0, 2, 4, 5].includes(index), title: 'Upper Body — Push', exercises, equipmentLabel: 'Dumbbells', formTip: { exerciseName: 'Dumbbell bench press', text: 'Keep your wrists stacked over your elbows and lower until your upper arms are level with the bench.' } })) };
    if (path.endsWith('/exercises')) {
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const muscle = url.searchParams.get('muscle');
      const items = catalog.filter(item => (!search || item.name.toLowerCase().includes(search)) && (!muscle || item.targetMuscle === muscle));
      json = { items, total: items.length, page: 1, pages: 1, limit: 12 };
    }
    if (/\/exercises\/[^/]+$/.test(path)) json = catalog.find(item => item._id === path.split('/').at(-1));
    if (path.endsWith('/pose/status')) json = { available: true };
    if (path.endsWith('/pose/analyze')) json = { readiness: { fullBodyInFrame: true, lighting: true, distance: { meters: 2.7 } } };
    if (path.endsWith('/workouts') && req.method() === 'POST') { session = { _id: 'session-1', ...req.postDataJSON(), status: 'active' }; json = session; }
    if (path.endsWith('/pause')) { paused = req.postDataJSON().paused; json = session; }
    if (path.endsWith('/complete')) {
      ended = true;
      json = { ...session, ...req.postDataJSON(), durationSeconds: 2536, status: 'completed', sets: [{ exerciseId: 'bench-press', reps: 37, loadKg: 22, status: 'completed' }, { exerciseId: 'overhead-press', reps: 29, loadKg: 16, status: 'completed' }], exerciseResults: [{ exerciseId: 'push-up', reps: 36 }, { exerciseId: 'bench-press', reps: 37, loadKg: 22 }, { exerciseId: 'overhead-press', reps: 29, loadKg: 16 }] };
    }
    return route.fulfill({ json, headers });
  });
  return { get paused() { return paused; }, get ended() { return ended; } };
}

async function capture(page, info, name) {
  await page.evaluate(() => document.fonts.ready);
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
}

async function expectBackBeforeTitle(page) {
  const back = page.getByRole('button', { name: 'Back to AI Coach', exact: true });
  await expect(back).toBeVisible();
  const button = await back.boundingBox();
  const title = await page.locator('.coach-header h2').boundingBox();
  expect(button.x + button.width).toBeLessThanOrEqual(title.x);
  expect(button.width).toBeGreaterThanOrEqual(44);
}

test('dark Coach plan, library and exercise details retain filters, playback and close controls', async ({ page }, info) => {
  await fixture(page);
  await page.goto('/coach');
  await expect(page.locator('.exercise-item')).toHaveCount(6);
  await expect(page.locator('.coach-section')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  for (const selector of ['.coach-plan-header']) {
    await expect(page.locator(selector).first()).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  }
  await expect(page.locator('.home-bottom-nav')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  await expectReferenceLayout(page, ['.coach-scroll', '.coach-plan-header', '.day-button', '.exercise-item', '.start-button-container', '.home-bottom-nav']);
  await capture(page, info, '01-coach-plan');
  await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, info, '02-coach-plan-scrolled');
  await page.getByRole('button', { name: /Exercise library/ }).click();
  await expect(page.getByText('6 results', { exact: true })).toBeVisible();
  await expectBackBeforeTitle(page);
  await capture(page, info, '03-exercise-library');
  await page.getByRole('button', { name: /Dumbbell bench press Chest/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expect(page.getByText('Manual tracking', { exact: true })).toBeVisible();
  await expectReferenceLayout(page, ['.coach-scroll', '.library-header', '.library-dialog', '.library-exercise-sheet', '.sheet-close']);
  await capture(page, info, '04-exercise-details');
  await page.getByRole('button', { name: 'Play exercise demonstration', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause exercise demonstration', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('bench');
  await expect(page.getByText('1 results', { exact: true })).toBeVisible();
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectBackBeforeTitle(page);
  }
  await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
});

test('dark camera, upload, live session and confirmed report preserve the workout lifecycle', async ({ page }, info) => {
  const state = await fixture(page);
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Camera check', exact: true })).toBeVisible();
  await expectBackBeforeTitle(page);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('4 of 4 ready', { exact: true })).toBeVisible();
  await capture(page, info, '05-camera-check');
  await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  await expect(page.getByText('Upload a recorded set', { exact: true })).toBeVisible();
  await expectBackBeforeTitle(page);
  await expectReferenceLayout(page, ['.coach-scroll', '.coach-header', '.camera-tabs', '.upload-dropzone', '.coach-footer']);
  await page.locator('.choose-video input[type="file"]').focus();
  await expect(page.locator('.choose-video input[type="file"]')).toBeFocused();
  await capture(page, info, '06-upload-video');
  await page.getByRole('button', { name: 'Live feed', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause workout', exact: true })).toBeVisible();
  const enableLive = page.getByRole('button', { name: 'Enable camera', exact: true });
  if (await enableLive.isVisible()) await enableLive.click();
  await expect(page.locator('.live-camera')).toHaveJSProperty('readyState', 4);
  await capture(page, info, '07-live-session');
  await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  await expect.poll(() => state.paused).toBe(true);
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect.poll(() => state.paused).toBe(false);
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  expect(state.ended).toBe(true);
  await expect(page.getByText('42:16', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Per exercise', exact: true })).toBeVisible();
  await expect(page.locator('.coach-footer')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  await expectBackBeforeTitle(page);
  await expectReferenceLayout(page, ['.coach-scroll', '.report-header', '.report-summary', '.report-section', '.coach-footer']);
  await capture(page, info, '08-workout-report');
  await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, info, '09-workout-report-scrolled');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole('button', { name: 'Back to home', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = 0; });
  await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
});

test('inactivity and alarm surfaces keep their dark safety colors', async ({ page }) => {
  await fixture(page);
  await page.goto('/coach');
  await expect(page.locator('.coach-dark-theme')).toBeVisible();
  const colors = await page.locator('.coach-dark-theme').evaluate(theme => {
    const session = document.createElement('div');
    session.className = 'coach-view-session';
    session.innerHTML = '<section class="inactivity-view inactivity-countdown"><div class="inactivity-ring"><svg><circle></circle><circle></circle></svg></div><div class="inactivity-notice"></div></section><section class="inactivity-view emergency-alarm"><button class="alarm-hold"></button><section class="alarm-log"></section></section>';
    theme.append(session);
    const countdown = session.querySelector('.inactivity-countdown');
    const circles = session.querySelectorAll('.inactivity-ring circle');
    const notice = session.querySelector('.inactivity-notice');
    const alarm = session.querySelector('.emergency-alarm');
    const stop = session.querySelector('.alarm-hold');
    const log = session.querySelector('.alarm-log');
    return {
      countdown: getComputedStyle(countdown).backgroundColor,
      ringTrack: getComputedStyle(circles[0]).stroke,
      ringProgress: getComputedStyle(circles[1]).stroke,
      notice: getComputedStyle(notice).backgroundColor,
      alarm: getComputedStyle(alarm).backgroundColor,
      stop: getComputedStyle(stop).backgroundColor,
      log: getComputedStyle(log).backgroundColor,
    };
  });
  expect(colors).toEqual({
    countdown: 'rgb(22, 29, 39)',
    ringTrack: 'rgb(39, 52, 68)',
    ringProgress: 'rgb(248, 113, 113)',
    notice: 'rgba(0, 0, 0, 0)',
    alarm: 'rgb(72, 9, 9)',
    stop: 'rgb(22, 29, 39)',
    log: 'rgb(22, 29, 39)',
  });
});
