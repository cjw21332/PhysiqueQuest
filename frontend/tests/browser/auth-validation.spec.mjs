import { test, expect } from '@playwright/test';
import { expectDarkPalette } from './theme-layout-helpers.mjs';

// The session check returns 401 so the logged-out forms render without the backend.
async function mockLoggedOut(page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session/refresh')) return route.fulfill({ status: 401, json: {} });
    return route.fulfill({ json: {} });
  });
}

test('log in shows one linked message per invalid field and focuses the first', async ({ page }) => {
  await mockLoggedOut(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();

  const email = page.getByLabel('Email address');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#auth-email-error')).toHaveText('Enter a valid email address, like you@email.com.');
  await expect(email).toHaveAttribute('aria-describedby', 'auth-email-error');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#auth-password-error')).toHaveText('Enter your password.');
  await expect(email).toBeFocused();
  await expectDarkPalette(page);
  await page.screenshot({ path: 'test-results/auth-login-errors.png', fullPage: true });
});

test('typing in a field clears only its own message', async ({ page }) => {
  await mockLoggedOut(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
  await page.getByLabel('Email address').fill('you@example.com');
  await expect(page.locator('#auth-email-error')).toHaveCount(0);
  await expect(page.locator('#auth-password-error')).toHaveText('Enter your password.');
});

test('forgot password links each step message to its field and ends in success', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session/refresh')) return route.fulfill({ status: 401, json: {} });
    if (path.endsWith('/auth/password-reset/request')) return route.fulfill({ json: { requestId: 'a'.repeat(64), delivery: 'email' } });
    if (path.endsWith('/auth/password-reset/verify')) return route.fulfill({ json: { verified: true, resetToken: 'reset-token' } });
    if (path.endsWith('/auth/password-reset/confirm')) return route.fulfill({ json: { updated: true } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot Password?' }).click();
  const dialog = page.getByRole('dialog');

  const email = dialog.getByLabel('Email address');
  await email.fill('not-an-email');
  await dialog.getByRole('button', { name: 'Send OTP Verification' }).click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute('aria-describedby', 'forgot-error');
  await expect(dialog.locator('#forgot-error')).toHaveText('Enter a valid email address, like you@email.com.');

  await email.fill('juan@example.test');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: 'Send OTP Verification' }).click();
  await dialog.getByLabel('Digit 1 of 6').fill('123456');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();

  const fresh = dialog.getByLabel('New Password', { exact: true });
  const again = dialog.getByLabel('Confirm New Password', { exact: true });
  await fresh.fill('weak');
  await again.fill('weak');
  await dialog.getByRole('button', { name: 'Update New Password' }).click();
  await expect(dialog.locator('#forgot-error')).toHaveText('Your new password does not meet all the requirements.');
  await expect(fresh).toHaveAttribute('aria-invalid', 'true');
  await expect(again).not.toHaveAttribute('aria-invalid', 'true');
  await page.screenshot({ path: 'test-results/auth-reset-password-errors.png' });

  await fresh.fill('Testing123');
  await again.fill('Testing124');
  await dialog.getByRole('button', { name: 'Update New Password' }).click();
  await expect(dialog.locator('#forgot-error')).toHaveText('Passwords do not match.');
  await expect(again).toHaveAttribute('aria-invalid', 'true');
  await expect(fresh).not.toHaveAttribute('aria-invalid', 'true');

  await again.fill('Testing123');
  await dialog.getByRole('button', { name: 'Update New Password' }).click();
  await expect(dialog.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await expectDarkPalette(page);
});

test('register names every field that fails and keeps the others', async ({ page }) => {
  await mockLoggedOut(page);
  await page.goto('/register');
  await page.getByLabel('Email address').fill('juan@example.test');
  await page.getByLabel('Password', { exact: true }).fill('weak');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.locator('#auth-name-error')).toHaveText('Enter your full name.');
  await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#auth-password-error')).toHaveText('Your password does not meet all the requirements above.');
  await expect(page.locator('#auth-confirm-error')).toHaveText('Your passwords do not match.');
  await expect(page.getByLabel('Email address')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Full name')).toBeFocused();
  await expectDarkPalette(page);
});
