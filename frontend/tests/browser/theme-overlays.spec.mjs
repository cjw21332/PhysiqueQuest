import { test, expect } from '@playwright/test';
import { expectDarkPalette } from './theme-layout-helpers.mjs';

async function signedIn(page) {
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/profile') ? { name: 'Visual', email: 'visual@example.test', equipment: [], days: [] }
      : path.endsWith('/nutrition') ? { meals: [], water: [] }
      : path.endsWith('/exercises') ? { items: [], total: 0, page: 1, limit: 12, pages: 0 }
      : { values: {} };
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
}

test('logout, photo chooser, public library and profile errors share the dark palette', async ({ page }, info) => {
  await signedIn(page);
  await page.goto('/me');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.locator('.logout-modal')).toBeVisible();
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath('logout-dark.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.logout-modal')).toHaveCount(0);
  await page.goto('/scan');
  await page.getByRole('button', { name: /Scan your meal/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectDarkPalette(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/exercises');
  await expect(page.getByText('No exercises match those filters.')).toBeVisible();
  await expectDarkPalette(page);
  await page.route('**/api/profile', route => route.fulfill({ status: 503, json: { message: 'Service unavailable' }, headers: { 'access-control-allow-origin': '*' } }));
  await page.evaluate(() => localStorage.removeItem('physiquequest-device-cache-v1'));
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Could not load your profile' })).toBeVisible();
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath('profile-error-dark.png') });
});

test('password recovery keeps every stage and feedback dark', async ({ page }, info) => {
  await page.route('**/api/auth/password-reset/**', route => route.fulfill({
    json: route.request().url().endsWith('/request') ? { requestId: 'visual-request', delivery: 'sent' }
      : route.request().url().endsWith('/verify') ? { verified: true, resetToken: 'visual-reset' } : { updated: true },
    headers: { 'access-control-allow-origin': '*' },
  }));
  await page.goto('/login');
  await page.getByText('Forgot Password?', { exact: true }).click();
  await page.getByLabel('Email address').last().fill('visual@example.test');
  await expectDarkPalette(page);
  await page.getByRole('button', { name: 'Send OTP Verification', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verification code' })).toBeVisible();
  await expectDarkPalette(page);
  await page.getByLabel('Digit 1 of 6', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create new password' })).toBeVisible();
  await expectDarkPalette(page);
  await page.getByLabel('New Password', { exact: true }).fill('Example123');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('Example123');
  await page.getByRole('button', { name: 'Update New Password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath('recovery-success-dark.png') });
  await page.getByRole('button', { name: 'Return to sign in', exact: true }).click();
  await expect(page.locator('.forgot-password-modal')).toHaveCount(0);
});
