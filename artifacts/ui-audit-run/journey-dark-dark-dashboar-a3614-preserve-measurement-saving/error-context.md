# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey-dark.spec.mjs >> dark dashboard, goals and progress match reference layouts and preserve measurement saving
- Location: tests\browser\journey-dark.spec.mjs:147:1

# Error details

```
Error: Visible UI uses the documented dark palette

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 11

- Array []
+ Array [
+   "SMALL.workout-label: color=rgb(167, 243, 184)",
+   "SPAN.workout-duration: color=rgb(167, 243, 184)",
+   "svg.: color=rgb(167, 243, 184)",
+   "circle.: color=rgb(167, 243, 184)",
+   "path.: color=rgb(167, 243, 184)",
+   "SPAN.: color=rgb(209, 222, 213)",
+   "svg.: color=rgb(209, 222, 213)",
+   "path.: color=rgb(209, 222, 213)",
+   "BUTTON.link-text: color=rgb(167, 243, 184)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - main [ref=e4]:
      - generic [ref=e6]:
        - generic [ref=e8]:
          - generic [ref=e9]:
            - generic [ref=e12]:
              - generic [ref=e13]: Monday · Week 3
              - heading "Hi, Toji" [level=1] [ref=e14]
            - button "Notifications" [ref=e15] [cursor=pointer]:
              - generic [aria-hidden] [ref=e19]: "4"
          - region "Today's session" [ref=e20]:
            - generic [ref=e21]:
              - generic [ref=e22]: Today’s session
              - generic [ref=e23]: 45 min
            - heading "Upper Body — Push" [level=2] [ref=e27]
            - generic [ref=e28]:
              - generic [ref=e29]: 6 exercises
              - generic [ref=e32]: · Dumbbells
              - generic [ref=e33]: AI form tracking
            - button "Start workout" [ref=e37] [cursor=pointer]
            - button "View full plan" [ref=e40] [cursor=pointer]
          - region "Activity summary" [ref=e41]:
            - generic [ref=e42]:
              - generic [ref=e43]: "12"
              - generic [ref=e47]: day streak
            - generic [ref=e49]:
              - generic [ref=e50]: 1,840
              - generic [ref=e51]: points
            - generic [ref=e53]: Lv 7
          - generic [ref=e57]:
            - generic [ref=e58]:
              - heading "Daily missions · 0 of 3" [level=3] [ref=e59]
              - button "View all" [ref=e60] [cursor=pointer]
            - generic [ref=e61]:
              - generic [ref=e62]:
                - generic [ref=e63]:
                  - generic [ref=e64]: Complete one workout
                  - generic [ref=e65]: 0 / 1
                - progressbar "Complete one workout" [ref=e66]
              - generic [ref=e67]:
                - generic [ref=e68]:
                  - generic [ref=e69]: Log 3 meals
                  - generic [ref=e70]: 2 / 3
                - progressbar "Log 3 meals" [ref=e71]
              - generic [ref=e73]:
                - generic [ref=e74]:
                  - generic [ref=e75]: Drink 8 glasses of water
                  - generic [ref=e76]: 5 / 8
                - progressbar "Drink 8 glasses of water" [ref=e77]
          - generic [ref=e79]:
            - generic [ref=e80]:
              - heading "Nutrition today" [level=3] [ref=e81]
              - button "Scan meal" [ref=e82] [cursor=pointer]
            - generic [ref=e85]:
              - img "1400 of 2300 calories logged" [ref=e86]:
                - generic [ref=e90]:
                  - generic [ref=e91]: 1.4k
                  - generic [ref=e92]: of 2,300
              - generic [ref=e93]:
                - generic [ref=e94]:
                  - generic [ref=e95]:
                    - generic [ref=e96]: Protein
                    - generic [ref=e97]: 96 / 140 g
                  - progressbar "Protein intake" [ref=e98]
                - generic [ref=e100]:
                  - generic [ref=e101]:
                    - generic [ref=e102]: Carbs
                    - generic [ref=e103]: 180 / 240 g
                  - progressbar "Carbs intake" [ref=e104]
                - generic [ref=e106]:
                  - generic [ref=e107]:
                    - generic [ref=e108]: Fats
                    - generic [ref=e109]: 42 / 70 g
                  - progressbar "Fats intake" [ref=e110]
            - paragraph [ref=e112]:
              - text: Using default targets.
              - button "Set your dietary plan" [ref=e113] [cursor=pointer]
          - generic [ref=e114]:
            - heading "Your journey" [level=3] [ref=e115]
            - generic [ref=e116]:
              - button "Goals & milestones Build muscle · 74 kg target" [ref=e117] [cursor=pointer]:
                - generic [ref=e123]:
                  - generic [ref=e124]: Goals & milestones
                  - generic [ref=e125]: Build muscle · 74 kg target
              - button "Progress Review saved measurements" [ref=e128] [cursor=pointer]:
                - generic [ref=e133]:
                  - generic [ref=e134]: Progress
                  - generic [ref=e135]: Review saved measurements
        - navigation "Main navigation" [ref=e138]:
          - button "Home" [ref=e139] [cursor=pointer]
          - button "Coach" [ref=e144] [cursor=pointer]
          - button "Scan food and nutrition" [ref=e150] [cursor=pointer]:
            - generic [ref=e154]: Scan
          - button "Quests" [ref=e155] [cursor=pointer]
          - button "Me, account and settings" [ref=e160] [cursor=pointer]:
            - generic [ref=e165]: Me
    - button "Open Phiq coach" [ref=e166] [cursor=pointer]
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