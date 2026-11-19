# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-nutrition-harden.spec.mjs >> first water persists and sample preview remains explicitly escapable
- Location: tests\browser\auth-nutrition-harden.spec.mjs:129:1

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Set water intake to 1 glass', exact: true })

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
            - img "0 of 2300 calories logged" [ref=e17]:
              - generic [ref=e21]:
                - generic [ref=e22]: "0"
                - generic [ref=e23]: of 2,300 kcal
            - generic [ref=e24]:
              - paragraph [ref=e25]:
                - strong [ref=e26]: 2,300 kcal
                - text: remaining
              - generic [ref=e27]:
                - generic [ref=e28]:
                  - generic [ref=e29]: Protein
                  - generic [ref=e30]: 0 / 140 g
                - progressbar "Protein" [ref=e31]
              - generic [ref=e32]:
                - generic [ref=e33]:
                  - generic [ref=e34]: Carbs
                  - generic [ref=e35]: 0 / 240 g
                - progressbar "Carbs" [ref=e36]
              - generic [ref=e37]:
                - generic [ref=e38]:
                  - generic [ref=e39]: Fats
                  - generic [ref=e40]: 0 / 70 g
                - progressbar "Fats" [ref=e41]
          - region [ref=e42]:
            - generic [ref=e43]:
              - heading "Today's meals" [level=3] [ref=e44]
              - button "＋ Add" [ref=e45] [cursor=pointer]
            - paragraph [ref=e46]: Open a meal to see and edit each food.
            - generic [ref=e47]:
              - article [ref=e48]:
                - generic [ref=e49]:
                  - button "Breakfast No foods logged yet Tap to view foods" [ref=e50] [cursor=pointer]:
                    - generic [ref=e54]:
                      - strong [ref=e55]: Breakfast
                      - generic [ref=e56]: No foods logged yet
                      - generic [ref=e57]: Tap to view foods
                  - button "Add food to Breakfast" [ref=e61] [cursor=pointer]: Add
              - article [ref=e64]:
                - generic [ref=e65]:
                  - button "Lunch No foods logged yet Tap to view foods" [ref=e66] [cursor=pointer]:
                    - generic [ref=e72]:
                      - strong [ref=e73]: Lunch
                      - generic [ref=e74]: No foods logged yet
                      - generic [ref=e75]: Tap to view foods
                  - button "Add food to Lunch" [ref=e79] [cursor=pointer]: Add
              - article [ref=e82]:
                - generic [ref=e83]:
                  - button "Dinner No foods logged yet Tap to view foods" [ref=e84] [cursor=pointer]:
                    - generic [ref=e88]:
                      - strong [ref=e89]: Dinner
                      - generic [ref=e90]: No foods logged yet
                      - generic [ref=e91]: Tap to view foods
                  - button "Add food to Dinner" [ref=e95] [cursor=pointer]: Add
              - article [ref=e98]:
                - generic [ref=e99]:
                  - button "Snack No foods logged yet Tap to view foods" [ref=e100] [cursor=pointer]:
                    - generic [ref=e104]:
                      - strong [ref=e105]: Snack
                      - generic [ref=e106]: No foods logged yet
                      - generic [ref=e107]: Tap to view foods
                  - button "Add food to Snack" [ref=e111] [cursor=pointer]: Add
          - region [ref=e114]:
            - generic [ref=e115]:
              - generic [ref=e120]:
                - heading "Water intake" [level=3] [ref=e121]
                - paragraph [ref=e122]: Today · 8 more to reach 8
              - strong [ref=e123]: 0 / 8 glasses
            - progressbar "Water intake toward eight glasses" [ref=e124]
            - generic [ref=e125]:
              - button "Remove one glass of water" [disabled] [ref=e126] [cursor=pointer]
              - generic [ref=e128]: Track by the glass
              - button "Add one glass of water" [ref=e129] [cursor=pointer]: Add glass
        - navigation "Main navigation" [ref=e132]:
          - button "Home" [ref=e133] [cursor=pointer]
          - button "Coach" [ref=e138] [cursor=pointer]
          - button "Scan food and nutrition" [ref=e144] [cursor=pointer]:
            - generic [ref=e148]: Scan
          - button "Quests" [ref=e149] [cursor=pointer]
          - button "Me, account and settings" [ref=e154] [cursor=pointer]:
            - generic [ref=e159]: Me
    - button "Open Phiq coach" [ref=e160] [cursor=pointer]
```

# Test source

```ts
  36  |   await opener.press('Enter');
  37  |   const dialog = page.getByRole('dialog', { name: 'Reset your password' });
  38  |   await expect(dialog).toBeVisible();
  39  |   for (let i = 0; i < 8; i++) {
  40  |     await page.keyboard.press('Tab');
  41  |     // Chromium can tab to browser chrome (activeElement becomes body), but not to the obscured form.
  42  |     expect(await dialog.evaluate(el => document.activeElement === document.body || el.contains(document.activeElement))).toBe(true);
  43  |   }
  44  |   await page.screenshot({ path: info.outputPath('recovery-390.png'), animations: 'disabled' });
  45  |   await page.keyboard.press('Escape');
  46  |   await expect(dialog).toHaveCount(0);
  47  |   await expect(opener).toBeFocused();
  48  | });
  49  | 
  50  | test('registration exposes draft policy documents without QA instructions', async ({ page }) => {
  51  |   await page.goto('/register');
  52  |   await expect(page.getByText('Tip: try juan@email.com to see the error state')).toHaveCount(0);
  53  |   for (const [name, path] of [['Terms', '/terms'], ['Privacy policy', '/privacy'], ['Camera-based health data processing', '/camera-consent']]) {
  54  |     const link = page.getByRole('link', { name: new RegExp(name, 'i') });
  55  |     await expect(link).toHaveAttribute('href', path);
  56  |     await expect(link).toHaveAttribute('target', '_blank');
  57  |     await expect(link).toHaveAttribute('rel', /noopener/);
  58  |   }
  59  |   for (const path of ['/terms', '/privacy', '/camera-consent']) {
  60  |     await page.goto(path);
  61  |     await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  62  |     await expect(page.getByText('Draft, pending team review', { exact: true })).toBeVisible();
  63  |   }
  64  | });
  65  | 
  66  | async function emptyAccount(page, { failMeal = false, failWater = false } = {}) {
  67  |   await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'harden-test', token: 'synthetic-test-token' })));
  68  |   let meals = [];
  69  |   let water = [];
  70  |   let writes = 0;
  71  |   await page.route('**/api/**', async route => {
  72  |     const request = route.request();
  73  |     const path = new URL(request.url()).pathname;
  74  |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  75  |     let json = {};
  76  |     if (/\/auth\/session\/(?:migrate|refresh)$/.test(path)) json={access_token:'synthetic-test-token',expires_in:3600,user:{id:'harden-test',name:'Student',email:'student@example.test',emailVerified:true}};
  77  |     if (path.endsWith('/auth/me')) json={role:'user'};
  78  |     if (path.endsWith('/profile')) json = { name: 'Student', email: 'student@example.test', goal: 'Build muscle', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min' };
  79  |     if (path.endsWith('/nutrition')) json = { meals, water };
  80  |     if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
  81  |     if (path.endsWith('/coach/plan')) json = { days: [] };
  82  |     if (path.endsWith('/nutrition/foods/search')) json = { candidates: [{ fdc_id: 123, description: 'Test banana', data_type: 'Foundation' }] };
  83  |     if (path.endsWith('/nutrition/foods/123')) json = { fdc_id: 123, description: 'Test banana', serving_size_g: 100, per_100g: { kcal: 90, protein_g: 1, carbs_g: 23, fat_g: 0.3 } };
  84  |     if (path.endsWith('/nutrition/meals') && request.method() === 'POST') {
  85  |       writes++;
  86  |       if (failMeal) return route.fulfill({ status: 503, headers, json: { message: 'Meal save unavailable. Try again.' } });
  87  |       const entry = { ...request.postDataJSON(), id: 'saved-meal' };
  88  |       meals.push(entry);
  89  |       json = entry;
  90  |     }
  91  |     if (path.endsWith('/nutrition/water') && request.method() === 'PUT') {
  92  |       writes++;
  93  |       if (failWater) return route.fulfill({ status: 503, headers, json: { message: 'Water save unavailable. Try again.' } });
  94  |       water = [request.postDataJSON()];
  95  |       json = water[0];
  96  |     }
  97  |     return route.fulfill({ headers, json });
  98  |   });
  99  |   return { get writes() { return writes; } };
  100 | }
  101 | 
  102 | test('empty account saves its first real manual meal and restores it after reload', async ({ page }, info) => {
  103 |   const state = await emptyAccount(page);
  104 |   await page.goto('/scan');
  105 |   await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  106 |   await expect(page.getByText('Sample preview · not your saved nutrition data')).toHaveCount(0);
  107 |   await page.getByRole('button', { name: 'Manual entry' }).click();
  108 |   await page.getByRole('textbox', { name: 'Search food' }).fill('banana');
  109 |   await page.getByRole('button', { name: /Test banana/i }).click();
  110 |   await page.getByRole('button', { name: 'Save to Dinner' }).click();
  111 |   await expect(page.getByRole('heading', { name: "Today's log" })).toBeVisible();
  112 |   await expect(page.getByRole('button', { name: /Edit Dinner: Test banana/i })).toBeVisible();
  113 |   expect(state.writes).toBe(1);
  114 |   await page.reload();
  115 |   await expect(page.getByText(/Test banana/i).first()).toBeVisible();
  116 |   await page.screenshot({ path: info.outputPath('first-meal-390.png'), animations: 'disabled' });
  117 | });
  118 | 
  119 | test('empty account saves first water and failed writes never become success', async ({ page }) => {
  120 |   const state = await emptyAccount(page, { failWater: true });
  121 |   await page.goto('/scan');
  122 |   await page.getByRole('button', { name: /Log & water intake/ }).click();
  123 |   await page.getByRole('button', { name: 'Set water intake to 1 glass', exact: true }).click();
  124 |   await expect(page.getByRole('alert').filter({ hasText: 'Water save unavailable' })).toBeVisible();
  125 |   await expect(page.getByText('0 / 8 glasses', { exact: true })).toBeVisible();
  126 |   expect(state.writes).toBe(1);
  127 | });
  128 | 
  129 | test('first water persists and sample preview remains explicitly escapable', async ({ page }) => {
  130 |   const state = await emptyAccount(page);
  131 |   await page.goto('/scan');
  132 |   await page.getByRole('button', { name: 'View sample nutrition' }).click();
  133 |   await expect(page.getByText('Sample preview · not your saved nutrition data')).toBeVisible();
  134 |   await page.getByRole('button', { name: 'Start my log' }).click();
  135 |   await page.getByRole('button', { name: /Log & water intake/ }).click();
> 136 |   await page.getByRole('button', { name: 'Set water intake to 1 glass', exact: true }).click();
      |                                                                                        ^ Error: locator.click: Test timeout of 15000ms exceeded.
  137 |   await expect(page.getByText('1 / 8 glasses', { exact: true })).toBeVisible();
  138 |   await page.reload();
  139 |   await expect(page.getByText('1 / 8 glasses', { exact: true })).toBeVisible();
  140 |   expect(state.writes).toBe(1);
  141 | });
  142 | 
  143 | test('failed-login dialog makes the form inert and Escape returns to sign in', async ({ page }) => {
  144 |   await page.route('**/api/auth/session/login', route => route.fulfill({ status: 401, headers, json: { message: 'Incorrect credentials' } }));
  145 |   await page.goto('/login');
  146 |   await page.getByRole('textbox', { name: 'Email address' }).fill('student@example.test');
  147 |   await page.getByLabel('Password', { exact: true }).fill('Testing123!');
  148 |   await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
  149 |   const dialog = page.getByRole('dialog', { name: 'Incorrect email or password' });
  150 |   await expect(dialog).toBeVisible();
  151 |   expect(await dialog.evaluate(el => el.matches(':modal'))).toBe(true);
  152 |   await page.locator('.auth-screen input[type="email"]').focus();
  153 |   expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  154 |   await page.keyboard.press('Escape');
  155 |   await expect(dialog).toHaveCount(0);
  156 |   await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('student@example.test');
  157 | });
  158 | 
  159 | test('recovery preserves request errors and advances OTP stages with focus', async ({ page }) => {
  160 |   let requests = 0;
  161 |   await page.route('**/api/auth/password-reset/**', async route => {
  162 |     if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  163 |     const path = new URL(route.request().url()).pathname;
  164 |     if (path.endsWith('/request')) {
  165 |       requests++;
  166 |       return route.fulfill(requests === 1
  167 |         ? { status: 503, headers, json: { message: 'Email service unavailable. Try again.' } }
  168 |         : { headers, json: { requestId: 'synthetic-request', delivery: 'sent' } });
  169 |     }
  170 |     if (path.endsWith('/verify')) return route.fulfill({ headers, json: { resetToken: 'synthetic-reset' } });
  171 |     return route.fulfill({ headers, json: {} });
  172 |   });
  173 |   await page.goto('/login');
  174 |   await page.getByRole('button', { name: 'Forgot Password?' }).click();
  175 |   let dialog = page.getByRole('dialog', { name: 'Reset your password' });
  176 |   await dialog.getByRole('textbox', { name: 'Email address' }).fill('student@example.test');
  177 |   await dialog.getByRole('button', { name: 'Send OTP Verification' }).click();
  178 |   await expect(dialog.getByRole('alert')).toContainText('Email service unavailable');
  179 |   await expect(dialog.getByRole('textbox', { name: 'Email address' })).toHaveValue('student@example.test');
  180 |   await dialog.getByRole('button', { name: 'Send OTP Verification' }).click();
  181 |   dialog = page.getByRole('dialog', { name: 'Verification code', exact: true });
  182 |   await expect(dialog.getByRole('textbox', { name: 'Digit 1 of 6' })).toBeFocused();
  183 |   await dialog.getByRole('textbox', { name: 'Digit 1 of 6' }).fill('123456');
  184 |   await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  185 |   dialog = page.getByRole('dialog', { name: 'Set new password' });
  186 |   await expect(dialog.getByLabel('New Password', { exact: true })).toBeFocused();
  187 |   await page.keyboard.press('Escape');
  188 |   await expect(dialog).toHaveCount(0);
  189 | });
  190 | 
  191 | test('failed first meal keeps selected food and portion for retry', async ({ page }) => {
  192 |   await emptyAccount(page, { failMeal: true });
  193 |   await page.goto('/scan');
  194 |   await page.getByRole('button', { name: 'Manual entry' }).click();
  195 |   await page.getByRole('textbox', { name: 'Search food' }).fill('banana');
  196 |   await page.getByRole('button', { name: /Test banana/i }).click();
  197 |   await page.getByRole('spinbutton', { name: 'Quantity' }).fill('200');
  198 |   await page.getByRole('button', { name: 'Save to Dinner' }).click();
  199 |   await expect(page.getByRole('heading', { name: 'Add food', exact: true })).toBeVisible();
  200 |   await expect(page.getByRole('alert').filter({ hasText: 'Meal save unavailable' }).first()).toBeVisible();
  201 |   await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('200');
  202 |   await expect(page.getByRole('button', { name: 'Save to Dinner' })).toBeEnabled();
  203 | });
  204 | 
  205 | test('auth and recovery fit narrow, short, tablet and desktop viewports', async ({ page }, info) => {
  206 |   for (const [width, height] of [[320, 480], [390, 844], [768, 1024], [1440, 900]]) {
  207 |     await page.setViewportSize({ width, height });
  208 |     await page.goto('/register');
  209 |     const submit = page.getByRole('button', { name: 'Create account', exact: true });
  210 |     await expect(submit).toBeVisible();
  211 |     const box = await submit.boundingBox();
  212 |     expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  213 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  214 |     await page.screenshot({ path: info.outputPath(`register-${width}.png`), animations: 'disabled' });
  215 |     await page.goto('/login');
  216 |     await page.getByRole('button', { name: 'Forgot Password?' }).click();
  217 |     const dialog = page.getByRole('dialog', { name: 'Reset your password' });
  218 |     const panel = dialog.locator('.forgot-password-modal');
  219 |     await expect(panel).toBeVisible();
  220 |     const bounds = await panel.boundingBox();
  221 |     expect(bounds.x).toBeGreaterThanOrEqual(0);
  222 |     expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  223 |     expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
  224 |     await page.screenshot({ path: info.outputPath(`recovery-${width}.png`), animations: 'disabled' });
  225 |     await page.keyboard.press('Escape');
  226 |   }
  227 | });
  228 | 
  229 | test('barcode manual nutrition label scales known values and saves after review', async ({page}) => {
  230 |   const state=await emptyAccount(page);
  231 |   await page.goto('/scan');
  232 |   await page.getByRole('button',{name:/Scan your meal/i}).click();
  233 |   await page.getByRole('button',{name:'Scan product barcode'}).click();
  234 |   await page.getByRole('button',{name:'Enter barcode manually'}).click();
  235 |   await page.getByRole('button',{name:'Enter Nutrition Information Manually'}).click();
  236 |   await page.getByLabel('Product name').fill('Label test');
```