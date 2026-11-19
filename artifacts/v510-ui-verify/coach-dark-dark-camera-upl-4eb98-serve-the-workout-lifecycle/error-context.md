# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: coach-dark.spec.mjs >> dark camera, upload, live session and confirmed report preserve the workout lifecycle
- Location: tests\browser\coach-dark.spec.mjs:107:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Start session', exact: true })

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
  11  | ];
  12  | 
  13  | async function fixture(page) {
  14  |   await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
  15  |   await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'visual', token: 'visual-test' })));
  16  |   const profile = { name: 'Toji', equipment: ['Dumbbells'], duration: '45 min', contactName: 'Maria', contactPhone: '09123456789' };
  17  |   const catalog = exercises.map((item, i) => ({ ...item, _id: item.exerciseId, slug: item.exerciseId, targetMuscle: i === 1 ? 'Chest' : 'Shoulders', difficulty: 'Intermediate', trackingStatus: item.tracking, pose: 'ready', gifUrl: 'https://coach.test/demo.gif', recommended: '4 × 10', instructions: ['Lie flat with feet planted and a dumbbell in each hand at chest height.', 'Press both dumbbells up until your arms are straight over your shoulders.', 'Lower slowly until your elbows sit just below the bench line.', 'Pause for a beat, then press back up without bouncing.'], checks: ['Wrists stacked over elbows', 'Elbows at roughly 45° from your torso', 'Shoulder blades pinned to the bench'] }));
  18  |   await page.route('https://coach.test/demo.gif', route => route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
  19  |   let paused;
  20  |   let ended = false;
  21  |   let session;
  22  |   await page.route('**/api/**', async route => {
  23  |     const req = route.request(), url = new URL(req.url()), path = url.pathname;
  24  |     const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  25  |     if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  26  |     let json = {};
  27  |     if (path.endsWith('/profile')) json = profile;
  28  |     if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
  29  |     if (path.endsWith('/auth/me')) json = { id: 'visual', role: 'user' };
  30  |     if (path.endsWith('/coach/plan')) json = { weekLabel: 'Week 3 · 4 sessions planned', duration: '45 min', libraryReady: true, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ index, name, isWorkoutDay: [0, 2, 4, 5].includes(index), title: 'Upper Body — Push', exercises, equipmentLabel: 'Dumbbells', formTip: { exerciseName: 'Dumbbell bench press', text: 'Keep your wrists stacked over your elbows and lower until your upper arms are level with the bench.' } })) };
  31  |     if (path.endsWith('/exercises')) {
  32  |       const search = (url.searchParams.get('search') || '').toLowerCase();
  33  |       const muscle = url.searchParams.get('muscle');
  34  |       const items = catalog.filter(item => (!search || item.name.toLowerCase().includes(search)) && (!muscle || item.targetMuscle === muscle));
  35  |       json = { items, total: items.length, page: 1, pages: 1, limit: 12 };
  36  |     }
  37  |     if (/\/exercises\/[^/]+$/.test(path)) json = catalog.find(item => item._id === path.split('/').at(-1));
  38  |     if (path.endsWith('/pose/status')) json = { available: true };
  39  |     if (path.endsWith('/pose/analyze')) json = { readiness: { fullBodyInFrame: true, lighting: true, distance: { meters: 2.7 } } };
  40  |     if (path.endsWith('/workouts') && req.method() === 'POST') { session = { _id: 'session-1', ...req.postDataJSON(), status: 'active' }; json = session; }
  41  |     if (path.endsWith('/pause')) { paused = req.postDataJSON().paused; session = { ...session, pausedAt: paused ? req.postDataJSON().occurredAt : null, revision: (session.revision??0)+1 }; json = session; }
  42  |     if (path.endsWith('/sets')) { const result=req.postDataJSON().result;session={...session,sets:[...(session.sets??[]).filter(set=>set.setId!==result.setId),result],revision:(session.revision??0)+1};json=session; }
  43  |     if (path.endsWith('/complete')) {
  44  |       ended = true;
  45  |       json = { ...session, ...req.postDataJSON(), durationSeconds: 2536, status: 'completed', sets: [{ exerciseId: 'bench-press', reps: 37, loadKg: 22, status: 'completed' }, { exerciseId: 'overhead-press', reps: 29, loadKg: 16, status: 'completed' }], exerciseResults: [{ exerciseId: 'push-up', reps: 36 }, { exerciseId: 'bench-press', reps: 37, loadKg: 22 }, { exerciseId: 'overhead-press', reps: 29, loadKg: 16 }] };
  46  |     }
  47  |     return route.fulfill({ json, headers });
  48  |   });
  49  |   return { get paused() { return paused; }, get ended() { return ended; }, get requestKey() { return session?.requestKey; } };
  50  | }
  51  | 
  52  | async function capture(page, info, name) {
  53  |   await page.evaluate(() => document.fonts.ready);
  54  |   await expectDarkPalette(page);
  55  |   await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  56  | }
  57  | 
  58  | async function expectBackBeforeTitle(page) {
  59  |   const back = page.getByRole('button', { name: 'Back to AI Coach', exact: true });
  60  |   await expect(back).toBeVisible();
  61  |   const button = await back.boundingBox();
  62  |   const title = await page.locator('.coach-header h2').boundingBox();
  63  |   expect(button.x + button.width).toBeLessThanOrEqual(title.x);
  64  |   expect(button.width).toBeGreaterThanOrEqual(44);
  65  | }
  66  | 
  67  | test('dark Coach plan, library and exercise details retain filters, playback and close controls', async ({ page }, info) => {
  68  |   await fixture(page);
  69  |   await page.goto('/coach');
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
> 111 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
      |                                                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  170 |   await expect(page.locator('.coach-dark-theme')).toBeVisible();
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