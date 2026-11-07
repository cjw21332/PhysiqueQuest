import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run against a separately started production build and populated Coach server.
test('offline reopen uses the public shell and saved exercise catalog', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'pq-offline-pwa-'));
  let context = await chromium.launchPersistentContext(profile, { headless: true });
  const measurements = {};
  try {
    await context.addInitScript(() => {
      localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test-token' }));
    });
    await context.route('http://127.0.0.1:14310/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/coach-service/')) return route.continue();
      const json = url.pathname.includes('/auth/session/') ? { access_token: 'test-token', expires_in: 3600, user: { id: 'test', name: 'Test', email: 'test@example.test', emailVerified: true } } : url.pathname.endsWith('/profile') ? { name: 'Test', equipment: [] } : url.pathname.endsWith('/coach/plan') ? { days: [], weekLabel: 'Week' } : {};
      await route.fulfill({ json });
    });
    let page = context.pages()[0] || await context.newPage();
    let gifRequests = 0;
    page.on('request', request => { if (request.url().includes('static.exercisedb.dev/media/')) gifRequests++; });
    const started = Date.now();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:14310/coach');
    await page.getByRole('button', { name: /Exercise library/ }).click();
    await expect(page.locator('.library-item').first()).toBeVisible({ timeout: 30000 });
    measurements.firstExerciseMs = Date.now() - started;
    const serverStatus = await page.evaluate(async () => (await fetch('/api/coach-service/exercises/sync-status')).json());
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect.poll(() => page.evaluate(() => new Promise(resolve => { const request = indexedDB.open('physiquequest-exercise-catalog'); request.onsuccess = () => { const db = request.result; const count = db.transaction('exercises').objectStore('exercises').count(); count.onsuccess = () => { db.close(); resolve(count.result); }; }; request.onerror = () => resolve(0); })), { timeout: 90000 }).toBe(serverStatus.count);
    await expect.poll(() => page.evaluate(() => new Promise(resolve => { const request = indexedDB.open('physiquequest-exercise-catalog'); request.onsuccess = () => { const db = request.result; const read = db.transaction('metadata').objectStore('metadata').get('catalog'); read.onsuccess = () => { db.close(); resolve(read.result?.count ?? 0); }; }; request.onerror = () => resolve(0); })), { timeout: 15000 }).toBe(serverStatus.count);
    measurements.deviceSyncMs = Date.now() - started;
    expect(gifRequests).toBe(0);
    const cachedPaths = await page.evaluate(async () => { const keys = await caches.keys(); return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat(); });
    expect(cachedPaths.every(path => ['/offline-exercises.html', '/offline-exercises.js', '/offline-exercises.css', '/physiquequest-icon.png'].includes(path))).toBe(true);
    await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('upward facing dog');
    await page.getByRole('button', { name: /upward facing dog/i }).first().click();
    await expect(page.getByText('Demonstration available offline.')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Close exercise details' }).click();
    measurements.storage = await page.evaluate(() => navigator.storage.estimate());
    measurements.jsHeapBytes = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
    await context.close();
    context = await chromium.launchPersistentContext(profile, { headless: true });
    await context.route('http://127.0.0.1:14310/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/coach-service/')) return route.continue();
      const json = url.pathname.includes('/auth/session/') ? { access_token: 'test-token', expires_in: 3600, user: { id: 'test', name: 'Test', email: 'test@example.test', emailVerified: true } } : url.pathname.endsWith('/profile') ? { name: 'Test', equipment: [] } : {};
      await route.fulfill({ json });
    });
    await context.setOffline(true);
    page = context.pages()[0] || await context.newPage();
    await page.goto('http://127.0.0.1:14310/');
    await expect(page.getByRole('heading', { name: 'Exercise library' })).toBeVisible();
    await expect(page.locator('#count')).toHaveText(`${serverStatus.count} exercises`);
    const searchStart = Date.now();
    await page.getByLabel('Search exercises').fill('triceps');
    await expect.poll(() => page.locator('#count').textContent()).not.toBe(`${serverStatus.count} exercises`);
    await expect(page.locator('#items button').first()).toBeVisible();
    measurements.offlineSearchMs = Date.now() - searchStart;
    const filterStart = Date.now();
    await page.locator('#body').selectOption('upper arms');
    await page.locator('#target').selectOption('triceps');
    await page.locator('#secondary').selectOption('deltoids');
    await page.locator('#sort').selectOption('name-desc');
    await expect(page.locator('#items button').first()).toBeVisible();
    measurements.offlineFilterMs = Date.now() - filterStart;
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    measurements.scrollFrameP95Ms = await page.evaluate(() => new Promise(resolve => { const times = []; let last; const frame = now => { if (last !== undefined) times.push(now - last); last = now; scrollBy(0, 15); if (times.length < 60) requestAnimationFrame(frame); else { times.sort((a, b) => a - b); resolve(times[Math.floor(times.length * .95)]); } }; requestAnimationFrame(frame); }));
    await page.locator('#items button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Instructions' })).toBeVisible();
    await page.locator('#close').click();
    await page.locator('#clear').click();
    await page.getByLabel('Search exercises').fill('upward facing dog');
    await expect(page.locator('#items button').first()).toContainText(/upward facing dog/i);
    await page.locator('#items button').first().click();
    await expect.poll(() => page.locator('#media img').evaluate(image => image.complete && image.naturalWidth > 0), { timeout: 10000 }).toBe(true);
    const resumed = page.waitForRequest(request => request.url().includes('/api/coach-service/exercises/sync-status'), { timeout: 15000 });
    await context.setOffline(false);
    await expect(page).toHaveURL(/\/exercises$/, { timeout: 15000 });
    await resumed;
    await writeFile('../output/exercisedb-offline-performance.json', JSON.stringify(measurements, null, 2));
  } finally { await context.close(); }
});

test('representative provider demonstrations render in the browser', async ({ page }) => {
  for (const id of ['01qpYSe', '05Cf2v8', '1cTf2Ux']) {
    const response = await page.request.get(`http://127.0.0.1:14051/api/exercises/${id}`);
    expect(response.ok()).toBe(true);
    const record = await response.json();
    await page.setContent('<img alt="Provider demonstration">');
    await page.locator('img').evaluate((image, url) => { image.src = url; }, record.gifUrl);
    await expect.poll(() => page.locator('img').evaluate(image => image.complete && image.naturalWidth > 0), { timeout: 15000 }).toBe(true);
  }
});

test('viewed demonstrations are bounded and older media is evicted', async ({ page }) => {
  const audit = (await readFile('../output/exercisedb-media-audit.jsonl', 'utf8')).trim().split('\n').map(JSON.parse);
  const ids = audit.filter(row => row.status === 200 && row.contentType.startsWith('image/gif')).slice(0, 7).map(row => row.id);
  expect(ids).toHaveLength(7);
  await page.goto('http://127.0.0.1:14310/launch');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  for (const id of ids) {
    const result = await page.evaluate(url => new Promise(resolve => {
      const image = new Image();
      image.onload = () => { const channel = new MessageChannel(); channel.port1.onmessage = event => resolve(event.data.cached); navigator.serviceWorker.controller.postMessage({ type: 'MEDIA_VIEWED', url }, [channel.port2]); };
      image.onerror = () => resolve(false);
      image.src = url;
    }), `https://static.exercisedb.dev/media/${id}.gif`);
    expect(result).toBe(true);
  }
  const urls = await page.evaluate(async () => (await (await caches.open('physiquequest-viewed-exercise-media-v1')).keys()).map(request => request.url));
  expect(urls).toHaveLength(6);
  expect(urls.some(url => url.endsWith(`/${ids[0]}.gif`))).toBe(false);
  expect(urls.some(url => url.endsWith(`/${ids[6]}.gif`))).toBe(true);
});

test('media playback survives a full device cache', async ({ page }) => {
  await page.goto('http://127.0.0.1:14310/launch');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: 'http://127.0.0.1:14310', quotaSize: 1 });
  const result = await page.evaluate(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { const channel = new MessageChannel(); channel.port1.onmessage = event => resolve({ loaded: true, cached: event.data.cached }); navigator.serviceWorker.controller.postMessage({ type: 'MEDIA_VIEWED', url }, [channel.port2]); };
    img.onerror = () => resolve({ loaded: false, cached: false });
    img.src = url;
  }), 'https://static.exercisedb.dev/media/01qpYSe.gif');
  expect(result).toEqual({ loaded: true, cached: false });
});

test('persistent catalog serves all IDs and combined filters', async ({ request }) => {
  const base = 'http://127.0.0.1:14051/api/exercises';
  const status = await (await request.get(`${base}/sync-status`)).json();
  expect(status.status).toBe('complete');
  const ids = new Set();
  for (let page = 1; ; page++) {
    const response = await request.get(base, { params: { page, limit: 100 } });
    expect(response.ok()).toBe(true);
    const result = await response.json();
    for (const row of result.items) { expect(ids.has(row._id)).toBe(false); ids.add(row._id); }
    if (page >= result.pages) break;
  }
  expect(ids.size).toBe(status.count);
  const filtered = await (await request.get(base, { params: { search: 'triceps', bodyPart: 'upper arms', target: 'triceps', secondary: 'deltoids', equipment: 'dumbbell', sort: 'name-asc' } })).json();
  expect(filtered.total).toBeGreaterThan(0);
  expect(filtered.items.every(row => row.bodyParts.includes('upper arms') && row.targetMuscles.includes('triceps') && row.secondaryMuscles.includes('deltoids') && row.equipment === 'Dumbbells')).toBe(true);
  const names = filtered.items.map(row => row.name.toLowerCase());
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});
