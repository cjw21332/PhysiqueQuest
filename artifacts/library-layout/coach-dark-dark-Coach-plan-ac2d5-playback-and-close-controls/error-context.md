# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: coach-dark.spec.mjs >> dark Coach plan, library and exercise details retain filters, playback and close controls
- Location: tests\browser\coach-dark.spec.mjs:67:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('1 results', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('1 results', { exact: true }) with timeout 5000ms
  - waiting for getByText('1 results', { exact: true })

```

```yaml
- main:
  - button "Back to AI Coach"
  - heading "Exercise library" [level=2]
  - paragraph: Find a movement. Open its guide for instructions and available demonstrations.
  - searchbox "Search Exercise": bench
  - button "Clear search"
  - heading "Muscle group" [level=3]
  - button "Clear filters"
  - group "Muscle group":
    - button "All" [pressed]
    - button "Chest"
    - button "Back"
    - button "Legs"
    - button "Core"
    - button "Shoulders"
    - button "Arms"
  - group:
    - text: Equipment
    - strong: Dumbbells
  - status: 1 exercise
  - text: Tap to view guide
  - button "Dumbbell bench press Chest · Dumbbells · Intermediate AI tracked Demonstration"
  - paragraph:
    - text: Exercise data by
    - link "AscendAPI":
      - /url: https://ascendapi.com
    - text: .
  - navigation "Main navigation":
    - button "Home"
    - button "Coach"
    - button "Scan food and nutrition": Scan
    - button "Quests"
    - button "Me, account and settings": Me
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { expectDarkPalette, expectReferenceLayout } from './theme-layout-helpers.mjs';
  3   |
  4   | const exercises = [
  5   |   { exerciseId: 'push-up', name: 'Push-up', equipment: 'Bodyweight', prescription: '3 × 12', tracking: 'AI tracked' },
  6   |   { exerciseId: 'bench-press', name: 'Dumbbell bench press', equipment: 'Dumbbells', prescription: '4 × 10 · 22 kg', tracking: 'AI tracked' },
  7   |   { exerciseId: 'overhead-press', name: 'Overhead press', equipment: 'Dumbbells', prescription: '3 × 10 · 16 kg', tracking: 'AI tracked' },
  8   |   { exerciseId: 'lateral-raise', name: 'Lateral raise', equipment: 'Dumbbells', prescription: '3 × 15 · 6 kg', tracking: 'AI tracked' },
  9   |   { exerciseId: 'triceps-extension', name: 'Triceps extension', equipment: 'Dumbbells', prescription: '3 × 12 · 10 kg', tracking: 'Manual' },
  10  |   { exerciseId: 'plank', name: 'Plank', equipment: 'Bodyweight', prescription: '3 × 45 s', tracking: 'AI tracked' },
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
  82  |   await expectBackBeforeTitle(page);
  83  |   await capture(page, info, '03-exercise-library');
  84  |   await page.getByRole('button', { name: /Dumbbell bench press Chest/ }).click();
  85  |   await expect(page.getByRole('dialog')).toBeVisible();
  86  |   await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  87  |   await expect(page.getByText('Manual tracking', { exact: true })).toBeVisible();
  88  |   await expectReferenceLayout(page, ['.coach-scroll', '.library-header', '.library-dialog', '.library-exercise-sheet', '.sheet-close']);
  89  |   await capture(page, info, '04-exercise-details');
  90  |   await page.getByRole('button', { name: 'Play exercise demonstration', exact: true }).click();
  91  |   await expect(page.getByRole('button', { name: 'Pause exercise demonstration', exact: true })).toBeVisible();
  92  |   await page.keyboard.press('Escape');
  93  |   await expect(page.getByRole('dialog')).toHaveCount(0);
  94  |   await page.getByRole('searchbox', { name: 'Search Exercise' }).fill('bench');
> 95  |   await expect(page.getByText('1 results', { exact: true })).toBeVisible();
      |                                                              ^ Error: expect(locator).toBeVisible() failed
  96  |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  97  |     await page.setViewportSize(size);
  98  |     await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
  99  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  100 |     await expectBackBeforeTitle(page);
  101 |   }
  102 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  103 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  104 | });
  105 |
  106 | test('dark camera, upload, live session and confirmed report preserve the workout lifecycle', async ({ page }, info) => {
  107 |   await page.addInitScript(() => Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true }));
  108 |   const state = await fixture(page);
  109 |   await page.goto('/coach');
  110 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
  111 |   await expect(page.getByRole('heading', { name: 'Camera check', exact: true })).toBeVisible();
  112 |   await expectBackBeforeTitle(page);
  113 |   await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  114 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  115 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  116 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
  117 |   await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  118 |   await expect(page.getByText('4 of 4 ready', { exact: true })).toBeVisible();
  119 |   await capture(page, info, '05-camera-check');
  120 |   await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  121 |   await expect(page.getByRole('group', { name: 'Camera input' }).getByRole('button', { name: 'Upload video', exact: true })).toHaveAttribute('aria-pressed', 'true');
  122 |   await expect(page.getByRole('button', { name: 'Live feed', exact: true })).toHaveAttribute('aria-pressed', 'false');
  123 |   await expect(page.getByText('Upload a recorded set', { exact: true })).toBeVisible();
  124 |   await expectBackBeforeTitle(page);
  125 |   await expectReferenceLayout(page, ['.coach-scroll', '.coach-header', '.camera-tabs', '.upload-dropzone', '.coach-footer']);
  126 |   await page.locator('.choose-video input[type="file"]').focus();
  127 |   await expect(page.locator('.choose-video input[type="file"]')).toBeFocused();
  128 |   await expect(page.locator('.choose-video')).toHaveCSS('outline-width', '2px');
  129 |   await expect(page.locator('.choose-video input[type="file"]')).toHaveAttribute('aria-label', 'Choose a recorded exercise video');
  130 |   await capture(page, info, '06-upload-video');
  131 |   await page.getByRole('button', { name: 'Live feed', exact: true }).click();
  132 |   await page.getByRole('button', { name: 'Start session', exact: true }).click();
  133 |   await expect(page.getByRole('button', { name: 'Pause workout', exact: true })).toBeVisible();
  134 |   expect(state.requestKey).toMatch(/^workout-[a-f0-9]{32}$/);
  135 |   const enableLive = page.getByRole('button', { name: 'Enable camera', exact: true });
  136 |   if (await enableLive.isVisible()) await enableLive.click();
  137 |   await expect(page.locator('.live-camera')).toHaveJSProperty('readyState', 4);
  138 |   await capture(page, info, '07-live-session');
  139 |   await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  140 |   await expect.poll(() => state.paused).toBe(true);
  141 |   await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  142 |   await expect.poll(() => state.paused).toBe(false);
  143 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  144 |   await page.getByRole('button', { name: 'Save and end workout', exact: true }).click();
  145 |   await expect(page.getByRole('heading', { name: 'Workout report', exact: true })).toBeVisible();
  146 |   expect(state.ended).toBe(true);
  147 |   await expect(page.getByText('42:16', { exact: true })).toBeVisible();
  148 |   await expect(page.getByRole('heading', { name: 'Per exercise', exact: true })).toBeVisible();
  149 |   await expect(page.locator('.coach-footer')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  150 |   await expectBackBeforeTitle(page);
  151 |   await expectReferenceLayout(page, ['.coach-scroll', '.report-header', '.report-summary', '.report-section', '.coach-footer']);
  152 |   await capture(page, info, '08-workout-report');
  153 |   await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  154 |   await capture(page, info, '09-workout-report-scrolled');
  155 |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  156 |     await page.setViewportSize(size);
  157 |     await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  158 |     await expect(page.getByRole('button', { name: 'Back to home', exact: true })).toBeInViewport();
  159 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  160 |   }
  161 |   await page.locator('.coach-scroll').evaluate(el => { el.scrollTop = 0; });
  162 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  163 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  164 | });
  165 |
  166 | test('inactivity and alarm surfaces keep their dark safety colors', async ({ page }) => {
  167 |   await fixture(page);
  168 |   await page.goto('/coach');
  169 |   await expect(page.locator('.coach-dark-theme')).toBeVisible();
  170 |   const colors = await page.locator('.coach-dark-theme').evaluate(theme => {
  171 |     const session = document.createElement('div');
  172 |     session.className = 'coach-view-session';
  173 |     session.innerHTML = '<section class="inactivity-view inactivity-countdown"><div class="inactivity-ring"><svg><circle></circle><circle></circle></svg></div><div class="inactivity-notice"></div></section><section class="inactivity-view emergency-alarm"><button class="alarm-hold"></button><section class="alarm-log"></section></section>';
  174 |     theme.append(session);
  175 |     const countdown = session.querySelector('.inactivity-countdown');
  176 |     const circles = session.querySelectorAll('.inactivity-ring circle');
  177 |     const notice = session.querySelector('.inactivity-notice');
  178 |     const alarm = session.querySelector('.emergency-alarm');
  179 |     const stop = session.querySelector('.alarm-hold');
  180 |     const log = session.querySelector('.alarm-log');
  181 |     return {
  182 |       countdown: getComputedStyle(countdown).backgroundColor,
  183 |       ringTrack: getComputedStyle(circles[0]).stroke,
  184 |       ringProgress: getComputedStyle(circles[1]).stroke,
  185 |       notice: getComputedStyle(notice).backgroundColor,
  186 |       alarm: getComputedStyle(alarm).backgroundColor,
  187 |       stop: getComputedStyle(stop).backgroundColor,
  188 |       log: getComputedStyle(log).backgroundColor,
  189 |     };
  190 |   });
  191 |   expect(colors).toEqual({
  192 |     countdown: 'rgb(22, 29, 39)',
  193 |     ringTrack: 'rgb(39, 52, 68)',
  194 |     ringProgress: 'rgb(248, 113, 113)',
  195 |     notice: 'rgba(0, 0, 0, 0)',
```