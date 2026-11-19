# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey-dark.spec.mjs >> dark notifications preserve individual and mark-all read actions
- Location: tests\browser\journey-dark.spec.mjs:190:1

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '2 missions left, unread', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - main [ref=e4]:
      - generic [ref=e6]:
        - generic [ref=e9]:
          - generic [ref=e10]:
            - generic [ref=e11]:
              - button "Back to Home" [ref=e12] [cursor=pointer]
              - heading "Notifications" [level=2] [ref=e15]
            - button "Mark all read" [ref=e16] [cursor=pointer]
          - generic [ref=e17]:
            - generic [ref=e18]:
              - heading "Your updates" [level=3] [ref=e19]
              - paragraph [ref=e20]: Keep track of your activity and safety notices.
            - generic [ref=e21]: 4 unread
          - region "Pinned safety notice" [ref=e22] [cursor=pointer]:
            - generic [ref=e27]:
              - generic [ref=e28]: Safety notice · pinned
              - generic [ref=e29]: Emergency alert sent — Nov 14, 7:42 PM
              - paragraph [ref=e30]: Maria Dela Cruz was notified. Review the flagged session.
              - generic [ref=e31]: now
              - button "Mark as read" [ref=e32]
          - region "Your notifications" [ref=e33]:
            - heading "Recent activity" [level=3] [ref=e34]
            - button "Streak penalty applied, −50 points · 1 strike for a missed day" [ref=e35] [cursor=pointer]:
              - generic [ref=e39]:
                - generic [ref=e40]: Streak penalty applied
                - generic [ref=e42]: −50 points · 1 strike for a missed day
                - generic [ref=e43]: 2d
            - button "You moved up to rank 14, Weekly leaderboard · friends, unread, mark as read" [ref=e44] [cursor=pointer]:
              - generic [ref=e49]:
                - generic [ref=e50]:
                  - generic [ref=e51]: You moved up to rank 14
                  - generic [ref=e52]: Unread
                - generic [ref=e53]: Weekly leaderboard · friends
                - generic [ref=e54]: 8h
            - button "Post-workout report ready, Upper Body — Push · 88% form score, unread, mark as read" [ref=e56] [cursor=pointer]:
              - generic [ref=e61]:
                - generic [ref=e62]:
                  - generic [ref=e63]: Post-workout report ready
                  - generic [ref=e64]: Unread
                - generic [ref=e65]: Upper Body — Push · 88% form score
                - generic [ref=e66]: 5h
            - button "2 missions left, Finish before midnight to keep your 12-day streak, unread, mark as read" [ref=e68] [cursor=pointer]:
              - generic [ref=e74]:
                - generic [ref=e75]:
                  - generic [ref=e76]: 2 missions left
                  - generic [ref=e77]: Unread
                - generic [ref=e78]: Finish before midnight to keep your 12-day streak
                - generic [ref=e79]: 2h
          - region [ref=e81]:
            - generic [ref=e82]:
              - generic [ref=e87]:
                - heading "Daily check-in" [level=3] [ref=e88]
                - paragraph [ref=e89]: Choose when you’d like a reminder.
              - generic [ref=e90]: "Off"
            - generic [ref=e91]:
              - generic [ref=e92]: Reminder time
              - generic [ref=e93]:
                - textbox "Reminder time" [ref=e94]: 20:00
                - button "Save reminder" [ref=e95] [cursor=pointer]
              - generic [ref=e96]: Times use your device’s time zone.
            - generic [ref=e102]:
              - strong [ref=e103]: Phone notifications
              - paragraph [ref=e104]: Open the PhysiqueQuest phone app to enable alerts on your device.
        - navigation "Main navigation" [ref=e105]:
          - button "Home" [ref=e106] [cursor=pointer]
          - button "Coach" [ref=e111] [cursor=pointer]
          - button "Scan food and nutrition" [ref=e117] [cursor=pointer]:
            - generic [ref=e121]: Scan
          - button "Quests" [ref=e122] [cursor=pointer]
          - button "Me, account and settings" [ref=e127] [cursor=pointer]:
            - generic [ref=e132]: Me
    - button "Open Phiq coach" [ref=e133] [cursor=pointer]
```

# Test source

```ts
  99  |   }
  100 |   await page.getByRole('button', { name: 'Edit', exact: true }).click();
  101 |   await page.getByRole('textbox', { name: 'Full name' }).fill('Updated name');
  102 |   await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  103 |   await page.getByRole('button', { name: 'Discard' }).click();
  104 |   await expect(page.locator('.me-profile-name b')).toHaveText('Toji');
  105 |   let saved;
  106 |   await page.route('**/api/profile', async route => {
  107 |     saved = route.request().postDataJSON();
  108 |     await route.fulfill({ json: saved, headers: { 'access-control-allow-origin': '*' } });
  109 |   });
  110 |   await page.getByRole('button', { name: 'Edit', exact: true }).click();
  111 |   await page.getByRole('textbox', { name: 'Full name' }).fill('Saved name');
  112 |   await page.getByRole('button', { name: 'Save changes' }).click();
  113 |   await expect(page.locator('.me-profile-name b')).toHaveText('Saved name');
  114 |   expect(saved.name).toBe('Saved name');
  115 |   await page.setViewportSize({ width: 320, height: 700 });
  116 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  117 | });
  118 | 
  119 | test('dark quests retain leaderboard period selection and return navigation', async ({ page }, info) => {
  120 |   await fixtures(page);
  121 |   await page.route('**/api/leaderboard**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/strength') ? {
  122 |     exercises: [{ id: 'squat', name: 'Squat' }, { id: 'deadlift', name: 'Deadlift' }], exerciseId: new URL(route.request().url()).searchParams.get('exerciseId') || 'squat', metric: new URL(route.request().url()).searchParams.get('metric'), entries: [{ userId: 'player-1', rank: 1, name: 'Levi M.', score: 120, maxKg: 120, loadKg: 100, reps: 6 }], self: null, hidden: false,
  123 |   } : {
  124 |     entries: Array.from({ length: 7 }, (_, i) => ({ userId: `player-${i}`, rank: i + 1, name: ['Levi M.', 'Charles W.', 'Michael A.', 'Rico M.', 'Angel P.', 'Karl D.', 'Bea S.'][i], points: 4210 - i * 180, movement: i % 2 ? 2 : null })),
  125 |     self: { rank: 14, points: 1840, movement: 3 },
  126 |   }, headers: { 'access-control-allow-origin': '*' } }));
  127 |   await page.goto('/quests');
  128 |   await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
  129 |   await expect(page.locator('.quest-v2-level-card')).toHaveCSS('background-color', 'rgb(20, 59, 38)');
  130 |   await capture(page, info, 'quests-dark');
  131 |   await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  132 |   await expect(page.locator('.podium-player')).toHaveCount(3);
  133 |   await page.getByRole('tab', { name: 'This month' }).click();
  134 |   await expect(page.getByRole('tab', { name: 'This month' })).toHaveAttribute('aria-selected', 'true');
  135 |   await capture(page, info, 'leaderboard-dark');
  136 |   await page.getByRole('button', { name: /Strength/ }).click();
  137 |   await expect(page.getByRole('region', { name: 'Top three lifters' })).toContainText('Levi M.');
  138 |   await page.getByRole('button', { name: 'Deadlift', exact: true }).click();
  139 |   await page.getByRole('button', { name: /Pound for pound/ }).click();
  140 |   await expect(page.getByRole('button', { name: /Submit.*video/i })).toHaveCount(0);
  141 |   await page.getByRole('button', { name: /Quests Points earned/ }).click();
  142 |   await expect(page.locator('.podium-player')).toHaveCount(3);
  143 |   await page.getByRole('button', { name: 'Back to quests' }).click();
  144 |   await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible();
  145 | });
  146 | 
  147 | test('dark dashboard, goals and progress match reference layouts and preserve measurement saving', async ({ page }, info) => {
  148 |   const state = await fixtures(page);
  149 |   await page.goto('/home');
  150 |   await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  151 |   await expect(page.getByText('1,840', { exact: true })).toBeVisible();
  152 |   await expect(page.locator('.home-section')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  153 |   await expectReferenceLayout(page, ['.home-section', '.home-content', '.home-ref-dashboard', '.home-ref-header', '.home-ref-workout', '.home-bottom-nav']);
  154 |   await capture(page, info, '01-dashboard');
  155 |   await page.locator('.home-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  156 |   await capture(page, info, '02-dashboard-scrolled');
  157 |   await page.getByRole('button', { name: /Goals & milestones/ }).click();
  158 |   await expect(page.getByRole('heading', { name: 'Goals', exact: true })).toBeVisible();
  159 |   await expectHomeBack(page);
  160 |   await expectReferenceLayout(page, ['.home-ref-goals-page', '.section-page-head', '.home-ref-goal', '.home-ref-milestones']);
  161 |   await expect(page.getByRole('progressbar', { name: 'Progress toward target weight' })).toHaveAttribute('aria-valuenow', '62');
  162 |   await capture(page, info, '03-goals');
  163 |   await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  164 |   await page.getByRole('button', { name: /Progress Review saved measurements/ }).click();
  165 |   await expect(page.getByText('68.5 kg', { exact: true }).first()).toBeVisible();
  166 |   await expectHomeBack(page);
  167 |   await expect(page.locator('.section-page-head').getByRole('button', { name: 'Add measurement', exact: true })).toBeVisible();
  168 |   await expectReferenceLayout(page, ['.home-ref-progress-page', '.section-page-head', '.home-ref-metric-tabs', '.home-ref-chart', '.home-ref-history']);
  169 |   await capture(page, info, '04-progress');
  170 |   await page.locator('.home-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  171 |   await capture(page, info, '05-progress-scrolled');
  172 |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  173 |     await page.setViewportSize(size);
  174 |     await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
  175 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  176 |   }
  177 |   await page.setViewportSize({ width: 390, height: 844 });
  178 |   await page.getByRole('button', { name: 'Add measurement', exact: true }).click();
  179 |   await page.getByLabel('Log weight (kg)').fill('69');
  180 |   await page.getByRole('button', { name: 'Save measurement', exact: true }).click();
  181 |   await expect.poll(() => state.saved?.value).toBe(69);
  182 |   await expect(page.locator('.home-ref-measurement strong')).toHaveText('69 kg');
  183 |   await page.locator('.home-ref-history summary').click();
  184 |   await page.getByRole('button', { name: 'Delete 69 kg measurement', exact: true }).click();
  185 |   await expect(page.locator('.home-ref-measurement strong')).toHaveText('68.5 kg');
  186 |   await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  187 |   await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  188 | });
  189 | 
  190 | test('dark notifications preserve individual and mark-all read actions', async ({ page }, info) => {
  191 |   const state = await fixtures(page);
  192 |   await page.goto('/home');
  193 |   await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  194 |   await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  195 |   await expectHomeBack(page);
  196 |   await expectReferenceLayout(page, ['.home-notifications', '.section-page-head', '.notification-safety-card', '.notification-item']);
  197 |   await expect(page.getByRole('region', { name: 'Pinned safety notice' })).toBeVisible();
  198 |   await capture(page, info, '06-notifications');
> 199 |   await page.getByRole('button', { name: '2 missions left, unread', exact: true }).click();
      |                                                                                    ^ Error: locator.click: Test timeout of 15000ms exceeded.
  200 |   await expect(page.getByRole('button', { name: '2 missions left', exact: true })).toBeVisible();
  201 |   await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  202 |   await expect.poll(() => state.marks).toBe(1);
  203 |   await expect(page.locator('.unread-dot')).toHaveCount(0);
  204 |   await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  205 |   await expect(page.getByRole('heading', { name: 'Hi, Toji' })).toBeVisible();
  206 | });
  207 | 
  208 | test('Scan nutrition, estimate, and log use the dark reference palette', async ({ page }, info) => {
  209 |   await fixtures(page);
  210 |   await page.route('**/api/nutrition', route => route.fulfill({
  211 |     json: { meals: [], water: [] },
  212 |     headers: { 'access-control-allow-origin': '*' },
  213 |   }));
  214 | 
  215 |   await page.goto('/scan');
  216 |   await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();
  217 |   await page.getByRole('button', { name: 'View sample nutrition' }).click();
  218 |   await expect(page.locator('.scan-dark-theme')).toHaveCSS('color-scheme', 'dark');
  219 |   await expect(page.locator('.scan-reference')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  220 |   await expect(page.locator('.home-bottom-nav')).toHaveCSS('background-color', 'rgb(22, 29, 39)');
  221 |   await expect(page.locator('.circle-bg')).toHaveCSS('stroke', 'rgb(39, 52, 68)');
  222 |   await expect(page.locator('.scan-dashboard-scan')).toHaveCSS('color', 'rgb(11, 15, 21)');
  223 |   await expect(page.locator('.scan-dashboard-header h1')).toHaveCSS('font-size', '16px');
  224 |   await expect(page.locator('.scan-reference')).toHaveCSS('font-family', /Inter/);
  225 |   await expect(page.locator('.calorie-amount')).toHaveText('1,420');
  226 |   await expect(page.locator('.calorie-amount')).toHaveCSS('color', 'rgb(248, 250, 252)');
  227 |   await expect(page.locator('.home-calorie-progress')).toHaveCSS('width', '110px');
  228 |   await expect(page.locator('.scan-calories-remaining')).toHaveCSS('font-size', '14px');
  229 |   await capture(page, info, 'scan-dark-dashboard');
  230 | 
  231 |   await page.getByRole('button', { name: /Scan your meal/ }).click();
  232 |   await page.getByRole('button', { name: 'View sample estimate' }).click();
  233 |   await expect(page.getByRole('heading', { name: 'Review estimate' })).toBeVisible();
  234 |   await expect(page.locator('.scan-warning')).toHaveCSS('background-color', 'rgb(72, 9, 9)');
  235 |   await expect(page.locator('.detected-items > li').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  236 |   await expect(page.locator('.detected-item-body b').first()).toHaveCSS('font-size', '15px');
  237 |   await expect(page.locator('.review-estimate-footer .primary')).toHaveCSS('color', 'rgb(11, 15, 21)');
  238 |   await capture(page, info, 'scan-dark-review');
  239 | 
  240 |   await page.getByRole('button', { name: 'Back to Nutrition' }).click();
  241 |   await page.getByRole('button', { name: 'Log & water intake' }).click();
  242 |   await expect(page.getByRole('heading', { name: "Today's log" })).toBeVisible();
  243 |   await expect(page.locator('.scan-reference')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  244 |   await expect(page.locator('.target-log-macro > div:first-child').first()).toHaveCSS('font-size', '13px');
  245 |   await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  246 |   await capture(page, info, 'scan-dark-log');
  247 | });
  248 | 
  249 | test('Scan add, edit, and history views use readable dark type and semantic colors', async ({ page }, info) => {
  250 |   await fixtures(page);
  251 |   await page.route('**/api/nutrition/foods/search**', route => route.fulfill({
  252 |     json: { request_id: 'scan-ui', candidates: [{ fdc_id: 123, description: 'Chicken breast', data_type: 'Foundation' }] },
  253 |     headers: { 'access-control-allow-origin': '*' },
  254 |   }));
  255 |   await page.route('**/api/nutrition', route => route.fulfill({
  256 |     json: {
  257 |       meals: [{
  258 |         id: 'breakfast-1', date: '2026-10-19', name: 'Oats and eggs', meal: 'Breakfast',
  259 |         calories: 420, protein: 28, carbs: 54, fat: 12, detail: 'Rolled oats and egg',
  260 |         time: '07:20', source: 'Scanned',
  261 |       }],
  262 |       water: [{ date: '2026-10-19', glasses: 5 }],
  263 |     },
  264 |     headers: { 'access-control-allow-origin': '*' },
  265 |   }));
  266 | 
  267 |   await page.goto('/scan');
  268 |   await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();
  269 |   await page.getByRole('button', { name: 'Manual entry' }).click();
  270 |   await expect(page.getByRole('heading', { name: 'Add food' })).toBeVisible();
  271 |   await expect(page.locator('.food-search input')).toHaveCSS('color', 'rgb(248, 250, 252)');
  272 |   await expect(page.locator('.recent-foods button').first()).toHaveCSS('font-size', '13px');
  273 |   await expect(page.locator('.calculated-head h3')).toHaveCSS('font-size', '16px');
  274 |   await page.getByRole('textbox', { name: 'Search food' }).fill('Chicken');
  275 |   await expect(page.getByRole('button', { name: /Chicken breast/ })).toBeVisible();
  276 |   await expect(page.locator('.food-result-list > button b')).toHaveCSS('font-size', '15px');
  277 |   await capture(page, info, 'scan-dark-add-food');
  278 | 
  279 |   await page.getByRole('button', { name: 'Back', exact: true }).click();
  280 |   await page.getByRole('button', { name: 'Log & water intake' }).click();
  281 |   await page.getByRole('button', { name: 'Edit Breakfast: Oats and eggs' }).click();
  282 |   await expect(page.getByRole('heading', { name: 'Edit meal' })).toBeVisible();
  283 |   await expect(page.locator('.meal-edit-caption')).toHaveCSS('font-size', '14px');
  284 |   await expect(page.getByRole('searchbox', { name: 'Food name' })).toHaveCSS('font-size', '16px');
  285 |   await expect(page.locator('.meal-food-search-hint')).toHaveCSS('color', 'rgb(148, 163, 184)');
  286 |   await page.getByRole('searchbox', { name: 'Food name' }).fill('Egg');
  287 |   await expect(page.locator('.meal-food-suggestions .food-result-list > button b')).toHaveCSS('font-size', '15px');
  288 |   await capture(page, info, 'scan-dark-edit-meal');
  289 | 
  290 |   await page.getByRole('button', { name: "Back to Today's Log" }).click();
  291 |   await page.getByRole('button', { name: 'History', exact: true }).click();
  292 |   await expect(page.getByRole('heading', { name: 'Food history' })).toBeVisible();
  293 |   await expect(page.locator('.history-caption')).toHaveCSS('font-size', '14px');
  294 |   await expect(page.locator('.history-entry b').first()).toHaveCSS('font-size', '15px');
  295 |   await expect(page.locator('.history-chart')).toBeVisible();
  296 |   await capture(page, info, 'scan-dark-food-history');
  297 | 
  298 |   await page.setViewportSize({ width: 320, height: 700 });
  299 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```