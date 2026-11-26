import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function signedIn(page, path) {
  await page.addInitScript(() => {
    localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'back-user', token: 'back-token' }));
    sessionStorage.setItem('pq-whats-new-shown', '1');
  });
  await page.route('**/ready', route => route.fulfill({ json: { status: 'ready' }, headers }));
  await page.route('**/api/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url()).pathname;
    if (url.includes('/auth/session')) return route.fulfill({ headers, json: { user: { id: 'back-user', name: 'Toji', email: 'toji@example.test', emailVerified: true }, access_token: 'back-token', expires_in: 3600 } });
    if (url.endsWith('/profile')) return route.fulfill({ headers, json: { name: 'Toji', goal: 'Build muscle', equipment: ['Dumbbells'], days: ['Monday'], duration: '45 min' } });
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(path);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.waitForLoadState('networkidle');
}
// Stand in for the Android shell after sign-in (as connection-toast does): record what the page answers to Back.
const pressBack = page => page.evaluate(() => {
  window.__backReplies ??= [];
  window.ReactNativeWebView ??= { postMessage: raw => { const m = JSON.parse(raw); if (m.type === 'hardware-back-result') window.__backReplies.push(m.exit); } };
  window.dispatchEvent(new CustomEvent('physiquequest:hardware-back'));
});
const replies = page => page.evaluate(() => window.__backReplies);

test('Back on Home asks the shell to confirm exit instead of navigating', async ({ page }) => {
  await signedIn(page, '/home');
  await pressBack(page);
  await expect.poll(() => replies(page)).toEqual([true]);
  await expect(page).toHaveURL(/\/home$/);
});

test('Back on another main tab returns Home and keeps the app open', async ({ page }) => {
  await signedIn(page, '/quests');
  await pressBack(page);
  await expect(page).toHaveURL(/\/home$/);
  expect(await replies(page)).toEqual([false]);
});

test('Back closes the top popup before leaving the screen', async ({ page }) => {
  await signedIn(page, '/scan');
  await page.evaluate(() => {
    const d = document.createElement('dialog');
    d.id = 'probe';
    d.textContent = 'Probe';
    document.body.append(d);
    d.showModal();
  });
  await pressBack(page);
  await expect(page.locator('#probe')).not.toHaveAttribute('open', '');
  await expect(page).toHaveURL(/\/scan$/);
  expect(await replies(page)).toEqual([false]);
});
