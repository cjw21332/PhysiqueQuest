import { test, expect } from '@playwright/test';

async function unverifiedSession(page) {
  await page.route('**/api/auth/session/refresh', route => route.fulfill({ json: {
    access_token: 'synthetic-session', expires_in: 900,
    user: { id: 'synthetic', name: 'Synthetic', email: 'synthetic@example.invalid', emailVerified: false, legacyEmailAccess: true },
  } }));
}

test('verification reminder floats without shifting content and can be dismissed', async ({ page }) => {
  await unverifiedSession(page);
  await page.goto('/launch');
  const alert = page.getByRole('status', { name: 'Email verification' });
  await expect(alert).toBeVisible();
  await expect(alert).toHaveCSS('position', 'fixed');
  const before = await page.locator('.launch').boundingBox();
  await alert.getByRole('button', { name: 'Dismiss email verification reminder' }).click();
  await expect(alert).toHaveCount(0);
  expect(await page.locator('.launch').boundingBox()).toEqual(before);
});

test('verification page requests mail, reports missing delivery honestly and updates the session after confirmation', async ({ page }) => {
  await unverifiedSession(page);
  await page.route('**/api/auth/verification/request', route => route.fulfill({ json: { accepted: true, developmentDelivery: 'unavailable' } }));
  await page.goto('/verify-email');
  await expect(page.getByRole('status', { name: 'Email verification' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('synthetic@example.invalid');
  await page.getByRole('button', { name: 'Send verification email' }).click();
  await expect(page.getByRole('status')).toContainText('Local email delivery is not configured');
  await page.route('**/api/auth/verification/confirm', route => route.fulfill({ json: { verified: true } }));
  await page.goto('/verify-email#token=synthetic-token');
  await expect(page.getByRole('button', { name: 'Confirm email' })).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.route('**/api/auth/session/refresh', route => route.fulfill({ json: {
    access_token: 'synthetic-verified', expires_in: 900, user: { id: 'synthetic', email: 'synthetic@example.invalid', emailVerified: true },
  } }));
  await page.getByRole('button', { name: 'Confirm email' }).click();
  await expect(page.getByRole('status')).toContainText('Email verified. You can continue.');
  await page.goto('/launch');
  await expect(page.getByRole('status', { name: 'Email verification' })).toHaveCount(0);
});
