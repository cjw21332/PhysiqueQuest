import { test, expect } from '@playwright/test';

// iPhone-sized touch device; the toast must stay usable and dismissible there.
test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

async function signedIn(page, { ready = true } = {}) {
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'toast-user', token: 'toast-token' })));
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route('**/ready', route => ready ? route.fulfill({ json: { status: 'ready' }, headers }) : route.fulfill({ status: 503, json: { status: 'waking' }, headers }));
  await page.route('**/api/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/auth/session')) return route.fulfill({ headers, json: { user: { id: 'toast-user', name: 'Toji', email: 'toji@example.test', emailVerified: true }, access_token: 'toast-token', expires_in: 3600 } });
    if (path.endsWith('/profile')) return route.fulfill({ headers, json: { name: 'Toji', goal: 'Build muscle', equipment: ['Dumbbells'], days: ['Monday'], duration: '45 min' } });
    return route.fulfill({ headers, json: {} });
  });
  await page.goto('/home');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  // Let the startup service check finish so a mocked success can't clear a later simulated outage.
  await page.waitForLoadState('networkidle');
}

// The native shell restores sessions itself, so sign in as the web app first, then mark the page as the
// app's WebView and report the hosted service as still waking up.
const nativeConnecting = page => page.evaluate(() => {
  window.ReactNativeWebView = { postMessage() {} };
  // Toggle the state so the boundary re-renders and reads the native flag.
  window.dispatchEvent(new CustomEvent('physiquequest:backend-status', { detail: 'online' }));
  window.dispatchEvent(new CustomEvent('physiquequest:backend-status', { detail: 'offline' }));
});
const goOffline = page => page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });

test('offline toast offers retry, closes with its 44px button and leaves the page usable', async ({ page }, info) => {
  await signedIn(page);
  await goOffline(page);
  const toast = page.locator('.pq-toast-offline');
  await expect(toast).toContainText('You’re offline');
  await expect(toast.getByRole('button', { name: 'Try again' })).toBeVisible();
  const close = toast.getByRole('button', { name: 'Continue offline' });
  const box = await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('offline-375.png'), animations: 'disabled' });
  await close.click();
  await expect(toast).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});

test('native connecting toast swipes away and stays dismissed until it recurs', async ({ page }, info) => {
  await signedIn(page, { ready: false });
  await nativeConnecting(page);
  const toast = page.locator('.pq-toast-connecting');
  await expect(toast).toContainText('Connecting to PhysiqueQuest');
  await page.screenshot({ path: info.outputPath('connecting-375.png'), animations: 'disabled' });
  const box = await toast.boundingBox();
  const y = box.y + box.height / 2, x = box.x + 40;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 4 });
  await page.mouse.move(x - 140, y, { steps: 4 });
  await page.mouse.up();
  await expect(toast).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(400);
  await expect(toast).toHaveCount(0);
});

test('a short drag snaps back instead of dismissing', async ({ page }) => {
  await signedIn(page, { ready: false });
  await nativeConnecting(page);
  const toast = page.locator('.pq-toast-connecting');
  await expect(toast).toBeVisible();
  const box = await toast.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 20, { steps: 3 });
  await page.mouse.up();
  await expect(toast).toBeVisible();
});

test('back online toast replaces the offline toast and hides itself', async ({ page }, info) => {
  await signedIn(page);
  await goOffline(page);
  await expect(page.locator('.pq-toast-offline')).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
  const online = page.locator('.pq-toast-online');
  await expect(online).toContainText('You’re back online');
  await expect(page.locator('.pq-toast-offline')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('online-375.png'), animations: 'disabled' });
  await expect(online).toHaveCount(0, { timeout: 8000 });
});
