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
});

test('typing in a field clears only its own message', async ({ page }) => {
  await mockLoggedOut(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
  await page.getByLabel('Email address').fill('you@example.com');
  await expect(page.locator('#auth-email-error')).toHaveCount(0);
  await expect(page.locator('#auth-password-error')).toHaveText('Enter your password.');
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
