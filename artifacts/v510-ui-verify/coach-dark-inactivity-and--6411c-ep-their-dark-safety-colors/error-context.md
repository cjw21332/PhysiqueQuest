# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: coach-dark.spec.mjs >> inactivity and alarm surfaces keep their dark safety colors
- Location: tests\browser\coach-dark.spec.mjs:167:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.coach-dark-theme')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.coach-dark-theme') with timeout 5000ms
  - waiting for locator('.coach-dark-theme')

```

```yaml
- alert
- alert:
  - text: Could not restore your session. Check your connection and retry.
  - button "Retry"
```

# Test source

```ts
  70  |   await expect(page.locator('.exercise-item')).toHaveCount(6);
  71  |   await expect(page.locator('.coach-section')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  72  |   for (const selector of ['.coach-plan-header']) {
  73  |     await expect(page.locator(selector).first()).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  74  |   }
  75  |   await expect(page.locator('.home-bottom-nav')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  76  |   await expectReferenceLayout(page, ['.coach-scroll', '.coach-plan-header', '.day-button', '.exercise-item', '.start-button-container', '.home-bottom-nav']);
  77  |   await capture(page, info, '01-coach-plan');
  78  |   await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  79  |   await capture(page, info, '02-coach-plan-scrolled');
  80  |   await page.getByRole('button', { name: /Exercise library/ }).click();
  81  |   await expect(page.getByText('6 exercises', { exact: true })).toBeVisible();
  82  |   await expect(page.getByRole('heading', { name: 'Exercise library', exact: true })).toBeInViewport();
  83  |   await expectBackBeforeTitle(page);
  84  |   await capture(page, info, '03-exercise-library');
  85  |   await page.getByRole('button', { name: /Dumbbell bench press Chest/ }).click();
  86  |   await expect(page.getByRole('dialog')).toBeVisible();
  87  |   await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  88  |   await expect(page.getByText('Manual tracking', { exact: true })).toBeVisible();
  89  |   await expectReferenceLayout(page, ['.coach-scroll', '.library-header', '.library-dialog', '.library-exercise-sheet', '.sheet-close']);
  90  |   await capture(page, info, '04-exercise-details');
  91  |   await page.getByRole('button', { name: 'Play exercise demonstration', exact: true }).click();
  92  |   await expect(page.getByRole('button', { name: 'Pause exercise demonstration', exact: true })).toBeVisible();
  93  |   await page.keyboard.press('Escape');
  94  |   await expect(page.getByRole('dialog')).toHaveCount(0);
  95  |   await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('bench');
  96  |   await expect(page.getByText('1 exercise', { exact: true })).toBeVisible();
  97  |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  98  |     await page.setViewportSize(size);
  99  |     await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
  100 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  101 |     await expectBackBeforeTitle(page);
  102 |   }
  103 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  104 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  105 | });
  106 | 
  107 | test('dark camera, upload, live session and confirmed report preserve the workout lifecycle', async ({ page }, info) => {
  108 |   await page.addInitScript(() => Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true }));
  109 |   const state = await fixture(page);
  110 |   await page.goto('/coach');
  111 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
  112 |   await expect(page.getByRole('heading', { name: 'Camera check', exact: true })).toBeVisible();
  113 |   await expectBackBeforeTitle(page);
  114 |   await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  115 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  116 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  117 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
  118 |   await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  119 |   await expect(page.getByText('4 of 4 ready', { exact: true })).toBeVisible();
  120 |   await capture(page, info, '05-camera-check');
  121 |   await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  122 |   await expect(page.getByRole('group', { name: 'Camera input' }).getByRole('button', { name: 'Upload video', exact: true })).toHaveAttribute('aria-pressed', 'true');
  123 |   await expect(page.getByRole('button', { name: 'Live feed', exact: true })).toHaveAttribute('aria-pressed', 'false');
  124 |   await expect(page.getByText('Upload a recorded set', { exact: true })).toBeVisible();
  125 |   await expectBackBeforeTitle(page);
  126 |   await expectReferenceLayout(page, ['.coach-scroll', '.coach-header', '.camera-tabs', '.upload-dropzone', '.coach-footer']);
  127 |   await page.locator('.choose-video input[type="file"]').focus();
  128 |   await expect(page.locator('.choose-video input[type="file"]')).toBeFocused();
  129 |   await expect(page.locator('.choose-video')).toHaveCSS('outline-width', '2px');
  130 |   await expect(page.locator('.choose-video input[type="file"]')).toHaveAttribute('aria-label', 'Choose a recorded exercise video');
  131 |   await capture(page, info, '06-upload-video');
  132 |   await page.getByRole('button', { name: 'Live feed', exact: true }).click();
  133 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
  134 |   await expect(page.getByRole('button', { name: 'Pause workout', exact: true })).toBeVisible();
  135 |   expect(state.requestKey).toMatch(/^workout-[a-f0-9]{32}$/);
  136 |   const enableLive = page.getByRole('button', { name: 'Enable camera', exact: true });
  137 |   if (await enableLive.isVisible()) await enableLive.click();
  138 |   await expect(page.locator('.live-camera')).toHaveJSProperty('readyState', 4);
  139 |   await capture(page, info, '07-live-session');
  140 |   await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  141 |   await expect.poll(() => state.paused).toBe(true);
  142 |   await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  143 |   await expect.poll(() => state.paused).toBe(false);
  144 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  145 |   await page.getByRole('button', { name: 'Save and end workout', exact: true }).click();
  146 |   await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  147 |   expect(state.ended).toBe(true);
  148 |   await expect(page.getByText('42:16', { exact: true })).toBeVisible();
  149 |   await expect(page.getByRole('heading', { name: 'Per exercise', exact: true })).toBeVisible();
  150 |   await expect(page.locator('.coach-footer')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  151 |   await expectBackBeforeTitle(page);
  152 |   await expectReferenceLayout(page, ['.coach-scroll', '.report-header', '.report-summary', '.report-section', '.coach-footer']);
  153 |   await capture(page, info, '08-workout-report');
  154 |   await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  155 |   await capture(page, info, '09-workout-report-scrolled');
  156 |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  157 |     await page.setViewportSize(size);
  158 |     await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  159 |     await expect(page.getByRole('button', { name: 'Back to home', exact: true })).toBeInViewport();
  160 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  161 |   }
  162 |   await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = 0; });
  163 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  164 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  165 | });
  166 | 
  167 | test('inactivity and alarm surfaces keep their dark safety colors', async ({ page }) => {
  168 |   await fixture(page);
  169 |   await page.goto('/coach');
> 170 |   await expect(page.locator('.coach-dark-theme')).toBeVisible();
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  171 |   const colors = await page.locator('.coach-dark-theme').evaluate(theme => {
  172 |     const session = document.createElement('div');
  173 |     session.className = 'coach-view-session';
  174 |     session.innerHTML = '<section class="inactivity-view inactivity-countdown"><div class="inactivity-ring"><svg><circle></circle><circle></circle></svg></div><div class="inactivity-notice"></div></section><section class="inactivity-view emergency-alarm"><button class="alarm-hold"></button><section class="alarm-log"></section></section>';
  175 |     theme.append(session);
  176 |     const countdown = session.querySelector('.inactivity-countdown');
  177 |     const circles = session.querySelectorAll('.inactivity-ring circle');
  178 |     const notice = session.querySelector('.inactivity-notice');
  179 |     const alarm = session.querySelector('.emergency-alarm');
  180 |     const stop = session.querySelector('.alarm-hold');
  181 |     const log = session.querySelector('.alarm-log');
  182 |     return {
  183 |       countdown: getComputedStyle(countdown).backgroundColor,
  184 |       ringTrack: getComputedStyle(circles[0]).stroke,
  185 |       ringProgress: getComputedStyle(circles[1]).stroke,
  186 |       notice: getComputedStyle(notice).backgroundColor,
  187 |       alarm: getComputedStyle(alarm).backgroundColor,
  188 |       stop: getComputedStyle(stop).backgroundColor,
  189 |       log: getComputedStyle(log).backgroundColor,
  190 |     };
  191 |   });
  192 |   expect(colors).toEqual({
  193 |     countdown: 'rgb(22, 29, 39)',
  194 |     ringTrack: 'rgb(39, 52, 68)',
  195 |     ringProgress: 'rgb(248, 113, 113)',
  196 |     notice: 'rgba(0, 0, 0, 0)',
  197 |     alarm: 'rgb(72, 9, 9)',
  198 |     stop: 'rgb(22, 29, 39)',
  199 |     log: 'rgb(22, 29, 39)',
  200 |   });
  201 | });
  202 | 
```