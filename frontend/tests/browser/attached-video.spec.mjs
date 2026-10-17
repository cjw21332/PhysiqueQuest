import { test, expect } from '@playwright/test';
test('a reviewed video attaches to the selected catalog set and never creates a separate workout', async ({ page }) => {
  let workout = { _id: 'attached-workout', status: 'active', revision: 0, startedAt: new Date().toISOString(), exerciseIds: ['catalog-press'], exercises: [{ exerciseId: 'catalog-press', name: 'My push-up', equipment: 'Bodyweight', sets: 1, prescription: '1 × 10' }], sets: [], pausedSeconds: 0 };
  const writes = [];
  await page.addInitScript(() => {
    localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'attached-test', token: 'test' }));
    window.Worker = class extends EventTarget {
      postMessage(command) {
        const timestamp = command.timestamp ?? 0, angle = timestamp < 600 || timestamp >= 1300 ? 180 : 90, radians = angle * Math.PI / 180;
        const frame = { timestamp, aspect: 1, joints: [{ x: .5, y: .3, visibility: 1 }, { x: .5, y: .5, visibility: 1 }, { x: .5 + .2 * Math.sin(radians), y: .5 - .2 * Math.cos(radians), visibility: 1 }, { x: .65, y: .3, visibility: 1 }, { x: .9, y: .3, visibility: 1 }] };
        command.bitmap?.close(); setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: command.type === 'init' ? { type: 'ready' } : { type: 'frame', frame } })), 0);
      }
      terminate() {}
    };
  });
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (['POST', 'PATCH'].includes(request.method())) writes.push({ path, body: request.postDataJSON() });
    if (path.endsWith('/sets')) { workout = { ...workout, sets: [request.postDataJSON().result], revision: workout.revision + 1 }; }
    const json = path.endsWith('/attached-workout') || path.endsWith('/sets') ? workout : path.endsWith('/profile') ? { name: 'Test' } : path.endsWith('/settings') ? { values: { inactivity: false } } : path.endsWith('/auth/me') ? { role: 'user' } : {};
    return route.fulfill({ json, headers });
  });
  await page.goto('/workouts/attached-workout');
  await page.getByRole('button', { name: 'Start set', exact: true }).click();
  await page.getByText('Use a recorded video for this set', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Counting rule', exact: true }).selectOption('camera-pushup');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
    const context = canvas.getContext('2d'), stream = canvas.captureStream(10), chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' }); recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    const draw = setInterval(() => { context.fillRect(0, 0, 160, 120); }, 100);
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 2200)); recorder.stop(); await stopped; clearInterval(draw); stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.getByLabel('Set video', { exact: true }).setInputFiles({ name: 'set.mp4', mimeType: 'video/mp4', buffer: Buffer.from(bytes) });
  await page.getByRole('button', { name: 'Count reps locally' }).click();
  await expect(page.getByRole('button', { name: 'Count again' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Reviewed reps' }).fill('12');
  await page.getByRole('button', { name: 'Save reviewed set' }).click();
  await expect(page.getByText('1 of 1 sets reviewed.', { exact: false })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ path: '/api/workouts/attached-workout/sets', body: { result: { setId: 'catalog-press:0', exerciseId: 'catalog-press', reps: 12, detectedReps: 1, trackingPresetId: 'camera-pushup', source: 'local-video' } } });
  expect(workout.status).toBe('active');
});
