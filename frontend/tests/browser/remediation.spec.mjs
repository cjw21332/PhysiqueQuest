import { test, expect } from '@playwright/test';

test('verified-admin analytics uses API ranges and ignores a late response from an older range', async ({ page }) => {
  let releaseSeven;
  const sevenGate = new Promise(resolve => { releaseSeven = resolve; });
  let sevenRequested = false;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test-token' })));
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/admin/analytics')) {
      const days = Number(url.searchParams.get('days'));
      if (days === 7) { sevenRequested = true; await sevenGate; }
      return route.fulfill({ headers, json: { rangeDays: days, generatedAt: '', usersTotal: 100, activeUsers: days + 1, completedSessions: days + 2, formScore: null, missionCompletion: null, weeklyRetention: null, emergencyEvents: { total: 0, delivered: 0, failed: 0, pending: 0 } } });
    }
    return route.fulfill({ headers, json: url.pathname.endsWith('/auth/me') ? { role: 'admin' } : url.pathname.endsWith('/profile') ? { name: 'Admin', equipment: [] } : {} });
  });
  await page.goto('/me');
  await page.getByRole('button', { name: /Engagement analytics/ }).click();
  await expect(page.locator('.engagement-active-users strong')).toHaveText('31');
  await expect(page.getByText('sample data', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '7 days', exact: true }).click();
  await expect.poll(() => sevenRequested).toBe(true);
  await page.getByRole('button', { name: '90 days', exact: true }).click();
  await expect(page.locator('.engagement-active-users strong')).toHaveText('91');
  const response = page.waitForResponse(res => res.url().includes('/admin/analytics?days=7'));
  releaseSeven(); await response;
  await expect(page.getByRole('button', { name: '90 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.engagement-active-users strong')).toHaveText('91');
});

test('password recovery carries a request-bound code into a separate reset grant', async ({ page }) => {
  const bodies = {};
  const requestId = 'a'.repeat(64), resetToken = 'b'.repeat(64);
  await page.route('**/api/auth/password-reset/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const step = new URL(route.request().url()).pathname.split('/').at(-1);
    bodies[step] = route.request().postDataJSON();
    return route.fulfill({ json: step === 'request' ? { accepted: true, requestId, delivery: 'queued' } : step === 'verify' ? { verified: true, resetToken } : { updated: true }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/login');
  await page.getByText('Forgot Password?', { exact: true }).click();
  await page.locator('.forgot-password-modal').getByRole('textbox', { name: 'Email address' }).fill('test@example.com');
  await page.getByRole('button', { name: 'Send OTP Verification' }).click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create new password' })).toBeVisible();
  await page.getByLabel('New Password', { exact: true }).fill('NewPass123!');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('NewPass123!');
  await page.getByRole('button', { name: 'Update New Password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  expect(bodies.verify).toEqual({ requestId, code: '123456' });
  expect(bodies.confirm).toEqual({ resetToken, password: 'NewPass123!' });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(resetToken);
});

test('Me password change locks the email to the server account and uses authenticated change endpoints', async ({ page }) => {
  const bodies = {}, requestId = 'c'.repeat(64), resetToken = 'd'.repeat(64);
  let publicRecoveryRequests = 0;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'owner', token: 'owner-token' })));
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.includes('/password-reset/')) { publicRecoveryRequests++; return route.fulfill({ status: 400, headers, json: {} }); }
    if (path.includes('/password-change/')) {
      expect(req.headers().authorization).toBe('Bearer owner-token');
      const step = path.split('/').at(-1); bodies[step] = req.postDataJSON();
      return route.fulfill({ headers, json: step === 'request' ? { accepted: true, requestId, delivery: 'queued', email: 'owner@example.com' } : step === 'verify' ? { verified: true, resetToken } : { updated: true } });
    }
    return route.fulfill({ headers, json: path.endsWith('/auth/me') ? { id: 'owner', email: 'owner@example.com', role: 'user' } : path.endsWith('/profile') ? { name: 'Owner', email: 'stale@example.com', equipment: [] } : {} });
  });
  await page.goto('/me');
  await page.getByRole('button', { name: /Change password/ }).click();
  const email = page.locator('.forgot-password-modal').getByRole('textbox', { name: 'Email address' });
  await expect(email).toHaveValue('owner@example.com'); await expect(email).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Send OTP Verification' }).click();
  await expect(page.locator('.forgot-password-modal-otp')).toContainText('owner@example.com');
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByLabel('New Password', { exact: true }).fill('NewPass123!');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('NewPass123!');
  await page.getByRole('button', { name: 'Update New Password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  expect(bodies.request).toEqual({}); expect(bodies.verify).toEqual({ requestId, code: '123456' });
  expect(bodies.confirm).toEqual({ resetToken, password: 'NewPass123!' }); expect(publicRecoveryRequests).toBe(0);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(resetToken);
  await page.getByRole('button', { name: 'Return to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('physiquequest-auth'))).toBeNull();
});

test('admin edit, unpublish and confirmed deletion persist through API refreshes', async ({ page }) => {
  let records = [{ _id: 'exercise-1', name: 'Staging push-up', group: 'Chest · Bodyweight', targetMuscle: 'Chest', equipment: 'Bodyweight', status: 'published', pose: 'missing' }];
  let patches = 0, deletes = 0;
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'test', token: 'test-token' })));
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.includes('/admin/exercises')) {
      if (req.method() === 'PATCH') { patches++; records = [{ ...records[0], ...req.postDataJSON() }]; }
      if (req.method() === 'DELETE') { deletes++; records = []; }
      return route.fulfill({ json: req.method() === 'GET' ? records : records[0] ?? { deleted: true }, headers });
    }
    const json = path.endsWith('/auth/me') ? { id: 'test', role: 'admin' } : path.endsWith('/profile') ? { name: 'Admin', equipment: [] } : path.endsWith('/workouts') ? [] : {};
    return route.fulfill({ json, headers });
  });
  await page.goto('/me');
  await page.getByRole('button', { name: /Manage exercises/ }).click();
  await page.getByRole('button', { name: 'Edit Staging push-up', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Reviewed push-up');
  await page.getByRole('switch', { name: 'Published' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Reviewed push-up', { exact: true })).toBeVisible();
  expect(patches).toBe(1); expect(records[0].status).toBe('draft');
  await page.reload();
  await page.getByRole('button', { name: /Manage exercises/ }).click();
  await page.getByRole('button', { name: 'Delete Reviewed push-up', exact: true }).click();
  expect(deletes).toBe(0);
  await page.getByRole('button', { name: 'Keep exercise' }).click();
  await page.getByRole('button', { name: 'Delete Reviewed push-up', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByText('No exercises match this search.')).toBeVisible();
  expect(deletes).toBe(1);
});
