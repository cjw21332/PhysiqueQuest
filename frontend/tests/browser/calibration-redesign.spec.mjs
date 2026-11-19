import { test, expect } from '@playwright/test';

test('registration and all four setup steps work at phone size', async ({ page }, info) => {
  let saved;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session/refresh')) return route.fulfill({ status: 401, json: {} });
    let json = {};
    if (path.endsWith('/auth/registration-code/request')) json = { requestId: 'a'.repeat(64) };
    if (path.endsWith('/auth/session/register')) { saved = route.request().postDataJSON().profile; json = { access_token: 'test', expires_in: 900, user: { id:'visual-user', name:'Juan', email:'juan@example.test' } }; }
    if (path.endsWith('/profile') && route.request().method() === 'POST') { saved = route.request().postDataJSON(); json = saved; }
    return route.fulfill({ json });
  });
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Juan Dela Cruz');
  await page.getByLabel('Email address').fill('juan@example.test');
  await page.getByLabel('Password', { exact:true }).fill('Testing123');
  await page.getByLabel('Confirm password', { exact:true }).fill('Testing123');
  await page.getByRole('checkbox', { name:/Agree to the Terms/ }).click();
  const dialog = page.getByRole('dialog', { name:'Review your agreement' });
  await dialog.getByRole('region', { name:'Terms and privacy notices' }).evaluate(el => { el.scrollTop=el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await dialog.getByRole('button', { name:'Agree and continue' }).click();
  await page.screenshot({ path:info.outputPath('registration.png') });
  await page.getByRole('button', { name:'Create account', exact:true }).click();
  expect(saved).toBeUndefined();
  await page.getByLabel('Age', { exact:true }).fill('24');
  await page.getByLabel('Height', { exact:true }).fill('180');
  await page.getByLabel('Weight', { exact:true }).fill('75');
  await page.getByRole('button', { name:'Male', exact:true }).click();
  await page.getByRole('button', { name:'Moderate', exact:true }).click();
  await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop=0; });
  await page.screenshot({ path:info.outputPath('step-1.png') });
  await page.getByRole('button', { name:'Next: Goals' }).click();
  await page.screenshot({ path:info.outputPath('step-2.png') });
  await page.getByRole('button', { name:/Build muscle Resistance training/ }).click();
  await page.getByRole('button', { name:'Consistent', exact:true }).click();
  await page.getByRole('button', { name:'Next: Training' }).click();
  await page.screenshot({ path:info.outputPath('step-3.png') });
  await page.getByRole('button', { name:'Dumbbells', exact:true }).click();
  await page.getByRole('button', { name:'Monday', exact:true }).click();
  await page.getByRole('button', { name:'30 min', exact:true }).click();
  await page.getByRole('button', { name:'Next: Health info' }).click();
  await page.screenshot({ path:info.outputPath('step-4.png') });
  await page.getByLabel('Name', { exact:true }).fill('Maria Cruz');
  await page.getByLabel('Mobile number').fill('09123456789');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name:'Save profile & continue' }).click();
  expect(saved).toBeUndefined();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name:'Confirm', exact:true }).click();
  await expect.poll(() => saved?.contactName).toBe('Maria Cruz');
});
