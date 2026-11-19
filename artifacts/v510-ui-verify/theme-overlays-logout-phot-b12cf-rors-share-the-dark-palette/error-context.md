# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: theme-overlays.spec.mjs >> logout, photo chooser, public library and profile errors share the dark palette
- Location: tests\browser\theme-overlays.spec.mjs:16:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Log out', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - alert [ref=e3]:
    - text: Could not restore your session. Check your connection and retry.
    - button "Retry" [ref=e4] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { expectDarkPalette } from './theme-layout-helpers.mjs';
  3  | 
  4  | async function signedIn(page) {
  5  |   await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  6  |   await page.route('**/api/**', route => {
  7  |     const path = new URL(route.request().url()).pathname;
  8  |     const json = path.endsWith('/profile') ? { name: 'Visual', email: 'visual@example.test', equipment: [], days: [] }
  9  |       : path.endsWith('/nutrition') ? { meals: [], water: [] }
  10 |       : path.endsWith('/exercises') ? { items: [], total: 0, page: 1, limit: 12, pages: 0 }
  11 |       : { values: {} };
  12 |     return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  13 |   });
  14 | }
  15 | 
  16 | test('logout, photo chooser, public library and profile errors share the dark palette', async ({ page }, info) => {
  17 |   await signedIn(page);
  18 |   await page.goto('/me');
> 19 |   await page.getByRole('button', { name: 'Log out', exact: true }).click();
     |                                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  20 |   await expect(page.locator('.logout-modal')).toBeVisible();
  21 |   await expectDarkPalette(page);
  22 |   await page.screenshot({ path: info.outputPath('logout-dark.png') });
  23 |   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  24 |   await expect(page.locator('.logout-modal')).toHaveCount(0);
  25 |   await page.goto('/scan');
  26 |   await page.getByRole('button', { name: /Scan your meal/ }).click();
  27 |   await expect(page.getByRole('dialog')).toBeVisible();
  28 |   await expectDarkPalette(page);
  29 |   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  30 |   await page.goto('/exercises');
  31 |   await expect(page.getByText('No exercises match those filters.')).toBeVisible();
  32 |   await expectDarkPalette(page);
  33 |   await page.route('**/api/profile', route => route.fulfill({ status: 503, json: { message: 'Service unavailable' }, headers: { 'access-control-allow-origin': '*' } }));
  34 |   await page.evaluate(() => localStorage.removeItem('physiquequest-device-cache-v1'));
  35 |   await page.goto('/me');
  36 |   await expect(page.getByRole('heading', { name: 'Could not load your profile' })).toBeVisible();
  37 |   await expectDarkPalette(page);
  38 |   await page.screenshot({ path: info.outputPath('profile-error-dark.png') });
  39 | });
  40 | 
  41 | test('password recovery keeps every stage and feedback dark', async ({ page }, info) => {
  42 |   await page.route('**/api/auth/password-reset/**', route => route.fulfill({
  43 |     json: route.request().url().endsWith('/request') ? { requestId: 'visual-request', delivery: 'sent' }
  44 |       : route.request().url().endsWith('/verify') ? { verified: true, resetToken: 'visual-reset' } : { updated: true },
  45 |     headers: { 'access-control-allow-origin': '*' },
  46 |   }));
  47 |   await page.goto('/login');
  48 |   await page.getByText('Forgot Password?', { exact: true }).click();
  49 |   await page.getByLabel('Email address').last().fill('visual@example.test');
  50 |   await expectDarkPalette(page);
  51 |   await page.getByRole('button', { name: 'Send OTP Verification', exact: true }).click();
  52 |   await expect(page.getByRole('heading', { name: 'Verification code' })).toBeVisible();
  53 |   await expectDarkPalette(page);
  54 |   await page.getByLabel('Digit 1 of 6', { exact: true }).fill('123456');
  55 |   await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  56 |   await expect(page.getByRole('heading', { name: 'Create new password' })).toBeVisible();
  57 |   await expectDarkPalette(page);
  58 |   await page.getByLabel('New Password', { exact: true }).fill('Example123');
  59 |   await page.getByLabel('Confirm New Password', { exact: true }).fill('Example123');
  60 |   await page.getByRole('button', { name: 'Update New Password', exact: true }).click();
  61 |   await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  62 |   await expectDarkPalette(page);
  63 |   await page.screenshot({ path: info.outputPath('recovery-success-dark.png') });
  64 |   await page.getByRole('button', { name: 'Return to sign in', exact: true }).click();
  65 |   await expect(page.locator('.forgot-password-modal')).toHaveCount(0);
  66 | });
  67 | 
```