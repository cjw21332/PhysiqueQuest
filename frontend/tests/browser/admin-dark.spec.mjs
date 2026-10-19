import { test, expect } from '@playwright/test';
import { expectDarkPalette } from './theme-layout-helpers.mjs';

test('admin dark references retain local controls and responsive layout', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  await page.route('**/api/**', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: route.request().url().includes('/profile') ? { name: 'Visual', email: 'visual@example.test', equipment: [], days: [] } : route.request().url().includes('/admin/exercises') ? [
      ['Dumbbell bench press', 'Chest · Dumbbells', 'published', 'ready'],
      ['Overhead press', 'Shoulders · Dumbbells', 'published', 'ready'],
      ['Bulgarian split squat', 'Legs · Dumbbells', 'draft', 'missing'],
      ['Cable fly', 'Chest · Machine', 'published', 'ready'],
      ['Kettlebell swing', 'Legs · Kettlebell', 'draft', 'training'],
      ['Band pull-apart', 'Back · Bands', 'draft', 'missing'],
    ].map(([name, group, status, pose], index) => ({ _id: String(index), name, group, status, pose })) : { values: {} },
  }));
  await page.goto('/me');
  await page.getByRole('button', { name: /Exercise library/ }).click();
  const screen = page.locator('.admin-reference');
  await expect(screen).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  await expect(screen).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.admin-exercise-row')).toHaveCount(6);
  await page.getByPlaceholder('Search content').fill('bench');
  await expect(page.locator('.admin-exercise-row')).toHaveCount(1);
  await page.getByPlaceholder('Search content').clear();
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath('library.png') });
  await page.getByRole('button', { name: /New$/ }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.locator('.admin-reference-form')).toHaveCSS('background-color', 'rgb(20, 59, 38)');
  await page.getByPlaceholder('e.g. Bulgarian split squat').fill('Test exercise');
  await page.getByPlaceholder('e.g. Dumbbells').fill('Dumbbells');
  await page.getByRole('switch', { name: 'Published' }).click();
  await expect(page.getByRole('switch', { name: 'Published' })).toBeChecked();
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath('new-exercise.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Back to account settings' }).click();
  await page.getByRole('button', { name: /Engagement analytics/ }).click();
  await expect(page.locator('.engagement-active-users strong')).toHaveText('1,284');
  await page.getByRole('button', { name: '7 days', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '30 days', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  expect((await download).suggestedFilename()).toContain('30-days.csv');
  await expectDarkPalette(page);
  await page.screenshot({ path: info.outputPath('engagement.png') });
  for (const [width, height] of [[320, 568], [390, 667], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Back to account settings' })).toBeVisible();
  }
});
