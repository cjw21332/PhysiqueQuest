import { test, expect } from '@playwright/test';

async function openUpload(page, failCompletion = false, automatic = false) {
  const writes = [];
  let saved;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test' })));
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() === 'POST') writes.push({ path, data: request.postDataJSON() });
    if (path.endsWith('/recorded') && failCompletion) {
      failCompletion = false;
      return route.fulfill({ status: 503, json: { message: 'Temporary save failure' }, headers });
    }
    const exercise = { exerciseId: 'catalog-squat', name: 'Squat', equipment: 'Bodyweight', prescription: '3 × 10', tracking: 'Manual' };
    if (path.endsWith('/recorded') && request.method() === 'POST') {
      const payload = request.postDataJSON();
      saved = { _id: 'recorded-session', origin: 'recorded-set', status: 'completed', exerciseIds: [payload.exercise.exerciseId], exercises: [payload.exercise], sets: [payload.result], startedAt: payload.performedAt, endedAt: payload.performedAt, durationSeconds: Math.floor(payload.result.clipDurationSeconds) };
    }
    const json = path.endsWith('/profile') ? { name: 'Test', equipment: ['Bodyweight'] }
      : path.endsWith('/coach/plan') ? { libraryReady: true, duration: '20 min', days: Array.from({ length: 7 }, (_, index) => ({ index, label: String(index + 1), name: 'Day ' + index, isWorkoutDay: true, title: 'Workout', exercises: [exercise] })) }
      : path.endsWith('/pose/status') ? { available: false }
      : path.endsWith('/active') ? null
      : path.endsWith('/workouts') ? saved ? [saved] : []
      : path.endsWith('/recorded') || path.endsWith('/recorded-session') ? saved
      : path.endsWith('/complete') ? { _id: 'recorded-session', status: 'completed', exerciseIds: ['camera-squat'], startedAt: new Date().toISOString(), durationSeconds: 2, exerciseResults: request.postDataJSON().exerciseResults }
      : {};
    return route.fulfill({ json, headers });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  if (!automatic) await page.getByRole('checkbox', { name: 'Scan automatically when video opens' }).uncheck();
  // Produce a real, short MP4 locally, without remote test media.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
    const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
    const done = new Promise(resolve => { recorder.onstop = resolve; });
    const draw = setInterval(() => { context.fillStyle = '#222'; context.fillRect(0, 0, 160, 120); }, 100);
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 2200)); recorder.stop(); await done;
    clearInterval(draw); stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'recorded-set.mp4', mimeType: 'video/mp4', buffer: Buffer.from(bytes) });
  if (!automatic) await expect(page.getByRole('button', { name: 'Count reps locally', exact: true })).toBeEnabled();
  return writes;
}

for (const exerciseId of ['camera-squat', 'camera-pushup']) test(`counts ${exerciseId} locally, reviews corrected reps, and saves only results`, async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class extends EventTarget {
      postMessage(command) {
        const time = command.timestamp ?? 0;
        const angle = time < 600 || time >= 1300 ? 180 : 90;
        const radians = angle * Math.PI / 180;
        const frame = { timestamp: time, aspect: 1, joints: [{ x: 0.5, y: 0.3, visibility: 1 }, { x: 0.5, y: 0.5, visibility: 1 }, { x: 0.5 + 0.2 * Math.sin(radians), y: 0.5 - 0.2 * Math.cos(radians), visibility: 1 }] };
        if (command.kind === 'pushup') frame.joints.push({ x: 0.65, y: 0.3, visibility: 1 }, { x: 0.9, y: 0.3, visibility: 1 });
        command.bitmap?.close();
        setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: command.type === 'init' ? { type: 'ready' } : { type: 'frame', frame } })), 0);
      }
      terminate() {}
    };
  });
  const writes = await openUpload(page);
  await expect(page.getByRole('combobox', { name: 'Exercise', exact: true }).locator('option')).toHaveCount(8);
  for (const name of ['Goblet squat', 'Sumo squat', 'Hammer curl', 'Seated biceps curl', 'Push-up']) {
    await expect(page.getByRole('option', { name, exact: true })).toHaveCount(1);
  }
  await page.getByRole('combobox', { name: 'Exercise', exact: true }).selectOption(exerciseId);
  if (exerciseId === 'camera-pushup') await expect(page.getByText(/Place the camera level, low and side-on/)).toBeVisible();
  await page.getByRole('button', { name: 'Count reps locally', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Count again', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Reviewed reps' })).toHaveValue('1');
  expect(writes).toHaveLength(0);
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('8');
  await page.screenshot({ path: 'artifacts/recorded-reps-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Save reviewed workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  expect(writes.map(write => write.path.split('/').at(-1))).toEqual(['recorded']);
  expect(writes[0].data.exercise.exerciseId).toBe(exerciseId);
  expect(writes[0].data.result).toMatchObject({ exerciseId, reps: 8, detectedReps: 1, source: 'local-video' });
  expect(writes[0].data).not.toHaveProperty('mediaBase64');
  expect(writes[0].data.result.clipDurationSeconds).toBeGreaterThanOrEqual(2);
});

test('real local model handles an untrackable clip and retains manual logging', async ({ page }) => {
  const writes = await openUpload(page);
  await page.getByRole('button', { name: 'Count reps locally', exact: true }).click();
  await expect(page.locator('.recorded-counter [role=alert]')).toContainText('required joints were not visible', { timeout: 45_000 });
  expect(writes).toHaveLength(0);
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('5');
  await page.getByRole('button', { name: 'Save reviewed workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
});

test('cancels model loading without saving and keeps narrow-screen manual controls usable', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class extends EventTarget { postMessage() {} terminate() { window.workerTerminated = true; } };
  });
  const writes = await openUpload(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole('button', { name: 'Count reps locally', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel counting' }).click();
  await expect(page.locator('.recorded-counter [role=alert]')).toContainText('Counting stopped');
  await expect.poll(() => page.evaluate(() => window.workerTerminated)).toBe(true);
  await expect(page.getByRole('spinbutton', { name: 'Reviewed reps' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(writes).toHaveLength(0);
});

test('retries completion with the same workout and reviewed data', async ({ page }) => {
  const writes = await openUpload(page, true);
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('7');
  await page.getByRole('button', { name: 'Save reviewed workout' }).click();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  await expect(page.getByRole('spinbutton', { name: 'Reviewed reps' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  expect(writes.map(write => write.path.split('/').at(-1))).toEqual(['recorded', 'recorded']);
  expect(writes[1]).toEqual(writes[0]);
});

test('an undecodable clip still supports manual duration and reps without starting analysis', async ({ page }) => {
  const writes = await openUpload(page);
  await page.getByRole('button', { name: 'Choose a different video' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'unsupported.mp4', mimeType: 'video/mp4', buffer: Buffer.from('undecodable fixture') });
  await expect(page.getByRole('spinbutton', { name: 'Manual clip length' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Manual clip length' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('6');
  await expect(page.getByRole('button', { name: 'Count reps locally' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save reviewed workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].data.result).toMatchObject({ source: 'manual', reps: 6, clipDurationSeconds: 20 });
});

for (const kind of ['squat', 'curl', 'pushup']) test(`automatically identifies ${kind}, counts once per frame and names the reviewed entry`, async ({ page }) => {
  await page.addInitScript(({ kind }) => {
    window.inferenceCalls = 0;
    window.Worker = class extends EventTarget {
      postMessage(command) {
        const timestamp = command.timestamp ?? 0;
        const angle = timestamp < 600 || timestamp >= 1300 ? 180 : kind === 'curl' ? 45 : 90;
        const radians = angle * Math.PI / 180;
        const point = (x, y) => ({ x, y, visibility: 1, presence: 1 });
        const joints = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
        if (kind === 'pushup') {
          joints[12] = point(.2, .35); joints[14] = point(.2, .55);
          joints[16] = point(.2 + .2 * Math.sin(radians), .55 - .2 * Math.cos(radians));
          joints[24] = point(.5, .35); joints[26] = point(.67, .35); joints[28] = point(.85, .35);
        } else if (kind === 'squat') {
          joints[12] = point(.3, .15); joints[14] = point(.3, .3); joints[16] = point(.3, .45);
          joints[24] = point(.3, .45); joints[26] = point(.3, .65);
          joints[28] = point(.3 + .2 * Math.sin(radians), .65 - .2 * Math.cos(radians));
        } else {
          joints[12] = point(.3, .18); joints[14] = point(.3, .36);
          joints[16] = point(.3 + .18 * Math.sin(radians), .36 - .18 * Math.cos(radians));
          joints[24] = point(.3, .55); joints[26] = point(.3, .72); joints[28] = point(.3, .92);
        }
        if (command.type === 'frame') window.inferenceCalls++;
        command.bitmap?.close();
        setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: command.type === 'init' ? { type: 'ready' } : { type: 'frame', frame: { joints, timestamp, aspect: 1 } } })), 0);
      }
      terminate() { window.workerTerminated = true; }
    };
  }, { kind });
  const writes = await openUpload(page, false, true);
  const name = { squat: 'Squat', curl: 'Biceps curl', pushup: 'Push-up' }[kind];
  await expect(page.getByText(`Suggested movement: ${name}. Review the exercise and reps before saving.`)).toBeVisible();
  await expect(page.getByRole('heading', { name: `${name} · 1 rep`, exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Reviewed reps' })).toHaveValue('1');
  expect(writes).toHaveLength(0);
  const sampledFrames = Math.ceil(await page.locator('.recorded-counter video').evaluate(video => video.duration) * 10);
  expect(await page.evaluate(() => window.inferenceCalls)).toBe(sampledFrames);
  expect(await page.evaluate(() => window.workerTerminated)).toBe(true);
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('8');
  if (kind === 'pushup') await page.screenshot({ path: 'artifacts/auto-video-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Save reviewed workout' }).click();
  await expect(page.getByRole('heading', { name: `${name} · 8 reps`, exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].data.exercise.name).toBe(name);
  expect(writes[0].data.exercise.exerciseId).toBe(`movement-${kind}`);
  expect(writes[0].data.result.exerciseId).toBe(`movement-${kind}`);
  expect(writes[0].data.result.trackingPresetId).toBe(kind === 'pushup' ? 'camera-pushup' : `camera-${kind}`);
  expect(writes[0].data.exercise.equipment).toBe(kind === 'pushup' ? 'Bodyweight' : '');
  expect(writes[0].data.result).toMatchObject({ reps: 8, detectedReps: 1, side: 'right', source: 'local-video', algorithmVersion: 'movement-rules-v1/rep-counter-v2' });
  expect(writes[0].data).not.toHaveProperty('mediaBase64');
  await page.goto('/coach');
  await expect(page.getByRole('link', { name: new RegExp(`${name} · 8 reps`) })).toBeVisible();
});

test('automatic scanning leaves unknown clips unnamed and permits manual correction', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class extends EventTarget {
      postMessage(command) {
        command.bitmap?.close();
        setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: command.type === 'init' ? { type: 'ready' } : { type: 'frame', frame: { joints: [], timestamp: command.timestamp, aspect: 1 } } })), 0);
      }
      terminate() {}
    };
  });
  const writes = await openUpload(page, false, true);
  await expect(page.locator('.recorded-counter [role=alert]')).toContainText('Could not identify one supported exercise');
  await expect(page.getByRole('button', { name: 'Save reviewed workout' })).toBeDisabled();
  await expect(page.locator('.recorded-entry-title')).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await page.getByRole('combobox', { name: 'Exercise', exact: true }).selectOption('camera-pushup');
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('3');
  await page.getByRole('button', { name: 'Save reviewed workout' }).click();
  await expect(page.getByRole('heading', { name: 'Push-up · 3 reps', exact: true })).toBeVisible();
  expect(writes[0].data.result.source).toBe('manual');
});

test('automatic model loading can be cancelled without saving or assigning a name', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class extends EventTarget { postMessage() {} terminate() { window.workerTerminated = true; } };
  });
  const writes = await openUpload(page, false, true);
  await page.getByRole('button', { name: 'Cancel counting' }).click();
  await expect(page.locator('.recorded-counter [role=alert]')).toContainText('Counting stopped');
  await expect(page.getByRole('button', { name: 'Save reviewed workout' })).toBeDisabled();
  expect(await page.evaluate(() => window.workerTerminated)).toBe(true);
  expect(writes).toHaveLength(0);
});

test('the real local model can scan an unknown video automatically without naming or saving it', async ({ page }) => {
  const writes = await openUpload(page, false, true);
  await expect(page.locator('.recorded-counter [role=alert]')).toContainText('Could not identify one supported exercise', { timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Save reviewed workout' })).toBeDisabled();
  await expect(page.locator('.recorded-entry-title')).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
