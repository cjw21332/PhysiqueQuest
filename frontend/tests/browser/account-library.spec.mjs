import { test, expect } from '@playwright/test';

async function account(page, role) {
  const requests = [];
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'account-library', token: 'test' })));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(path);
    if (path.endsWith('/auth/me') && role === 'unavailable') return route.fulfill({ status: 503, json: { message: 'Unavailable' }, headers });
    const json = path.endsWith('/profile') ? { name: 'Test', equipment: [], days: [] }
      : path.endsWith('/auth/me') ? { id: 'account-library', role }
      : path.endsWith('/admin/exercises') ? []
      : path.endsWith('/exercises') ? { items: [], total: 0, page: 1, limit: 12, pages: 0 }
      : path.endsWith('/settings') ? { values: {} } : {};
    return route.fulfill({ json, headers });
  });
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
  await expect.poll(() => requests.some(path => path.endsWith('/auth/me'))).toBe(true);
  return requests;
}

for (const role of ['user', 'unavailable']) {
  test(`account library stays public when admin role is ${role}`, async ({ page }) => {
    const requests = await account(page, role);
    await expect(page.getByRole('heading', { name: 'Admin tools' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Manage exercises|Engagement analytics/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Exercise library/ }).click();
    await expect(page.getByRole('heading', { name: 'Exercise library', exact: true })).toBeVisible();
    await expect(page.getByText('No exercises match those filters.')).toBeVisible();
    await expect(page.getByText(/Admin access is required/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to account settings' }).click();
    await expect(page.getByRole('heading', { name: 'Account & settings' })).toBeVisible();
    expect(requests.some(path => path.includes('/admin/'))).toBe(false);
  });
}

test('verified administrators have a separate exercise management entry', async ({ page }) => {
  const requests = await account(page, 'admin');
  await page.getByRole('button', { name: /Manage exercises/ }).click();
  await expect(page.getByRole('heading', { name: 'Admin · Exercises', exact: true })).toBeVisible();
  await expect.poll(() => requests.some(path => path.endsWith('/admin/exercises'))).toBe(true);
  await page.getByRole('button', { name: 'Back to account settings' }).click();
  await page.getByRole('button', { name: /Exercise library/ }).click();
  await expect(page.getByRole('heading', { name: 'Exercise library', exact: true })).toBeVisible();
});
