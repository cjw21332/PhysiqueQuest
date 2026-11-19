# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey-dark.spec.mjs >> Scan add, edit, and history views use readable dark type and semantic colors
- Location: tests\browser\journey-dark.spec.mjs:249:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Edit Breakfast: Oats and eggs' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - main [ref=e4]:
      - generic [ref=e6]:
        - button "Upload a meal photo" [ref=e7]
        - generic [ref=e8]:
          - generic [ref=e9]:
            - generic [ref=e10]:
              - button "Back to Nutrition" [ref=e11] [cursor=pointer]
              - heading "Today's log" [level=2] [ref=e14]
            - button "History" [ref=e15] [cursor=pointer]
          - region "Today's calories and nutrition targets" [ref=e16]:
            - img "420 of 2300 calories logged" [ref=e17]:
              - generic [ref=e21]:
                - generic [ref=e22]: "420"
                - generic [ref=e23]: of 2,300 kcal
            - generic [ref=e24]:
              - paragraph [ref=e25]:
                - strong [ref=e26]: 1,880 kcal
                - text: remaining
              - generic [ref=e27]:
                - generic [ref=e28]:
                  - generic [ref=e29]: Protein
                  - generic [ref=e30]: 28 / 140 g
                - progressbar "Protein" [ref=e31]
              - generic [ref=e33]:
                - generic [ref=e34]:
                  - generic [ref=e35]: Carbs
                  - generic [ref=e36]: 54 / 240 g
                - progressbar "Carbs" [ref=e37]
              - generic [ref=e39]:
                - generic [ref=e40]:
                  - generic [ref=e41]: Fats
                  - generic [ref=e42]: 12 / 70 g
                - progressbar "Fats" [ref=e43]
          - region [ref=e45]:
            - generic [ref=e46]:
              - heading "Today's meals" [level=3] [ref=e47]
              - button "＋ Add" [ref=e48] [cursor=pointer]
            - paragraph [ref=e49]: Open a meal to see and edit each food.
            - generic [ref=e50]:
              - article [ref=e51]:
                - generic [ref=e52]:
                  - button "Breakfast Oats And Eggs 420 kcal · 1 food" [ref=e53] [cursor=pointer]:
                    - generic [ref=e57]:
                      - strong [ref=e58]: Breakfast
                      - generic [ref=e59]: Oats And Eggs
                      - generic [ref=e60]: 420 kcal · 1 food
                  - button "Add food to Breakfast" [ref=e64] [cursor=pointer]: Add
              - article [ref=e67]:
                - generic [ref=e68]:
                  - button "Lunch No foods logged yet Tap to view foods" [ref=e69] [cursor=pointer]:
                    - generic [ref=e75]:
                      - strong [ref=e76]: Lunch
                      - generic [ref=e77]: No foods logged yet
                      - generic [ref=e78]: Tap to view foods
                  - button "Add food to Lunch" [ref=e82] [cursor=pointer]: Add
              - article [ref=e85]:
                - generic [ref=e86]:
                  - button "Dinner No foods logged yet Tap to view foods" [ref=e87] [cursor=pointer]:
                    - generic [ref=e91]:
                      - strong [ref=e92]: Dinner
                      - generic [ref=e93]: No foods logged yet
                      - generic [ref=e94]: Tap to view foods
                  - button "Add food to Dinner" [ref=e98] [cursor=pointer]: Add
              - article [ref=e101]:
                - generic [ref=e102]:
                  - button "Snack No foods logged yet Tap to view foods" [ref=e103] [cursor=pointer]:
                    - generic [ref=e107]:
                      - strong [ref=e108]: Snack
                      - generic [ref=e109]: No foods logged yet
                      - generic [ref=e110]: Tap to view foods
                  - button "Add food to Snack" [ref=e114] [cursor=pointer]: Add
          - region [ref=e117]:
            - generic [ref=e118]:
              - generic [ref=e123]:
                - heading "Water intake" [level=3] [ref=e124]
                - paragraph [ref=e125]: Today · 3 more to reach 8
              - strong [ref=e126]: 5 / 8 glasses
            - progressbar "Water intake toward eight glasses" [ref=e127]
            - generic [ref=e129]:
              - button "Remove one glass of water" [ref=e130] [cursor=pointer]
              - generic [ref=e132]: Track by the glass
              - button "Add one glass of water" [ref=e133] [cursor=pointer]: Add glass
        - navigation "Main navigation" [ref=e136]:
          - button "Home" [ref=e137] [cursor=pointer]
          - button "Coach" [ref=e142] [cursor=pointer]
          - button "Scan food and nutrition" [ref=e148] [cursor=pointer]:
            - generic [ref=e152]: Scan
          - button "Quests" [ref=e153] [cursor=pointer]
          - button "Me, account and settings" [ref=e158] [cursor=pointer]:
            - generic [ref=e163]: Me
    - button "Open Phiq coach" [ref=e164] [cursor=pointer]
```

# Test source

```ts
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
  199 |   await page.getByRole('button', { name: '2 missions left, unread', exact: true }).click();
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
> 281 |   await page.getByRole('button', { name: 'Edit Breakfast: Oats and eggs' }).click();
      |                                                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  300 | });
  301 | 
```