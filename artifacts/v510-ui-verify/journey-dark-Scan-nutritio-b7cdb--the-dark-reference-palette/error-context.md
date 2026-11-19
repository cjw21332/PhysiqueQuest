# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey-dark.spec.mjs >> Scan nutrition, estimate, and log use the dark reference palette
- Location: tests\browser\journey-dark.spec.mjs:208:1

# Error details

```
Error: Visible UI uses the documented dark palette

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 14

- Array []
+ Array [
+   "SPAN.water-tracker-icon: backgroundColor=rgba(81, 173, 221, 0.15)",
+   "svg.: color=rgb(84, 181, 233)",
+   "path.: color=rgb(84, 181, 233)",
+   "SPAN.: backgroundColor=rgb(84, 181, 233)",
+   "BUTTON.: backgroundColor=rgb(84, 181, 233)",
+   "BUTTON.: color=rgb(11, 31, 45)",
+   "BUTTON.: borderTopColor=rgb(84, 181, 233)",
+   "BUTTON.: borderRightColor=rgb(84, 181, 233)",
+   "BUTTON.: borderBottomColor=rgb(84, 181, 233)",
+   "BUTTON.: borderLeftColor=rgb(84, 181, 233)",
+   "svg.: color=rgb(11, 31, 45)",
+   "path.: color=rgb(11, 31, 45)",
+ ]
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
          - paragraph [ref=e9]:
            - text: Sample preview · not your saved nutrition data
            - button "Start my log" [ref=e10] [cursor=pointer]
          - generic [ref=e11]:
            - generic [ref=e12]:
              - heading "Nutrition" [level=1] [ref=e13]
              - button "Manual entry" [ref=e14] [cursor=pointer]:
                - generic [aria-hidden] [ref=e15]: ＋
                - text: Manual entry
            - region "Today's nutrition" [ref=e16]:
              - img "1420 of 2300 calories logged" [ref=e17]:
                - generic [ref=e21]:
                  - generic [ref=e22]: 1,420
                  - generic [ref=e23]: of 2,300 kcal
              - generic [ref=e24]:
                - paragraph [ref=e25]:
                  - strong [ref=e26]: 880 kcal
                  - text: remaining
                - generic [ref=e27]:
                  - generic [ref=e28]:
                    - generic [ref=e29]: Protein
                    - generic [ref=e30]: 96 / 140 g
                  - progressbar "Protein" [ref=e31]
                - generic [ref=e33]:
                  - generic [ref=e34]:
                    - generic [ref=e35]: Carbs
                    - generic [ref=e36]: 180 / 240 g
                  - progressbar "Carbs" [ref=e37]
                - generic [ref=e39]:
                  - generic [ref=e40]:
                    - generic [ref=e41]: Fats
                    - generic [ref=e42]: 42 / 70 g
                  - progressbar "Fats" [ref=e43]
            - button "Scan your meal Snap your plate — we'll estimate the macros" [ref=e45] [cursor=pointer]:
              - generic [ref=e50]:
                - strong [ref=e51]: Scan your meal
                - generic [ref=e52]: Snap your plate — we'll estimate the macros
            - region [ref=e55]:
              - generic [ref=e56]:
                - heading "Today's meals" [level=2] [ref=e57]
                - button "View log" [ref=e58] [cursor=pointer]
              - paragraph [ref=e59]: Open a meal to see and edit each food.
              - generic [ref=e60]:
                - article [ref=e61]:
                  - generic [ref=e62]:
                    - button "Breakfast Oats And Eggs 420 kcal · 1 food" [ref=e63] [cursor=pointer]:
                      - generic [ref=e67]:
                        - strong [ref=e68]: Breakfast
                        - generic [ref=e69]: Oats And Eggs
                        - generic [ref=e70]: 420 kcal · 1 food
                    - button "Add food to Breakfast" [ref=e74] [cursor=pointer]: Add
                - article [ref=e77]:
                  - generic [ref=e78]:
                    - button "Lunch Chicken Rice Bowl 680 kcal · 1 food" [ref=e79] [cursor=pointer]:
                      - generic [ref=e85]:
                        - strong [ref=e86]: Lunch
                        - generic [ref=e87]: Chicken Rice Bowl
                        - generic [ref=e88]: 680 kcal · 1 food
                    - button "Add food to Lunch" [ref=e92] [cursor=pointer]: Add
                - article [ref=e95]:
                  - generic [ref=e96]:
                    - button "Dinner No foods logged yet Tap to view foods" [ref=e97] [cursor=pointer]:
                      - generic [ref=e101]:
                        - strong [ref=e102]: Dinner
                        - generic [ref=e103]: No foods logged yet
                        - generic [ref=e104]: Tap to view foods
                    - button "Add food to Dinner" [ref=e108] [cursor=pointer]: Add
                - article [ref=e111]:
                  - generic [ref=e112]:
                    - button "Snack Protein Shake 320 kcal · 1 food" [ref=e113] [cursor=pointer]:
                      - generic [ref=e117]:
                        - strong [ref=e118]: Snack
                        - generic [ref=e119]: Protein Shake
                        - generic [ref=e120]: 320 kcal · 1 food
                    - button "Add food to Snack" [ref=e124] [cursor=pointer]: Add
            - region [ref=e127]:
              - generic [ref=e128]:
                - generic [ref=e133]:
                  - heading "Water intake" [level=3] [ref=e134]
                  - paragraph [ref=e135]: Today · 3 more to reach 8
                - strong [ref=e136]: 5 / 8 glasses
              - progressbar "Water intake toward eight glasses" [ref=e137]
              - generic [ref=e139]:
                - button "Remove one glass of water" [ref=e140] [cursor=pointer]
                - generic [ref=e142]: Track by the glass
                - button "Add one glass of water" [ref=e143] [cursor=pointer]: Add glass
            - region [ref=e146]:
              - heading "More" [level=2] [ref=e147]
              - button "My dietary plan Manage targets and meal schedule" [ref=e148] [cursor=pointer]:
                - generic [ref=e152]:
                  - strong [ref=e153]: My dietary plan
                  - generic [ref=e154]: Manage targets and meal schedule
              - button "Log & water intake 5 of 8 glasses today" [ref=e157] [cursor=pointer]:
                - generic [ref=e162]:
                  - strong [ref=e163]: Log & water intake
                  - generic [ref=e164]: 5 of 8 glasses today
              - button "Food history 7-day average 1,947 kcal" [ref=e167] [cursor=pointer]:
                - generic [ref=e171]:
                  - strong [ref=e172]: Food history
                  - generic [ref=e173]: 7-day average 1,947 kcal
        - navigation "Main navigation" [ref=e176]:
          - button "Home" [ref=e177] [cursor=pointer]
          - button "Coach" [ref=e182] [cursor=pointer]
          - button "Scan food and nutrition" [ref=e188] [cursor=pointer]:
            - generic [ref=e192]: Scan
          - button "Quests" [ref=e193] [cursor=pointer]
          - button "Me, account and settings" [ref=e198] [cursor=pointer]:
            - generic [ref=e203]: Me
    - button "Open Phiq coach" [ref=e204] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect } from '@playwright/test';
  2  | 
  3  | export async function expectDarkPalette(page) {
  4  |   await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  5  |   const unexpected = await page.evaluate(() => {
  6  |     const allowed = new Set(['11,15,21', '22,29,39', '33,43,59', '39,52,68', '34,197,94', '74,222,128', '248,113,113', '248,250,252', '148,163,184', '100,116,139', '20,59,38', '72,9,9', '0,0,0']);
  7  |     const issues = [];
  8  |     for (const el of document.querySelectorAll('body *')) {
  9  |       if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || el.closest('nextjs-portal, .google-auth-mark')) continue;
  10 |       const rect = el.getBoundingClientRect();
  11 |       if (!rect.width || !rect.height) continue;
  12 |       const style = getComputedStyle(el);
  13 |       const properties = ['backgroundColor'];
  14 |       if (el instanceof SVGElement || [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) properties.push('color');
  15 |       for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
  16 |         if (parseFloat(style[`border${side}Width`]) > 0 && !['none', 'hidden'].includes(style[`border${side}Style`])) properties.push(`border${side}Color`);
  17 |       }
  18 |       for (const prop of properties) {
  19 |         const channels = style[prop].match(/[\d.]+/g)?.map(Number);
  20 |         if (!channels || channels.length === 4 && channels[3] === 0) continue;
  21 |         if (!allowed.has(channels.slice(0, 3).join(','))) issues.push(`${el.tagName}.${el.classList.value}: ${prop}=${style[prop]}`);
  22 |       }
  23 |     }
  24 |     return [...new Set(issues)].slice(0, 35);
  25 |   });
> 26 |   expect(unexpected, 'Visible UI uses the documented dark palette').toEqual([]);
     |                                                                     ^ Error: Visible UI uses the documented dark palette
  27 | }
  28 | 
  29 | export async function expectReferenceLayout(page, selectors) {
  30 |   await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  31 |   const boxes = await page.evaluate(selectors => selectors.map(selector => {
  32 |     const element = document.querySelector(selector);
  33 |     if (!element) throw new Error(`Missing layout element: ${selector}`);
  34 |     const rect = element.getBoundingClientRect();
  35 |     const style = getComputedStyle(element);
  36 |     return { selector, width: rect.width, height: rect.height, font: style.fontFamily, viewport: innerWidth };
  37 |   }), selectors);
  38 |   for (const box of boxes) {
  39 |     expect(box.width, box.selector).toBeGreaterThan(0);
  40 |     expect(box.height, box.selector).toBeGreaterThan(0);
  41 |     expect(box.width, box.selector).toBeLessThanOrEqual(box.viewport + 1);
  42 |     expect(box.font, box.selector).toContain('Inter');
  43 |   }
  44 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  45 | }
  46 | 
  47 | export async function expectHomeBack(page) {
  48 |   const back = page.getByRole('button', { name: 'Back to Home', exact: true });
  49 |   await back.scrollIntoViewIfNeeded();
  50 |   await expect(back).toBeVisible();
  51 |   const button = await back.boundingBox();
  52 |   const heading = await page.locator('.section-back-title h2').boundingBox();
  53 |   expect(button.x + button.width).toBeLessThanOrEqual(heading.x);
  54 |   expect(button.width).toBeGreaterThanOrEqual(44);
  55 | }
  56 | 
```