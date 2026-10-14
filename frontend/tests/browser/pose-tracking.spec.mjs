import { test, expect } from '@playwright/test';

test('real worker loads the local model, analyzes frames, pauses, and saves corrected reps', async ({ page }) => {
  page.on('pageerror', error => console.error('Browser error:', error.message));
  const exercise = { _id: 'camera-squat', name: 'Bodyweight squat', equipment: 'Bodyweight' };
  const workout = { _id: 'session-test', exerciseIds: [exercise._id], status: 'active', startedAt: new Date().toISOString() };
  let saved;
  let created = 0;
  let catalogRequests = 0;
  const posted = [];
  await page.addInitScript(() => { localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test-token' })); });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let result = {};
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (request.method() !== 'GET') posted.push(request.postDataJSON());
    if (path.endsWith('/profile')) result = { name: 'Test', equipment: [] };
    if (path.endsWith('/coach/plan')) result = { days: [], weekLabel: 'Test week', sessionCount: 0 };
    if (path.includes('/exercises')) catalogRequests++;
    if (path.endsWith('/workouts') && request.method() === 'POST') { result = workout; created++; }
    if (path.endsWith('/pause')) result = workout;
    if (path.endsWith('/complete')) { saved = request.postDataJSON(); result = { ...workout, ...saved, status: 'completed' }; }
    await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: exercise.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: exercise.name })).toBeVisible();
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByText('Camera tracking · prototype', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('0 reps', { exact: true })).toBeVisible();
  expect(created).toBe(1);
  expect(catalogRequests).toBe(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Tracking paused.', { exact: true })).toBeVisible();
  expect(await page.locator('video').evaluate(video => video.srcObject === null)).toBeTruthy();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByText('Camera tracking · prototype', { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Finish and review' }).click();
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Final rep count' }).fill('8');
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  expect(saved.exerciseResults).toEqual([{ exerciseId: 'camera-squat', reps: 8 }]);
  expect(posted.every(data => !JSON.stringify(data).includes('mediaBase64'))).toBeTruthy();
});

test('phone bridge feeds the shared counter and ignores frames from an old camera request', async ({ page }) => {
  const exercise = { _id: 'camera-curl', name: 'Standing biceps curl', equipment: 'Dumbbell' };
  await page.addInitScript(() => {
    localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test-token' }));
    window.ReactNativeWebView = { postMessage(value) {
      const message = JSON.parse(value);
      if (message.type === 'camera-start') {
        window.trackingOptions = message.previewContext.tracking;
        setTimeout(() => window.dispatchEvent(new CustomEvent('physiquequest-camera', { detail: { type: 'status', status: 'on' } })), 10);
      }
    } };
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const result = path.endsWith('/profile') ? { name: 'Test' } : path.endsWith('/coach/plan') ? { days: [] } : path.endsWith('/workouts') ? { _id: 'native-test', exerciseIds: [exercise._id], startedAt: new Date().toISOString() } : {};
    return route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  });
  await page.goto('/coach?track=camera-curl');
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByRole('button', { name: 'Enable camera' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!window.trackingOptions)).toBeTruthy();
  await page.evaluate(async () => {
    const { requestId, side } = window.trackingOptions;
    // Allow the listener mounted after camera-on to register before replay.
    await new Promise(resolve => setTimeout(resolve, 50));
    let timestamp = 0;
    const replay = id => {
      for (const angle of [180, 45, 180]) for (let i = 0; i < 6; i++) {
        const radians = angle * Math.PI / 180;
        const joints = [{ x: .5, y: .3, visibility: 1 }, { x: .5, y: .5, visibility: 1 }, { x: .5 + .2 * Math.sin(radians), y: .5 - .2 * Math.cos(radians), visibility: 1 }];
        window.dispatchEvent(new CustomEvent('physiquequest-pose', { detail: { type: 'frame', requestId: id, side, frame: { joints, aspect: 1, timestamp } } }));
        timestamp += 100;
      }
    };
    replay('old-request'); replay(requestId);
  });
  await expect(page.getByText('1 reps', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('1 reps', { exact: true })).toBeVisible();
  await expect(page.getByText('Tracking paused.', { exact: true })).toBeVisible();
});
