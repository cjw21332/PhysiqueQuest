# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-dark.spec.mjs >> admin dark references retain local controls and responsive layout
- Location: tests\browser\admin-dark.spec.mjs:4:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Exercise library/ })

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
  4  | test('admin dark references retain local controls and responsive layout', async ({ page }, info) => {
  5  |   await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  6  |   await page.route('**/api/**', route => route.fulfill({
  7  |     headers: { 'access-control-allow-origin': '*' },
  8  |     json: route.request().url().includes('/profile') ? { name: 'Visual', email: 'visual@example.test', equipment: [], days: [] } : route.request().url().includes('/admin/exercises') ? [
  9  |       ['Dumbbell bench press', 'Chest · Dumbbells', 'published', 'ready'],
  10 |       ['Overhead press', 'Shoulders · Dumbbells', 'published', 'ready'],
  11 |       ['Bulgarian split squat', 'Legs · Dumbbells', 'draft', 'missing'],
  12 |       ['Cable fly', 'Chest · Machine', 'published', 'ready'],
  13 |       ['Kettlebell swing', 'Legs · Kettlebell', 'draft', 'training'],
  14 |       ['Band pull-apart', 'Back · Bands', 'draft', 'missing'],
  15 |     ].map(([name, group, status, pose], index) => ({ _id: String(index), name, group, status, pose })) : { values: {} },
  16 |   }));
  17 |   await page.goto('/me');
> 18 |   await page.getByRole('button', { name: /Exercise library/ }).click();
     |                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
  19 |   const screen = page.locator('.admin-reference');
  20 |   await expect(screen).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  21 |   await expect(screen).toHaveCSS('font-family', /Inter/);
  22 |   await expect(page.locator('.admin-exercise-row')).toHaveCount(6);
  23 |   await page.getByPlaceholder('Search content').fill('bench');
  24 |   await expect(page.locator('.admin-exercise-row')).toHaveCount(1);
  25 |   await page.getByPlaceholder('Search content').clear();
  26 |   await expectDarkPalette(page);
  27 |   await page.screenshot({ path: info.outputPath('library.png') });
  28 |   await page.getByRole('button', { name: /New$/ }).click();
  29 |   await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  30 |   await expect(page.locator('.admin-reference-form')).toHaveCSS('background-color', 'rgb(20, 59, 38)');
  31 |   await page.getByPlaceholder('e.g. Bulgarian split squat').fill('Test exercise');
  32 |   await page.getByPlaceholder('e.g. Dumbbells').fill('Dumbbells');
  33 |   await page.getByRole('switch', { name: 'Published' }).click();
  34 |   await expect(page.getByRole('switch', { name: 'Published' })).toBeChecked();
  35 |   await expectDarkPalette(page);
  36 |   await page.screenshot({ path: info.outputPath('new-exercise.png') });
  37 |   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  38 |   await page.getByRole('button', { name: 'Back to account settings' }).click();
  39 |   await page.getByRole('button', { name: /Engagement analytics/ }).click();
  40 |   await expect(page.locator('.engagement-active-users strong')).toHaveText('1,284');
  41 |   await page.getByRole('button', { name: '7 days', exact: true }).click();
  42 |   await expect(page.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
  43 |   await page.getByRole('button', { name: '30 days', exact: true }).click();
  44 |   const download = page.waitForEvent('download');
  45 |   await page.getByRole('button', { name: 'Export' }).click();
  46 |   expect((await download).suggestedFilename()).toContain('30-days.csv');
  47 |   await expectDarkPalette(page);
  48 |   await page.screenshot({ path: info.outputPath('engagement.png') });
  49 |   for (const [width, height] of [[320, 568], [390, 667], [768, 1024], [1440, 900]]) {
  50 |     await page.setViewportSize({ width, height });
  51 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  52 |     await expect(page.getByRole('button', { name: 'Back to account settings' })).toBeVisible();
  53 |   }
  54 | });
  55 | 
```