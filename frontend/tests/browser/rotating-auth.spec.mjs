import { test, expect } from '@playwright/test';

test('page transitions preserve the document and do not restore the session again', async ({ page }) => {
  await page.goto('/launch');
  await expect(page.getByRole('link', { name: 'I already have an account' })).toBeVisible();
  await page.evaluate(() => { window.__navigationMarker = 'same-document'; });
  const refreshes = [];
  page.on('request', request => { if (request.url().endsWith('/auth/session/refresh')) refreshes.push(request.url()); });
  await page.getByRole('link', { name: 'I already have an account' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect(await page.evaluate(() => window.__navigationMarker)).toBe('same-document');
  expect(refreshes).toEqual([]);
  await expect(page.getByText(/Opening PhysiqueQuest|Loading Physique Quest/i)).toHaveCount(0);
});

test('real proxy forwards httpOnly cookies, persists across reload, rotates and detects replay', async ({ page, context }) => {
  await page.goto('/launch');
  const email = `browser-${Date.now()}@example.invalid`;
  const created = await page.request.post('/api/auth/session/register', { data: { email, name: 'Browser Test', password: 'BrowserTest1!' } });
  expect(created.status()).toBe(201);
  const body = await created.json();
  expect(body.expires_in).toBe(900); expect(body.refresh_token).toBeUndefined();
  await page.request.post('/api/auth/session/migrate', { data: {}, headers: { Authorization: `Bearer ${body.access_token}` } }).then(response => expect(response.status()).toBe(403));
  const first = (await context.cookies()).find(cookie => cookie.name === 'pq_refresh');
  expect(first.httpOnly).toBe(true); expect(first.sameSite).toBe('Lax'); expect(first.secure).toBe(false);
  expect(await page.evaluate(() => document.cookie)).not.toContain('pq_refresh');
  const restored = page.waitForResponse(response => response.url().endsWith('/auth/session/refresh') && response.status() === 200);
  await page.reload(); await restored;
  const second = (await context.cookies()).find(cookie => cookie.name === 'pq_refresh');
  expect(second.value).not.toBe(first.value);
  expect(await page.evaluate(() => localStorage.getItem('physiquequest-auth'))).toBeNull();
  await page.request.post('/api/auth/session/refresh', { data: {}, headers: { Cookie: `pq_refresh=${first.value}` } }).then(response => expect(response.status()).toBe(401));
  await page.request.post('/api/auth/session/refresh', { data: {}, headers: { Cookie: `pq_refresh=${second.value}` } }).then(response => expect(response.status()).toBe(401));
});

test('cleans legacy storage and upgrades through the proxy without exposing refresh credentials', async ({ page }) => {
  const credentials = { name: 'Legacy Test', email: `legacy-${Date.now()}@example.invalid`, password: 'LegacyTest1!' };
  const old = await page.request.post('/api/auth/register', { data: credentials });
  expect(old.status()).toBe(201); const legacy = await old.json();
  await page.addInitScript(user => localStorage.setItem('physiquequest-auth', JSON.stringify(user)), { ...legacy.user, token: legacy.access_token });
  const migration = page.waitForResponse(response => response.url().endsWith('/auth/session/migrate'));
  await page.goto('/launch'); expect((await migration).status()).toBe(200);
  expect(await page.evaluate(() => localStorage.getItem('physiquequest-auth'))).toBeNull();
  const refreshed = await page.request.post('/api/auth/session/refresh', { data: {} });
  expect(refreshed.status()).toBe(200); expect((await refreshed.json()).refresh_token).toBeUndefined();
});

test('logout in another tab clears its visible session and preserves frontend security headers', async ({ page, context }) => {
  for (const path of ['/health', '/ready']) expect((await page.request.get(path)).status()).toBe(200);
  const created = await page.request.post('/api/auth/session/register', { data: { name: 'Cross tab', email: `tabs-${Date.now()}@example.invalid`, password: 'CrossTabTest1!' } });
  expect(created.status()).toBe(201); const identity = await created.json();
  const response = await page.goto('/launch');
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  const other = await context.newPage();
  await other.goto('/launch');
  await page.request.post('/api/auth/logout', { data: {}, headers: { Authorization: `Bearer ${identity.access_token}` } }).then(result => expect(result.status()).toBe(200));
  await other.evaluate(() => localStorage.setItem('physiquequest-logout', String(Date.now())));
  await page.waitForURL(url => url.pathname === '/');
  await other.close();
});
