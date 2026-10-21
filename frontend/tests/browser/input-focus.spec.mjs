import { test, expect } from '@playwright/test';

async function style(field) {
  return field.evaluate(element => {
    const value = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return { outline: value.outlineStyle, shadow: value.boxShadow, border: value.borderColor,
      width: bounds.width, height: bounds.height };
  });
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`one field border for click and keyboard focus at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    const email = page.getByRole('textbox', { name: 'Email address', exact: true });
    const wrapper = email.locator('..');
    const before = await style(wrapper);
    await email.click();
    await expect(email).toBeFocused();
    expect(await style(email)).toMatchObject({ outline: 'none', shadow: 'none' });
    expect(await style(wrapper)).toEqual({ ...before, border: 'rgb(34, 197, 94)', outline: 'none', shadow: 'none' });
    await email.fill('focus@example.invalid');
    await page.keyboard.press('Tab');
    const password = page.locator('input[type=password]');
    await expect(password).toBeFocused();
    expect(await style(password)).toMatchObject({ outline: 'none', shadow: 'none' });
    expect(await style(password.locator('..'))).toMatchObject({ border: 'rgb(34, 197, 94)', outline: 'none', shadow: 'none' });
    await page.keyboard.press('Tab');
    const eye = page.getByRole('button', { name: 'Show password', exact: true });
    await expect(eye).toBeFocused();
    expect((await style(eye)).outline).toBe('solid');
    expect(await page.locator('html').evaluate(element => getComputedStyle(element).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
  });
}

test('shared focus survives section themes, wrappers, standalone fields and reduced motion', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toBeVisible();
  // Exercise the shared stylesheet in every owning scope without needing private account data.
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'focus-fixture';
    fixture.innerHTML = `<div class="scan-reference"><label class="food-search"><input aria-label="Food search"></label><label class="meal-edit-field"><textarea aria-label="Notes"></textarea><select aria-label="Food"><option>Meal</option></select></label></div>
      <div class="coach-dark-theme"><div class="coach-library"><label class="library-search"><input type="search" aria-label="Exercise search"></label></div></div>
      <div class="account-dark-theme"><div class="me-reference-edit"><label class="input-wrap"><input aria-label="Name"></label></div></div>
      <div class="admin-reference"><label class="admin-search"><input aria-label="Admin search"></label></div>
      <div class="calibration-wizard"><label class="input-wrap"><select class="unit-suffix-select" aria-label="Unit"><option>cm</option></select></label></div>
      <div class="forgot-password-modal"><label class="forgot-field"><input aria-label="Recovery email"></label><div class="password-input-wrap"><input type="password" aria-label="New password"></div><input class="otp-digit" aria-label="Code"></div>`;
    document.body.replaceChildren(fixture);
  });
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion });
    for (const field of await page.locator('#focus-fixture :is(input, textarea, select)').all()) {
      const before = await style(field);
      await field.focus();
      await expect(field).toBeFocused();
      await expect.poll(async () => (await style(field)).border, { message: await field.getAttribute('aria-label') }).toBe('rgb(34, 197, 94)');
      expect(await style(field), await field.getAttribute('aria-label')).toEqual({ ...before, outline: 'none', shadow: 'none', border: 'rgb(34, 197, 94)' });
      const composite = field.locator('..');
      if (await composite.evaluate(element => element.matches('.input-wrap, .food-search, .library-search, .admin-search'))) {
        await expect.poll(async () => (await style(composite)).border).toBe('rgb(34, 197, 94)');
        expect(await style(composite)).toMatchObject({ border: 'rgb(34, 197, 94)', outline: 'none', shadow: 'none' });
      }
    }
  }
});

test('password visibility stays inside the textbox with an inset keyboard focus ring', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByPlaceholder('At least 8 characters');
  await password.fill('SyntheticPassword123');
  const wrapper = password.locator('..');
  const bounds = await wrapper.boundingBox();
  const show = page.getByRole('button', { name: 'Show password', exact: true });
  await show.click();
  const hide = page.getByRole('button', { name: 'Hide password', exact: true });
  await expect(wrapper.locator('input')).toHaveAttribute('type', 'text');
  await expect(wrapper).toHaveCSS('border-color', 'rgb(34, 197, 94)');
  expect(await wrapper.boundingBox()).toEqual(bounds);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(hide).toBeFocused();
  await expect(hide).toHaveCSS('outline-style', 'solid');
  await expect(hide).toHaveCSS('outline-offset', '-3px');
  const eyeBounds = await hide.boundingBox();
  expect(eyeBounds.x).toBeGreaterThan(bounds.x);
  expect(eyeBounds.x + eyeBounds.width).toBeLessThan(bounds.x + bounds.width);
  await hide.click();
  await expect(wrapper.locator('input')).toHaveAttribute('type', 'password');
  await expect(wrapper.locator('input')).toHaveValue('SyntheticPassword123');
  await expect(wrapper).toHaveCSS('border-color', 'rgb(34, 197, 94)');
});
