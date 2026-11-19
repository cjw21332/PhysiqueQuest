# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-nutrition-harden.spec.mjs >> Expo food camera uses native bridge without browser media APIs and ignores stale or duplicate barcodes
- Location: tests\browser\auth-nutrition-harden.spec.mjs:249:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - main [ref=e4]:
      - generic [ref=e6]:
        - button "Upload a meal photo" [ref=e7]
        - dialog [ref=e8]:
          - generic [ref=e9]:
            - generic [ref=e10]:
              - paragraph [ref=e11]: FOOD DIARY
              - heading "Add a packaged food" [level=2] [ref=e12]
              - paragraph [ref=e13]: Scan the barcode or enter its digits to find nutrition details.
            - button "Close barcode dialog" [active] [ref=e14] [cursor=pointer]: ×
          - generic [ref=e15]:
            - generic [ref=e16]:
              - generic [ref=e17]: Barcode number
              - generic [ref=e18]:
                - textbox "Barcode number" [ref=e19]:
                  - /placeholder: e.g. 4006381333931
                - button "Look up" [ref=e20] [cursor=pointer]
              - paragraph [ref=e21]: Enter the numbers printed below the barcode.
            - generic [ref=e22]:
              - button "Scan with camera" [ref=e23] [cursor=pointer]
              - button "Enter nutrition manually" [ref=e24] [cursor=pointer]
        - generic [ref=e25]:
          - button "View sample nutrition" [ref=e26] [cursor=pointer]
          - generic [ref=e27]:
            - generic [ref=e28]:
              - heading "Nutrition" [level=1] [ref=e29]
              - button "Manual entry" [ref=e30] [cursor=pointer]:
                - generic [aria-hidden] [ref=e31]: ＋
                - text: Manual entry
            - region "Today's nutrition" [ref=e32]:
              - img "0 of 2300 calories logged" [ref=e33]:
                - generic [ref=e37]:
                  - generic [ref=e38]: "0"
                  - generic [ref=e39]: of 2,300 kcal
              - generic [ref=e40]:
                - paragraph [ref=e41]:
                  - strong [ref=e42]: 2,300 kcal
                  - text: remaining
                - generic [ref=e43]:
                  - generic [ref=e44]:
                    - generic [ref=e45]: Protein
                    - generic [ref=e46]: 0 / 140 g
                  - progressbar "Protein" [ref=e47]
                - generic [ref=e48]:
                  - generic [ref=e49]:
                    - generic [ref=e50]: Carbs
                    - generic [ref=e51]: 0 / 240 g
                  - progressbar "Carbs" [ref=e52]
                - generic [ref=e53]:
                  - generic [ref=e54]:
                    - generic [ref=e55]: Fats
                    - generic [ref=e56]: 0 / 70 g
                  - progressbar "Fats" [ref=e57]
            - button "Scan your meal Snap your plate — we'll estimate the macros" [ref=e58] [cursor=pointer]:
              - generic [ref=e63]:
                - strong [ref=e64]: Scan your meal
                - generic [ref=e65]: Snap your plate — we'll estimate the macros
            - region [ref=e68]:
              - generic [ref=e69]:
                - heading "Today's meals" [level=2] [ref=e70]
                - button "View log" [ref=e71] [cursor=pointer]
              - paragraph [ref=e72]: Open a meal to see and edit each food.
              - generic [ref=e73]:
                - article [ref=e74]:
                  - generic [ref=e75]:
                    - button "Breakfast No foods logged yet Tap to view foods" [ref=e76] [cursor=pointer]:
                      - generic [ref=e80]:
                        - strong [ref=e81]: Breakfast
                        - generic [ref=e82]: No foods logged yet
                        - generic [ref=e83]: Tap to view foods
                    - button "Add food to Breakfast" [ref=e87] [cursor=pointer]: Add
                - article [ref=e90]:
                  - generic [ref=e91]:
                    - button "Lunch No foods logged yet Tap to view foods" [ref=e92] [cursor=pointer]:
                      - generic [ref=e98]:
                        - strong [ref=e99]: Lunch
                        - generic [ref=e100]: No foods logged yet
                        - generic [ref=e101]: Tap to view foods
                    - button "Add food to Lunch" [ref=e105] [cursor=pointer]: Add
                - article [ref=e108]:
                  - generic [ref=e109]:
                    - button "Dinner No foods logged yet Tap to view foods" [ref=e110] [cursor=pointer]:
                      - generic [ref=e114]:
                        - strong [ref=e115]: Dinner
                        - generic [ref=e116]: No foods logged yet
                        - generic [ref=e117]: Tap to view foods
                    - button "Add food to Dinner" [ref=e121] [cursor=pointer]: Add
                - article [ref=e124]:
                  - generic [ref=e125]:
                    - button "Snack No foods logged yet Tap to view foods" [ref=e126] [cursor=pointer]:
                      - generic [ref=e130]:
                        - strong [ref=e131]: Snack
                        - generic [ref=e132]: No foods logged yet
                        - generic [ref=e133]: Tap to view foods
                    - button "Add food to Snack" [ref=e137] [cursor=pointer]: Add
            - region [ref=e140]:
              - generic [ref=e141]:
                - generic [ref=e146]:
                  - heading "Water intake" [level=3] [ref=e147]
                  - paragraph [ref=e148]: Today · 8 more to reach 8
                - strong [ref=e149]: 0 / 8 glasses
              - progressbar "Water intake toward eight glasses" [ref=e150]
              - generic [ref=e151]:
                - button "Remove one glass of water" [disabled] [ref=e152] [cursor=pointer]
                - generic [ref=e154]: Track by the glass
                - button "Add one glass of water" [ref=e155] [cursor=pointer]: Add glass
            - region [ref=e158]:
              - heading "More" [level=2] [ref=e159]
              - button "My dietary plan Manage targets and meal schedule" [ref=e160] [cursor=pointer]:
                - generic [ref=e164]:
                  - strong [ref=e165]: My dietary plan
                  - generic [ref=e166]: Manage targets and meal schedule
              - button "Log & water intake 0 of 8 glasses today" [ref=e169] [cursor=pointer]:
                - generic [ref=e174]:
                  - strong [ref=e175]: Log & water intake
                  - generic [ref=e176]: 0 of 8 glasses today
              - button "Food history Review your saved meals" [ref=e179] [cursor=pointer]:
                - generic [ref=e183]:
                  - strong [ref=e184]: Food history
                  - generic [ref=e185]: Review your saved meals
        - navigation "Main navigation" [ref=e188]:
          - button "Home" [ref=e189] [cursor=pointer]
          - button "Coach" [ref=e194] [cursor=pointer]
          - button "Scan food and nutrition" [ref=e200] [cursor=pointer]:
            - generic [ref=e204]: Scan
          - button "Quests" [ref=e205] [cursor=pointer]
          - button "Me, account and settings" [ref=e210] [cursor=pointer]:
            - generic [ref=e215]: Me
    - button "Open Phiq coach" [ref=e216] [cursor=pointer]
```

# Test source

```ts
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
  237 |   await page.getByLabel('Serving description').fill('One bowl');
  238 |   await page.getByLabel('Energy (kcal)',{exact:true}).fill('250');
  239 |   await page.getByLabel('Protein (g)',{exact:true}).fill('0');
  240 |   await page.getByLabel('Fiber (g)',{exact:true}).fill('4');
  241 |   await page.getByRole('button',{name:'Review label'}).click();
  242 |   await page.getByLabel(/Amount consumed/).fill('150');
  243 |   expect(state.writes).toBe(0);
  244 |   const [request]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/nutrition/meals')),page.getByRole('button',{name:'Save to Dinner'}).click()]);
  245 |   expect(request.postDataJSON()).toMatchObject({name:'Label test',source:'Manual',calories:375,protein:0,carbs:null,fiber:6,sodium:null});
  246 |   await expect(page.getByText(/Label Test/i).first()).toBeVisible();
  247 | });
  248 | 
  249 | test('Expo food camera uses native bridge without browser media APIs and ignores stale or duplicate barcodes', async ({page}) => {
  250 |   await emptyAccount(page);
  251 |   await page.addInitScript(() => {
  252 |     Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  253 |     window.foodMessages = [];
  254 |     window.ReactNativeWebView = { postMessage: value => window.foodMessages.push(JSON.parse(value)) };
  255 |   });
  256 |   let lookups = 0;
  257 |   await page.route('**/nutrition/foods/barcode/4006381333931*', r => {
  258 |     lookups++;
  259 |     return r.fulfill({ headers, json: { code:'4006381333931',name:'Native camera food',brand:'',basis:'g',serving:50,per100:{calories:250,protein:0,carbs:null,fat:8} } });
  260 |   });
  261 |   await page.goto('/scan');
  262 |   await page.getByRole('button', { name: /Scan your meal/i }).click();
  263 |   await page.getByRole('button', { name: 'Scan product barcode' }).click();
> 264 |   await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(0);
      |                                                                                                                        ^ Error: expect(received).toBeGreaterThan(expected)
  265 |   await page.evaluate(() => {
  266 |     const request = window.foodMessages.filter(m => m.type === 'food-camera-start').at(-1);
  267 |     const send = requestId => window.dispatchEvent(new CustomEvent('physiquequest-food-camera', {detail:{type:'barcode',requestId,code:'4006381333931',format:'ean_13'}}));
  268 |     send('stale'); send(request.requestId); send(request.requestId);
  269 |   });
  270 |   await expect(page.getByRole('heading', { name: 'Native camera food' })).toBeVisible();
  271 |   expect(lookups).toBe(1);
  272 |   expect(await page.evaluate(() => window.foodMessages.some(m => m.type === 'food-camera-stop'))).toBe(true);
  273 | });
  274 | 
  275 | test('Expo photo result opens confirmation and retake requests a new native camera', async ({page}) => {
  276 |   await emptyAccount(page);
  277 |   await page.addInitScript(() => {
  278 |     Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  279 |     window.foodMessages = [];
  280 |     window.ReactNativeWebView = { postMessage: value => window.foodMessages.push(JSON.parse(value)) };
  281 |   });
  282 |   await page.goto('/scan');
  283 |   await page.getByRole('button', { name: /Scan your meal/i }).click();
  284 |   await page.getByRole('button', { name: /Take.*photo|Open camera/i }).click();
  285 |   await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(0);
  286 |   const count = await page.evaluate(() => {
  287 |     const requests = window.foodMessages.filter(m => m.type === 'food-camera-start');
  288 |     const canvas = document.createElement('canvas'); canvas.width=8; canvas.height=8;
  289 |     window.dispatchEvent(new CustomEvent('physiquequest-food-camera', { detail:{type:'photo',requestId:requests.at(-1).requestId,base64:canvas.toDataURL('image/jpeg').split(',')[1]} }));
  290 |     return requests.length;
  291 |   });
  292 |   await expect(page.getByRole('button', {name:'Confirm and analyse'})).toBeVisible();
  293 |   await page.getByRole('button', {name:'Retake'}).click();
  294 |   await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(count);
  295 |   await page.evaluate(() => {
  296 |     const requestId = window.foodMessages.filter(m => m.type === 'food-camera-start').at(-1).requestId;
  297 |     window.dispatchEvent(new CustomEvent('physiquequest-food-camera', {detail:{type:'cancel',requestId}}));
  298 |   });
  299 |   await expect(page.getByRole('heading', {name:'Food Scanner'})).toHaveCount(0);
  300 | });
  301 | 
  302 | test('camera playback failure releases acquired tracks and keeps manual entry available', async ({page}) => {
  303 |   await emptyAccount(page);
  304 |   await page.addInitScript(() => {
  305 |     Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
  306 |       const canvas = document.createElement('canvas');
  307 |       const stream = canvas.captureStream();
  308 |       window.testBarcodeTrack = stream.getVideoTracks()[0];
  309 |       return stream;
  310 |     }});
  311 |     HTMLMediaElement.prototype.play = async () => { throw new Error('Playback unavailable'); };
  312 |   });
  313 |   await page.goto('/scan');
  314 |   await page.getByRole('button', { name: /Scan your meal/i }).click();
  315 |   await page.getByRole('button', { name: 'Scan product barcode' }).click();
  316 |   await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not open the camera');
  317 |   expect(await page.evaluate(() => window.testBarcodeTrack.readyState)).toBe('ended');
  318 |   await page.getByRole('button', { name: 'Enter barcode manually' }).click();
  319 |   await expect(page.getByRole('button', { name: 'Enter Nutrition Information Manually' })).toBeVisible();
  320 | });
  321 | 
  322 | test('fallback camera decodes a retail barcode and releases the camera for review', async ({page})=>{
  323 |   await emptyAccount(page);
  324 |   await page.addInitScript(()=>{
  325 |     Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true});
  326 |     Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
  327 |       const canvas=document.createElement('canvas');
  328 |       const rect=document.querySelector('.food-camera-viewport').getBoundingClientRect();
  329 |       canvas.width=Math.round(rect.width*3);canvas.height=Math.round(rect.height*3);
  330 |       const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  331 |       // EAN-13 4006381333931, rendered with standard left/right digit encodings.
  332 |       const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  333 |       const invert=s=>[...s].map(c=>c==='1'?'0':'1').join('');
  334 |       const left=[...'006381'].map((d,i)=>'LGLLGG'[i]==='L'?L[d]:[...invert(L[d])].reverse().join('')).join('');
  335 |       const bars='101'+left+'01010'+[...'333931'].map(d=>invert(L[d])).join('')+'101';
  336 |       const stripe=Math.floor(canvas.width*0.6/95), leftEdge=(canvas.width-95*stripe)/2;
  337 |       ctx.fillStyle='black';[...bars].forEach((v,i)=>{if(v==='1')ctx.fillRect(leftEdge+i*stripe,canvas.height*0.4,stripe,canvas.height*0.2);});
  338 |       const stream=canvas.captureStream(10);window.testBarcodeTrack=stream.getVideoTracks()[0];
  339 |       const timer=setInterval(()=>{ctx.fillRect(0,0,1,1);if(window.testBarcodeTrack.readyState==='ended')clearInterval(timer);},100);
  340 |       return stream;
  341 |     }});
  342 |   });
  343 |   await page.route('**/nutrition/foods/barcode/4006381333931*',r=>r.fulfill({headers,json:{code:'4006381333931',name:'Camera test food',brand:'',basis:'g',serving:50,per100:{calories:250,protein:0,carbs:null,fat:8}}}));
  344 |   await page.goto('/scan');await page.getByRole('button',{name:/Scan your meal/i}).click();await page.getByRole('button',{name:'Scan product barcode'}).click();
  345 |   await expect(page.getByRole('heading',{name:'Camera test food'})).toBeVisible({timeout:20000});
  346 |   expect(await page.evaluate(()=>window.testBarcodeTrack.readyState)).toBe('ended');
  347 | });
  348 | 
```