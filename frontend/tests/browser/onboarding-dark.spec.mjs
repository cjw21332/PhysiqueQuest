import { test, expect } from '@playwright/test';
import { expectDarkPalette, expectReferenceLayout } from './theme-layout-helpers.mjs';

async function capture(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready);
  await expectDarkPalette(page);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
}

test('dark reference onboarding preserves registration, calibration, scrolling, and profile saving', async ({ page }, testInfo) => {
  let savedProfile;
  await page.addInitScript(() => {
    window.ReactNativeWebView = { postMessage(message) {
      if (JSON.parse(message).type !== 'request-device-readiness') return;
      window.dispatchEvent(new CustomEvent('physiquequest-device-readiness', { detail: {
        platform: 'android', osName: 'Android', osVersion: '14', networkType: 'wifi', wifiConnected: true, wifiSpeedMbps: 84, cameraPermission: 'prompt',
      } }));
    } };
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const pathname = new URL(request.url()).pathname;
    let json = {};
    if (pathname.endsWith('/auth/register')) json = { access_token: 'visual-test', user: { id: 'visual-user', name: 'Juan Dela Cruz', email: 'juan@example.test' } };
    if (pathname.endsWith('/profile') && request.method() === 'POST') { savedProfile = request.postDataJSON(); json = savedProfile; }
    return route.fulfill({ json, headers });
  });

  await page.goto('/launch');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('2 of 3 ready')).toBeVisible();
  await expect(page.locator('.launch')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expectReferenceLayout(page, ['.launch', '.launch-brand', '.brand-logo', '.readiness', '.launch-actions']);
  await capture(page, testInfo, '01-launch');
  await page.getByRole('link', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expectReferenceLayout(page, ['.auth-screen', '.auth-body', '.auth-heading', '.segmented', '.auth-footer']);
  await capture(page, testInfo, '02-register');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Confirm React's password interaction is live before entering form values.
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await page.getByLabel('Full name').fill('Juan Dela Cruz');
  await page.getByLabel('Email address').fill('juan@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Testing123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Testing123');
  await page.getByRole('checkbox').check();
  await expect(page.getByLabel('Full name')).toHaveValue('Juan Dela Cruz');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Start calibration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal data' })).toBeVisible();
  await expectReferenceLayout(page, ['.calibration-wizard', '.wizard-heading', '.step-content', '.calibration-footer']);
  await page.getByRole('button', { name: 'Next: Goals', exact: true }).click();
  await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Enter an age');
  await page.getByLabel('Age', { exact: true }).fill('24');
  await page.locator('.section-header').filter({ hasText: 'Basic information' }).getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('');
  await page.getByLabel('Age', { exact: true }).fill('24');
  await page.getByLabel('Height', { exact: true }).fill('180');
  await page.getByLabel('Weight', { exact: true }).fill('75');
  await page.getByRole('button', { name: 'Male', exact: true }).click();
  await page.getByRole('button', { name: 'Moderate', exact: true }).click();
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  await capture(page, testInfo, '03-personal-data');
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, testInfo, '04-personal-data-scrolled');
  await page.getByRole('button', { name: 'Next: Goals', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal data', exact: true })).toBeVisible();
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('24');
  await page.getByRole('button', { name: 'Next: Goals', exact: true }).click();
  await page.getByRole('button', { name: /Build muscle Hypertrophy/ }).click();
  await page.getByRole('button', { name: 'Consistent', exact: true }).click();
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  await capture(page, testInfo, '05-goals');
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, testInfo, '06-goals-scrolled');
  await page.getByRole('button', { name: 'Next: Training', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: /Build muscle Hypertrophy/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next: Training', exact: true }).click();
  await page.getByRole('button', { name: 'Dumbbells', exact: true }).click();
  for (const day of ['Monday', 'Wednesday', 'Friday', 'Saturday']) await page.getByRole('button', { name: day, exact: true }).click();
  await page.getByRole('button', { name: '45 min', exact: true }).click();
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  await page.getByRole('button', { name: 'Next: Health info', exact: true }).click();
  await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Confirm that you can place your phone');
  await capture(page, testInfo, '07-training');
  await page.getByRole('checkbox', { name: 'I can place my phone 2.5–3.0 m away' }).check();
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, testInfo, '08-training-scrolled');
  await page.getByRole('button', { name: 'Next: Health info', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.equipment').filter({ hasText: 'Dumbbells' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next: Health info', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Knee injury', exact: true }).check();
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  await capture(page, testInfo, '09-health-safety');
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await capture(page, testInfo, '10-health-safety-scrolled');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'Finish & build my plan', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByLabel('Name', { exact: true }).fill('Maria Cruz');
  await page.getByLabel('Mobile number').fill('09123456789');
  await page.getByRole('button', { name: 'Finish & build my plan', exact: true }).click();
  await expect.poll(() => savedProfile?.contactName).toBe('Maria Cruz');
  expect(savedProfile).toMatchObject({ age: '24', goal: 'Build muscle', equipment: ['Dumbbells'], duration: '45 min', conditions: ['Knee injury'] });
  expect(savedProfile.days).toHaveLength(4);
});

test('login uses the dark palette and preserves password visibility', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.locator('.auth-screen')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await page.getByLabel('Password', { exact: true }).fill('Example123');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await capture(page, testInfo, '11-login');
  await page.getByText('Forgot Password?', { exact: true }).click();
  await expect(page.locator('.forgot-password-modal')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expectReferenceLayout(page, ['.forgot-password-modal', '.modal-header', '.modal-footer']);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.forgot-password-modal')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
});
