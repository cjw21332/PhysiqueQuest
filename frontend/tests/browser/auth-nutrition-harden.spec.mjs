import { test, expect } from '@playwright/test';

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

test('login submits with Enter, preserves failed inputs and prevents duplicate requests', async ({ page }) => {
  let attempts = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/login', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    attempts++;
    await pending;
    return route.fulfill({ status: 503, headers, json: { message: 'Sign-in is temporarily unavailable. Try again.' } });
  });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Testing123!');
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
  await page.getByLabel('Password', { exact: true }).press('Enter');
  release();
  await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('student@example.test');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('Testing123!');
  expect(attempts).toBe(1);
});

test('recovery is keyboard reachable, contains focus and restores its opener', async ({ page }, info) => {
  await page.goto('/login');
  const opener = page.getByRole('button', { name: 'Forgot Password?' });
  await opener.focus();
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Reset your password' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    // Chromium can tab to browser chrome (activeElement becomes body), but not to the obscured form.
    expect(await dialog.evaluate(el => document.activeElement === document.body || el.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('recovery-390.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('registration exposes draft policy documents without QA instructions', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByText('Tip: try juan@email.com to see the error state')).toHaveCount(0);
  for (const [name, path] of [['Terms', '/terms'], ['Privacy policy', '/privacy'], ['Camera-based health data processing', '/camera-consent']]) {
    const link = page.getByRole('link', { name: new RegExp(name, 'i') });
    await expect(link).toHaveAttribute('href', path);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  for (const path of ['/terms', '/privacy', '/camera-consent']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Draft, pending team review', { exact: true })).toBeVisible();
  }
});

async function emptyAccount(page, { failMeal = false, failWater = false } = {}) {
  await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'harden-test', token: 'synthetic-test-token' })));
  let meals = [];
  let water = [];
  let writes = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (/\/auth\/session\/(?:migrate|refresh)$/.test(path)) json={access_token:'synthetic-test-token',expires_in:3600,user:{id:'harden-test',name:'Student',email:'student@example.test',emailVerified:true}};
    if (path.endsWith('/auth/me')) json={role:'user'};
    if (path.endsWith('/profile')) json = { name: 'Student', email: 'student@example.test', goal: 'Build muscle', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min' };
    if (path.endsWith('/nutrition')) json = { meals, water };
    if (path.endsWith('/activity/state')) json = { state: {}, dailyMissions: [] };
    if (path.endsWith('/coach/plan')) json = { days: [] };
    if (path.endsWith('/nutrition/foods/search')) json = { candidates: [{ fdc_id: 123, description: 'Test banana', data_type: 'Foundation' }] };
    if (path.endsWith('/nutrition/foods/123')) json = { fdc_id: 123, description: 'Test banana', serving_size_g: 100, per_100g: { kcal: 90, protein_g: 1, carbs_g: 23, fat_g: 0.3 } };
    if (path.endsWith('/nutrition/meals') && request.method() === 'POST') {
      writes++;
      if (failMeal) return route.fulfill({ status: 503, headers, json: { message: 'Meal save unavailable. Try again.' } });
      const entry = { ...request.postDataJSON(), id: 'saved-meal' };
      meals.push(entry);
      json = entry;
    }
    if (path.endsWith('/nutrition/water') && request.method() === 'PUT') {
      writes++;
      if (failWater) return route.fulfill({ status: 503, headers, json: { message: 'Water save unavailable. Try again.' } });
      water = [request.postDataJSON()];
      json = water[0];
    }
    return route.fulfill({ headers, json });
  });
  return { get writes() { return writes; } };
}

test('empty account saves its first real manual meal and restores it after reload', async ({ page }, info) => {
  const state = await emptyAccount(page);
  await page.goto('/scan');
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  await expect(page.getByText('Sample preview · not your saved nutrition data')).toHaveCount(0);
  await page.getByRole('button', { name: 'Manual entry' }).click();
  await page.getByRole('textbox', { name: 'Search food' }).fill('banana');
  await page.getByRole('button', { name: /Test banana/ }).click();
  await page.getByRole('button', { name: 'Save to Dinner' }).click();
  await expect(page.getByRole('heading', { name: "Today's log" })).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit Dinner: Test banana/ })).toBeVisible();
  expect(state.writes).toBe(1);
  await page.reload();
  await expect(page.getByText('Test banana', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('first-meal-390.png'), animations: 'disabled' });
});

test('empty account saves first water and failed writes never become success', async ({ page }) => {
  const state = await emptyAccount(page, { failWater: true });
  await page.goto('/scan');
  await page.getByRole('button', { name: /Log & water intake/ }).click();
  await page.getByRole('button', { name: 'Set water intake to 1 glass', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Water save unavailable' })).toBeVisible();
  await expect(page.getByText('0 / 8 glasses', { exact: true })).toBeVisible();
  expect(state.writes).toBe(1);
});

test('first water persists and sample preview remains explicitly escapable', async ({ page }) => {
  const state = await emptyAccount(page);
  await page.goto('/scan');
  await page.getByRole('button', { name: 'View sample nutrition' }).click();
  await expect(page.getByText('Sample preview · not your saved nutrition data')).toBeVisible();
  await page.getByRole('button', { name: 'Start my log' }).click();
  await page.getByRole('button', { name: /Log & water intake/ }).click();
  await page.getByRole('button', { name: 'Set water intake to 1 glass', exact: true }).click();
  await expect(page.getByText('1 / 8 glasses', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 of 8 glasses today')).toBeVisible();
  expect(state.writes).toBe(1);
});

test('failed-login dialog makes the form inert and Escape returns to sign in', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, headers, json: { message: 'Incorrect credentials' } }));
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Testing123!');
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Incorrect email or password' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.matches(':modal'))).toBe(true);
  await page.locator('.auth-screen input[type="email"]').focus();
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue('student@example.test');
});

test('recovery preserves request errors and advances OTP stages with focus', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/password-reset/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/request')) {
      requests++;
      return route.fulfill(requests === 1
        ? { status: 503, headers, json: { message: 'Email service unavailable. Try again.' } }
        : { headers, json: { requestId: 'synthetic-request', delivery: 'sent' } });
    }
    if (path.endsWith('/verify')) return route.fulfill({ headers, json: { resetToken: 'synthetic-reset' } });
    return route.fulfill({ headers, json: {} });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot Password?' }).click();
  let dialog = page.getByRole('dialog', { name: 'Reset your password' });
  await dialog.getByRole('textbox', { name: 'Email address' }).fill('student@example.test');
  await dialog.getByRole('button', { name: 'Send OTP Verification' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Email service unavailable');
  await expect(dialog.getByRole('textbox', { name: 'Email address' })).toHaveValue('student@example.test');
  await dialog.getByRole('button', { name: 'Send OTP Verification' }).click();
  dialog = page.getByRole('dialog', { name: 'Verification code', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Digit 1 of 6' })).toBeFocused();
  await dialog.getByRole('textbox', { name: 'Digit 1 of 6' }).fill('123456');
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Set new password' });
  await expect(dialog.getByLabel('New Password', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('failed first meal keeps selected food and portion for retry', async ({ page }) => {
  await emptyAccount(page, { failMeal: true });
  await page.goto('/scan');
  await page.getByRole('button', { name: 'Manual entry' }).click();
  await page.getByRole('textbox', { name: 'Search food' }).fill('banana');
  await page.getByRole('button', { name: /Test banana/ }).click();
  await page.getByRole('spinbutton', { name: 'Quantity' }).fill('200');
  await page.getByRole('button', { name: 'Save to Dinner' }).click();
  await expect(page.getByRole('heading', { name: 'Add food', exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Meal save unavailable' }).first()).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('200');
  await expect(page.getByRole('button', { name: 'Save to Dinner' })).toBeEnabled();
});

test('auth and recovery fit narrow, short, tablet and desktop viewports', async ({ page }, info) => {
  for (const [width, height] of [[320, 480], [390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/register');
    const submit = page.getByRole('button', { name: 'Create account', exact: true });
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`register-${width}.png`), animations: 'disabled' });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot Password?' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset your password' });
    const panel = dialog.locator('.forgot-password-modal');
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    await page.screenshot({ path: info.outputPath(`recovery-${width}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
  }
});

test('barcode manual nutrition label scales known values and saves after review', async ({page}) => {
  const state=await emptyAccount(page);
  await page.goto('/scan');
  await page.getByRole('button',{name:/Scan your meal/i}).click();
  await page.getByRole('button',{name:'Scan product barcode'}).click();
  await page.getByRole('button',{name:'Enter barcode manually'}).click();
  await page.getByRole('button',{name:'Enter Nutrition Information Manually'}).click();
  await page.getByLabel('Product name').fill('Label test');
  await page.getByLabel('Serving description').fill('One bowl');
  await page.getByLabel('Energy (kcal)',{exact:true}).fill('250');
  await page.getByLabel('Protein (g)',{exact:true}).fill('0');
  await page.getByLabel('Fiber (g)',{exact:true}).fill('4');
  await page.getByRole('button',{name:'Review label'}).click();
  await page.getByLabel(/Amount consumed/).fill('150');
  expect(state.writes).toBe(0);
  const [request]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/nutrition/meals')),page.getByRole('button',{name:'Save to Dinner'}).click()]);
  expect(request.postDataJSON()).toMatchObject({name:'Label test',source:'Manual',calories:375,protein:0,carbs:null,fiber:6,sodium:null});
  await expect(page.getByText(/Label Test/i).first()).toBeVisible();
});

test('Expo food camera uses native bridge without browser media APIs and ignores stale or duplicate barcodes', async ({page}) => {
  await emptyAccount(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    window.foodMessages = [];
    window.ReactNativeWebView = { postMessage: value => window.foodMessages.push(JSON.parse(value)) };
  });
  let lookups = 0;
  await page.route('**/nutrition/foods/barcode/4006381333931*', r => {
    lookups++;
    return r.fulfill({ headers, json: { code:'4006381333931',name:'Native camera food',brand:'',basis:'g',serving:50,per100:{calories:250,protein:0,carbs:null,fat:8} } });
  });
  await page.goto('/scan');
  await page.getByRole('button', { name: /Scan your meal/i }).click();
  await page.getByRole('button', { name: 'Scan product barcode' }).click();
  await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const request = window.foodMessages.filter(m => m.type === 'food-camera-start').at(-1);
    const send = requestId => window.dispatchEvent(new CustomEvent('physiquequest-food-camera', {detail:{type:'barcode',requestId,code:'4006381333931',format:'ean_13'}}));
    send('stale'); send(request.requestId); send(request.requestId);
  });
  await expect(page.getByRole('heading', { name: 'Native camera food' })).toBeVisible();
  expect(lookups).toBe(1);
  expect(await page.evaluate(() => window.foodMessages.some(m => m.type === 'food-camera-stop'))).toBe(true);
});

test('Expo photo result opens confirmation and retake requests a new native camera', async ({page}) => {
  await emptyAccount(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    window.foodMessages = [];
    window.ReactNativeWebView = { postMessage: value => window.foodMessages.push(JSON.parse(value)) };
  });
  await page.goto('/scan');
  await page.getByRole('button', { name: /Scan your meal/i }).click();
  await page.getByRole('button', { name: /Take.*photo|Open camera/i }).click();
  await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(0);
  const count = await page.evaluate(() => {
    const requests = window.foodMessages.filter(m => m.type === 'food-camera-start');
    const canvas = document.createElement('canvas'); canvas.width=8; canvas.height=8;
    window.dispatchEvent(new CustomEvent('physiquequest-food-camera', { detail:{type:'photo',requestId:requests.at(-1).requestId,base64:canvas.toDataURL('image/jpeg').split(',')[1]} }));
    return requests.length;
  });
  await expect(page.getByRole('button', {name:'Confirm and analyse'})).toBeVisible();
  await page.getByRole('button', {name:'Retake'}).click();
  await expect.poll(() => page.evaluate(() => window.foodMessages.filter(m => m.type === 'food-camera-start').length)).toBeGreaterThan(count);
  await page.evaluate(() => {
    const requestId = window.foodMessages.filter(m => m.type === 'food-camera-start').at(-1).requestId;
    window.dispatchEvent(new CustomEvent('physiquequest-food-camera', {detail:{type:'cancel',requestId}}));
  });
  await expect(page.getByRole('heading', {name:'Food Scanner'})).toHaveCount(0);
});

test('camera playback failure releases acquired tracks and keeps manual entry available', async ({page}) => {
  await emptyAccount(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const canvas = document.createElement('canvas');
      const stream = canvas.captureStream();
      window.testBarcodeTrack = stream.getVideoTracks()[0];
      return stream;
    }});
    HTMLMediaElement.prototype.play = async () => { throw new Error('Playback unavailable'); };
  });
  await page.goto('/scan');
  await page.getByRole('button', { name: /Scan your meal/i }).click();
  await page.getByRole('button', { name: 'Scan product barcode' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not open the camera');
  expect(await page.evaluate(() => window.testBarcodeTrack.readyState)).toBe('ended');
  await page.getByRole('button', { name: 'Enter barcode manually' }).click();
  await expect(page.getByRole('button', { name: 'Enter Nutrition Information Manually' })).toBeVisible();
});

test('fallback camera decodes a retail barcode and releases the camera for review', async ({page})=>{
  await emptyAccount(page);
  await page.addInitScript(()=>{
    Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      const canvas=document.createElement('canvas');
      const rect=document.querySelector('.food-camera-viewport').getBoundingClientRect();
      canvas.width=Math.round(rect.width*3);canvas.height=Math.round(rect.height*3);
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
      // EAN-13 4006381333931, rendered with standard left/right digit encodings.
      const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
      const invert=s=>[...s].map(c=>c==='1'?'0':'1').join('');
      const left=[...'006381'].map((d,i)=>'LGLLGG'[i]==='L'?L[d]:[...invert(L[d])].reverse().join('')).join('');
      const bars='101'+left+'01010'+[...'333931'].map(d=>invert(L[d])).join('')+'101';
      const stripe=Math.floor(canvas.width*0.6/95), leftEdge=(canvas.width-95*stripe)/2;
      ctx.fillStyle='black';[...bars].forEach((v,i)=>{if(v==='1')ctx.fillRect(leftEdge+i*stripe,canvas.height*0.4,stripe,canvas.height*0.2);});
      const stream=canvas.captureStream(10);window.testBarcodeTrack=stream.getVideoTracks()[0];
      const timer=setInterval(()=>{ctx.fillRect(0,0,1,1);if(window.testBarcodeTrack.readyState==='ended')clearInterval(timer);},100);
      return stream;
    }});
  });
  await page.route('**/nutrition/foods/barcode/4006381333931*',r=>r.fulfill({headers,json:{code:'4006381333931',name:'Camera test food',brand:'',basis:'g',serving:50,per100:{calories:250,protein:0,carbs:null,fat:8}}}));
  await page.goto('/scan');await page.getByRole('button',{name:/Scan your meal/i}).click();await page.getByRole('button',{name:'Scan product barcode'}).click();
  await expect(page.getByRole('heading',{name:'Camera test food'})).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>window.testBarcodeTrack.readyState)).toBe('ended');
});
