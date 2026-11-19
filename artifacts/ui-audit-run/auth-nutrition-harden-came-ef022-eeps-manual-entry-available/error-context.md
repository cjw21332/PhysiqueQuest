# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-nutrition-harden.spec.mjs >> camera playback failure releases acquired tracks and keeps manual entry available
- Location: tests\browser\auth-nutrition-harden.spec.mjs:302:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog').getByRole('alert')
Expected substring: "Could not open the camera"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('dialog').getByRole('alert') with timeout 5000ms
  - waiting for getByRole('dialog').getByRole('alert')

```

```yaml
- alert
- main:
  - button "Upload a meal photo"
  - dialog "Add a packaged food":
    - paragraph: FOOD DIARY
    - heading "Add a packaged food" [level=2]
    - paragraph: Scan the barcode or enter its digits to find nutrition details.
    - button "Close barcode dialog": ×
    - text: Barcode number
    - textbox "Barcode number":
      - /placeholder: e.g. 4006381333931
    - button "Look up"
    - paragraph: Enter the numbers printed below the barcode.
    - button "Scan with camera"
    - button "Enter nutrition manually"
  - button "View sample nutrition"
  - heading "Nutrition" [level=1]
  - button "Manual entry"
  - region "Today's nutrition":
    - img "0 of 2300 calories logged": 0 of 2,300 kcal
    - paragraph:
      - strong: 2,300 kcal
      - text: remaining
    - text: Protein 0 / 140 g
    - progressbar "Protein"
    - text: Carbs 0 / 240 g
    - progressbar "Carbs"
    - text: Fats 0 / 70 g
    - progressbar "Fats"
  - button "Scan your meal Snap your plate — we'll estimate the macros":
    - strong: Scan your meal
    - text: Snap your plate — we'll estimate the macros
  - region "Today's meals":
    - heading "Today's meals" [level=2]
    - button "View log"
    - paragraph: Open a meal to see and edit each food.
    - article:
      - button "Breakfast No foods logged yet Tap to view foods":
        - strong: Breakfast
        - text: No foods logged yet Tap to view foods
      - button "Add food to Breakfast": Add
    - article:
      - button "Lunch No foods logged yet Tap to view foods":
        - strong: Lunch
        - text: No foods logged yet Tap to view foods
      - button "Add food to Lunch": Add
    - article:
      - button "Dinner No foods logged yet Tap to view foods":
        - strong: Dinner
        - text: No foods logged yet Tap to view foods
      - button "Add food to Dinner": Add
    - article:
      - button "Snack No foods logged yet Tap to view foods":
        - strong: Snack
        - text: No foods logged yet Tap to view foods
      - button "Add food to Snack": Add
  - region "Water intake":
    - heading "Water intake" [level=3]
    - paragraph: Today · 8 more to reach 8
    - strong: 0 / 8 glasses
    - progressbar "Water intake toward eight glasses"
    - button "Remove one glass of water" [disabled]
    - text: Track by the glass
    - button "Add one glass of water": Add glass
  - region "More":
    - heading "More" [level=2]
    - button "My dietary plan Manage targets and meal schedule":
      - strong: My dietary plan
      - text: Manage targets and meal schedule
    - button "Log & water intake 0 of 8 glasses today":
      - strong: Log & water intake
      - text: 0 of 8 glasses today
    - button "Food history Review your saved meals":
      - strong: Food history
      - text: Review your saved meals
  - navigation "Main navigation":
    - button "Home"
    - button "Coach"
    - button "Scan food and nutrition": Scan
    - button "Quests"
    - button "Me, account and settings": Me
- button "Open Phiq coach"
```

# Test source

```ts
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
  264 |   await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(0);
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
> 316 |   await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not open the camera');
      |                                                             ^ Error: expect(locator).toContainText(expected) failed
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