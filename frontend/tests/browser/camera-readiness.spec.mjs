import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
export async function cameraFixture(page) {
  const requests = [];
  await page.addInitScript(() => {
    localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'readiness-user', token: 'test' }));
    window.readinessEvidence = { results: [], workers: 0, terminated: 0, stopped: 0, inFlight: 0, maxInFlight: 0, sent: [], bitmapsClosed: 0 };
    window.readinessStreams = [];
    const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await acquire(...args); window.readinessStreams.push(stream); return stream;
    };
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args); window.readinessEvidence.workers++;
        this.addEventListener('message', event => {
          if (event.data.type === 'readiness-result') window.readinessEvidence.results.push(event.data);
          if (event.data.type === 'readiness-result') window.readinessEvidence.inFlight--;
        });
      }
      postMessage(message, ...args) {
        if(message.type === 'readiness-frame') {
          window.readinessEvidence.inFlight++; window.readinessEvidence.maxInFlight=Math.max(window.readinessEvidence.maxInFlight, window.readinessEvidence.inFlight);
          window.readinessEvidence.sent.push({frameId:message.frameId,timestamp:message.timestamp,sessionId:message.sessionId});
        }
        return super.postMessage(message,...args);
      }
      terminate() { window.readinessEvidence.terminated++; super.terminate(); }
    };
    const stop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function() { window.readinessEvidence.stopped++; return stop.call(this); };
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    requests.push({ path, method: request.method(), data: request.postData() });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const exercises = [{ exerciseId: 'push', name: 'Push-up', equipment: 'Bodyweight', prescription: '2 × 12', sets: 2, tracking: 'Manual' }];
    let json = {};
    if (path.endsWith('/auth/session/migrate') || path.endsWith('/auth/session/refresh')) json = { access_token: 'test', expires_in: 3600, user: { id: 'readiness-user', name: 'Student', email: 'student@example.test', emailVerified: true } };
    if (path.endsWith('/profile')) json = { name: 'Student' };
    if (path.endsWith('/workouts/active')) json = null;
    if (path.endsWith('/coach/plan')) json = { weekLabel: 'This week', libraryReady: true, days: [{ index: 0, name: 'Monday', isWorkoutDay: true, title: 'Workout', exercises }] };
    if (path.endsWith('/pose/status')) json = { available: true };
    if (path.endsWith('/pose/analyze')) json = { exercise: 'Squat', observations: ['Keep your feet planted'] };
    if (path.endsWith('/workouts') && request.method() === 'POST') json = { _id: 'readiness-workout', ...request.postDataJSON(), exercises, sets: [], status: 'active', revision: 0 };
    return route.fulfill({ json, headers });
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Camera check', exact: true })).toBeVisible();
  return requests;
}

test('camera preparation keeps the dark coach layout on its routed page', async ({ page }) => {
  await cameraFixture(page);
  await expect(page).toHaveURL(/\/coach\/prepare$/);
  await expect(page.locator('.signed-in-layout')).toHaveClass(/coach-dark-theme/);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name: 'Camera check' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('web tracer: real local inference receives blank frames, connection stays independent and no live media leaves', async ({ page }) => {
  const requests = await cameraFixture(page);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.locator('.readiness-row').filter({ hasText: 'Camera connection' })).toContainText('Ready');
  await expect.poll(() => page.evaluate(() => window.readinessEvidence.results.length), { timeout: 30000 }).toBeGreaterThan(0);
  const result = await page.evaluate(() => window.readinessEvidence.results[0]);
  expect(result.observation.poseCount).toBe(0);
  expect(result.observation.landmarks).toEqual([]);
  expect(result.observation.sourceWidth).toBeGreaterThan(0);
  expect(result.observation.luminance).toBeGreaterThanOrEqual(0);
  await expect(page.locator('.readiness-row').filter({ hasText: 'Full body in frame' })).toContainText('Unavailable');
  await expect(page.locator('.readiness-list')).toHaveAttribute('data-local-observations', /[1-9]\d*/);
  expect(requests.filter(r => r.path.includes('/pose'))).toEqual([]);
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeEnabled();
  expect(await page.evaluate(()=>window.readinessEvidence.maxInFlight)).toBe(1);
});

const connection=page=>page.locator('.readiness-row').filter({hasText:'Camera connection'});
async function nativeFixture(page) {
  await page.addInitScript(()=>{
    window.nativeMessages=[];
    window.ReactNativeWebView={postMessage:message=>window.nativeMessages.push(JSON.parse(message))};
  });
  await cameraFixture(page);
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.nativeMessages.some(m=>m.type==='camera-start'))).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('physiquequest-camera',{detail:{type:'status',status:'on'}})));
  return page.evaluate(()=>window.nativeMessages.find(m=>m.type==='camera-start'));
}
async function nativeFrame(page,context,id=1,overrides={}) {
  await page.evaluate(({context,id,overrides})=>window.dispatchEvent(new CustomEvent('physiquequest-camera-readiness',{detail:{
    type:'observation',sessionId:context.readiness.sessionId,geometryGeneration:context.readiness.geometryGeneration,
    observation:{platform:'native',sessionId:context.readiness.sessionId,geometryGeneration:context.readiness.geometryGeneration,
      frameId:id,sourceWidth:480,sourceHeight:640,previewWidth:context.readiness.previewWidth,previewHeight:context.readiness.previewHeight,
      coordinatesMirrored:false,previewMirrored:false,poseCount:0,landmarks:[],luminance:.5,...overrides},
  }})),{context,id,overrides});
}
test('native tracer: session context reaches shared rows, empty frames connect, fallback and manual stop stay honest',async({page})=>{
  const start=await nativeFixture(page);
  expect(start.previewContext.readiness.sessionId).toBeTruthy();
  expect(start.previewContext.readiness.mode).toBe('readiness');
  expect(start.previewContext.tracking).toBeUndefined();
  await expect(connection(page)).not.toContainText('Ready');
  await nativeFrame(page,start.previewContext,1);
  await page.waitForTimeout(1050);
  await nativeFrame(page,start.previewContext,2);
  await expect(connection(page)).toContainText('Ready');
  await expect(page.locator('.readiness-list')).toHaveAttribute('data-local-observations','2');
  await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).toContainText('Device validation is pending');
  await page.evaluate(context=>window.dispatchEvent(new CustomEvent('physiquequest-camera-readiness',{detail:{type:'capability',sessionId:context.readiness.sessionId,geometryGeneration:context.readiness.geometryGeneration,reason:'unsupported'}})),start.previewContext);
  await expect(connection(page)).not.toContainText('Ready');
  await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).toContainText('not supported');
  await page.getByRole('button',{name:'Continue without camera',exact:true}).click();
  expect(await page.evaluate(()=>window.nativeMessages.some(m=>m.type==='camera-stop'))).toBe(true);
  expect(await page.evaluate(()=>window.nativeMessages.some(m=>JSON.stringify(m).includes('mediaBase64')))).toBe(false);
});
for(const type of ['error','reset','capability','invalid','oversized']) test(`native lifecycle: ${type} clears connection and cannot retain a stale pass`,async({page})=>{
  const {previewContext:context}=await nativeFixture(page);
  await nativeFrame(page,context,1);await page.waitForTimeout(1050);await nativeFrame(page,context,2);
  await expect(connection(page)).toContainText('Ready');
  await page.evaluate(({context,type})=>{
    const detail={type,sessionId:context.readiness.sessionId,geometryGeneration:context.readiness.geometryGeneration,reason:'interrupted'};
    if(type==='invalid')detail.type='unknown-event';
    if(type==='oversized')detail.padding='x'.repeat(33000);
    window.dispatchEvent(new CustomEvent('physiquequest-camera-readiness',{detail}));
  },{context,type});
  await expect(connection(page)).not.toContainText('Ready');
  await nativeFrame(page,context,2);
  await expect(connection(page)).not.toContainText('Ready');
  await page.getByRole('button',{name:'Continue without camera',exact:true}).click();
  expect(await page.evaluate(()=>window.nativeMessages.some(m=>m.type==='camera-stop'))).toBe(true);
});
test('native lifecycle: old session, duplicate sequence, missing confidence, future/nonfinite fields and geometry reset never restore green',async({page})=>{
  const {previewContext:context}=await nativeFixture(page);
  await nativeFrame(page,context,1);await page.waitForTimeout(1050);await nativeFrame(page,context,2);
  await expect(connection(page)).toContainText('Ready');
  await nativeFrame(page,context,3,{landmarks:Array.from({length:33},()=>({x:.5,y:.5})),poseCount:1});
  await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).not.toContainText('Ready');
  await nativeFrame(page,context,4,{receivedAt:Infinity});
  await expect(connection(page)).not.toContainText('Ready');
  await nativeFrame(page,context,5,{receivedAt:Number.MAX_VALUE});
  await expect(connection(page)).not.toContainText('Ready');
  await page.setViewportSize({width:420,height:820});
  await expect.poll(()=>page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='camera-update-overlay').at(-1)?.previewContext.readiness.sessionId)).not.toBe(context.readiness.sessionId);
  await nativeFrame(page,context,20);await page.waitForTimeout(1100);await nativeFrame(page,context,21);
  await expect(connection(page)).not.toContainText('Ready');
  const current=await page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='camera-update-overlay').at(-1).previewContext);
  await nativeFrame(page,current,1);await page.waitForTimeout(1050);await nativeFrame(page,current,2);
  await expect(connection(page)).toContainText('Ready');
  await page.waitForTimeout(1350);await nativeFrame(page,current,2);
  await expect(connection(page)).not.toContainText('Ready');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await nativeFrame(page,current,30);
  await expect(connection(page)).not.toContainText('Ready');
  expect(await page.evaluate(()=>window.nativeMessages.some(m=>m.type==='camera-stop'))).toBe(true);
});
async function enable(page) {
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect(connection(page)).toContainText('Ready', {timeout:15000});
}
async function released(page) {
  await expect.poll(()=>page.evaluate(()=>window.readinessStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
}

test('web lifecycle: resize resets dwell, blur stops tracks and reopen needs fresh evidence',async({page})=>{
  await cameraFixture(page); await enable(page);
  await expect.poll(()=>page.evaluate(()=>window.readinessEvidence.results.length)).toBeGreaterThan(0);
  const before=await page.evaluate(()=>window.readinessEvidence.terminated);
  await page.setViewportSize({width:430,height:800});
  await expect.poll(()=>page.evaluate(()=>window.readinessEvidence.terminated)).toBeGreaterThan(before);
  await expect(connection(page)).toContainText('Ready');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(connection(page)).toContainText('Unavailable'); await released(page);
  await enable(page);
  expect(await page.evaluate(()=>window.readinessEvidence.workers)).toBeGreaterThan(1);
  await page.getByRole('button',{name:'Upload video',exact:true}).click(); await released(page);
  await page.getByRole('button',{name:'Live feed',exact:true}).click();
  await expect(connection(page)).toContainText('Unavailable');
});

for(const event of ['mute','ended']) test(`web lifecycle: ${event} track invalidates and releases camera`,async({page})=>{
  await cameraFixture(page); await enable(page);
  await page.evaluate(type=>window.readinessStreams.at(-1).getVideoTracks()[0].dispatchEvent(new Event(type)),event);
  await expect(connection(page)).toContainText('Unavailable'); await released(page);
  await expect(page.locator('.camera-message[role=alert]')).toContainText('Camera delivery stopped');
});

test('web lifecycle: hidden document tears down and rapid switch/off cannot revive readiness',async({page})=>{
  await cameraFixture(page); await enable(page);
  await page.getByRole('button',{name:'Switch to front camera'}).click();
  await page.getByRole('button',{name:'Upload video',exact:true}).click();
  await released(page);
  await page.getByRole('button',{name:'Live feed',exact:true}).click();
  await expect(connection(page)).toContainText('Unavailable');
  await enable(page);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(connection(page)).toContainText('Unavailable'); await released(page);
});

test('web lifecycle: rejected play releases acquisition and never claims connected',async({page})=>{
  await cameraFixture(page);
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=()=>Promise.reject(new DOMException('Play rejected','NotSupportedError'));});
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect(connection(page)).toContainText('Unavailable'); await released(page);
  await expect(page.locator('.camera-message[role=alert]')).toContainText('No camera was found or it could not start');
});

test('web lifecycle: advancing currentTime fallback works, stalled frame callbacks expire connection',async({page})=>{
  await cameraFixture(page);
  await page.evaluate(()=>{
    HTMLVideoElement.prototype.requestVideoFrameCallback=undefined;
    HTMLVideoElement.prototype.cancelVideoFrameCallback=undefined;
  });
  await enable(page);
  await page.getByRole('button',{name:'Upload video',exact:true}).click();
  await released(page);
});

test('web lifecycle: stale decoded delivery cannot stay green or keep submitting inference',async({page})=>{
  await cameraFixture(page); await enable(page);
  await page.evaluate(()=>{document.querySelector('.camera-preview-video').requestVideoFrameCallback=()=>0;});
  await expect(connection(page)).toContainText('Fresh evidence expired',{timeout:5000});
  const sent=await page.evaluate(()=>window.readinessEvidence.sent.length);
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>window.readinessEvidence.sent.length)).toBe(sent);
});

test('web lifecycle: late stream and pending bitmap are released after stop',async({page})=>{
  await cameraFixture(page);
  await page.evaluate(()=>{
    const acquire=navigator.mediaDevices.getUserMedia;
    window.savedAcquire=acquire;
    navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await acquire(...args);await new Promise(resolve=>window.finishAcquisition=resolve);return stream;};
  });
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!window.finishAcquisition)).toBe(true);
  await page.getByRole('button',{name:'Upload video',exact:true}).click();
  await page.evaluate(()=>window.finishAcquisition()); await released(page);
  await page.getByRole('button',{name:'Live feed',exact:true}).click();
  await page.evaluate(()=>{
    navigator.mediaDevices.getUserMedia=window.savedAcquire;
    const bitmap=window.createImageBitmap;
    window.createImageBitmap=async(...args)=>{const image=await bitmap(...args);await new Promise(resolve=>window.finishBitmap=resolve);return image;};
    const close=ImageBitmap.prototype.close;
    ImageBitmap.prototype.close=function(){window.readinessEvidence.bitmapsClosed++;return close.call(this);};
  });
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!window.finishBitmap),{timeout:20000}).toBe(true);
  await page.getByRole('button',{name:'Upload video',exact:true}).click();
  await page.evaluate(()=>window.finishBitmap());
  await expect.poll(()=>page.evaluate(()=>window.readinessEvidence.bitmapsClosed)).toBe(1);
  await released(page);
});

test('web lifecycle: failed bitmap transfer closes the untransferred image',async({page})=>{
  await cameraFixture(page);
  await page.evaluate(()=>{
    window.untransferredClosedWidths=[];
    const close=ImageBitmap.prototype.close;
    ImageBitmap.prototype.close=function(){window.untransferredClosedWidths.push(this.width);return close.call(this);};
    const send=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...args){
      if(message.type==='readiness-frame')throw new DOMException('Forced transfer failure','DataCloneError');
      return send.call(this,message,...args);
    };
  });
  await enable(page);
  await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).toContainText('Local analysis failed');
  await expect.poll(()=>page.evaluate(()=>window.untransferredClosedWidths.length)).toBe(1);
  expect(await page.evaluate(()=>window.untransferredClosedWidths[0])).toBeGreaterThan(0);
  await expect(connection(page)).toContainText('Ready');
});

test('readiness UX: denied permission stays actionable and manual continuation stops camera',async({page})=>{
  const requests=await cameraFixture(page);
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect(page.locator('.camera-message[role=alert]')).toContainText('Camera access is blocked');
  await expect(page.getByRole('button',{name:'Enable camera',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Start session',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Continue without camera',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Camera check',exact:true})).toHaveCount(0);
  expect(requests.filter(r=>r.path.endsWith('/workouts') && r.method==='POST')).toHaveLength(1);
});

test('readiness UX: model failure retains connection and allows retry and camera-off continuation',async({page})=>{
  await cameraFixture(page);
  await page.route('**/pose/pose_landmarker_lite.task',route=>route.abort());
  await enable(page);
  const full=page.locator('.readiness-row').filter({hasText:'Full body in frame'});
  await expect(full).toContainText('Local analysis failed',{timeout:15000});
  await expect(connection(page)).toContainText('Ready');
  await page.unroute('**/pose/pose_landmarker_lite.task');
  await page.getByRole('button',{name:'Retry camera checks',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.readinessEvidence.results.length),{timeout:20000}).toBeGreaterThan(0);
  await expect(full).toContainText('Device validation is pending');
  await page.getByRole('button',{name:'Continue without camera',exact:true}).click(); await released(page);
});

test('readiness UX: unsupported local analysis keeps fresh connection and Start session unrestricted',async({page})=>{
  await cameraFixture(page);
  await page.evaluate(()=>{window.Worker=undefined;});
  await enable(page);
  await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).toContainText('not supported');
  await page.getByRole('button',{name:'Start session',exact:true}).click(); await released(page);
});

test('readiness UX: meaningful labels, stable announcements, focus and 48px targets survive large text',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await cameraFixture(page);
  await expect(connection(page)).toContainText('Unavailable');
  const enableButton=page.getByRole('button',{name:'Enable camera',exact:true});
  await enableButton.focus();
  await page.evaluate(()=>{
    window.announcements=0;
    new MutationObserver(()=>window.announcements++).observe(document.querySelector('.readiness-list [role=status]'),{childList:true,subtree:true,characterData:true});
  });
  await enableButton.click();
  await expect(connection(page)).toContainText('Ready');
  const retry=page.getByRole('button',{name:'Retry camera checks',exact:true}); await retry.focus();
  await page.waitForTimeout(1600);
  await expect(retry).toBeFocused();
  expect(await page.evaluate(()=>window.announcements)).toBeLessThanOrEqual(3);
  expect(await page.locator('.readiness-list [aria-live]').count()).toBe(1);
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';document.documentElement.dataset.largeText='true';});
  for(const name of ['Back to AI Coach','Live feed','Upload video','Retry camera checks','Start session','Continue without camera']) {
    const button=page.getByRole('button',{name,exact:true}),box=await button.boundingBox();
    expect(box.height,`${name} height`).toBeGreaterThanOrEqual(48);expect(box.width,`${name} width`).toBeGreaterThanOrEqual(48);
  }
  const overflow=await page.locator('.readiness-row').evaluateAll(rows=>rows.some(row=>row.scrollWidth>row.clientWidth+1));
  expect(overflow).toBe(false);
  await page.screenshot({path:test.info().outputPath('readiness-large-text.png'),fullPage:true});
});

test('readiness UX: upload status is lazy and explicit analysis retains video payload',async({page})=>{
  const requests=await cameraFixture(page);
  expect(requests.filter(r=>r.path.includes('/pose'))).toEqual([]);
  await page.getByRole('button',{name:'Upload video',exact:true}).click();
  await expect.poll(()=>requests.filter(r=>r.path.endsWith('/pose/status')).length).toBe(1);
  await page.getByLabel('Choose a recorded exercise video').setInputFiles(fileURLToPath(new URL('../../public/opening-app-animation.mp4', import.meta.url)));
  await expect.poll(() => page.locator('.upload-dropzone video').evaluate(video => video.readyState)).toBeGreaterThan(0);
  await page.getByLabel('Exercise in this recording (optional)').selectOption('chest_press');
  expect(requests.filter(r=>r.method==='POST' && r.path.includes('/pose'))).toEqual([]);
  await page.getByRole('button',{name:'Analyze video',exact:true}).click();
  await expect.poll(()=>requests.filter(r=>r.method==='POST' && r.path.includes('/pose')).length).toBe(1);
  const data=JSON.parse(requests.find(r=>r.method==='POST' && r.path.includes('/pose')).data);
  expect(data).toMatchObject({mimeType:'video/mp4', analysisType:'workout'});
  expect(data.exerciseHint).toBe('chest_press');
  expect(data.durationSeconds).toBeGreaterThan(0);
  expect(data.mediaBase64.length).toBeGreaterThan(100);
  await expect(page.getByRole('region', { name: 'Video analysis' })).toContainText('Keep your feet planted');
  await expect(page.getByRole('region', { name: 'Video analysis' })).toContainText('Your workout has not been changed.');
});

test('an unavailable exercise review can be retried and shows the returned guidance', async ({ page }) => {
  await cameraFixture(page);
  let attempts = 0;
  await page.route('**/api/pose/analyze', route => {
    attempts++;
    return route.fulfill({ json: attempts === 1 ? { observations: ['Tracked'], exerciseReview: null } : { observations: ['Tracked'], exerciseReview: { exercise: 'Chest press', equipment: 'Machine', generalBodyPart: 'Upper body', specificMuscles: 'Chest', estimatedReps: 3, formObservations: ['Review elbow position'], corrections: ['Keep wrists aligned'], instructions: ['Press under control'] } }, headers });
  });
  await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  await page.getByLabel('Choose a recorded exercise video').setInputFiles(fileURLToPath(new URL('../../public/opening-app-animation.mp4', import.meta.url)));
  await expect.poll(() => page.locator('.upload-dropzone video').evaluate(video => video.readyState)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Analyze video', exact: true }).click();
  await expect(page.getByText('Exercise review unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'Retry exercise review' }).click();
  await expect(page.getByText('Likely exercise: Chest press')).toBeVisible();
  await expect(page.getByText('Keep wrists aligned')).toBeVisible();
  await expect(page.getByText('Not verified')).toBeVisible();
  await expect(page.getByLabel('Form accuracy unavailable')).toBeVisible();
  await expect(page.locator('.report-ring')).not.toContainText('tracking');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.recording-report-body').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  expect(attempts).toBe(2);
});

for (const method of ['click', 'keyboard']) test(`upload icon opens the video picker by ${method}`, async ({ page }) => {
  await cameraFixture(page);
  await page.getByRole('button', { name: 'Upload video', exact: true }).click();
  const icon = page.getByRole('button', { name: 'Choose a video', exact: true });
  const chooser = page.waitForEvent('filechooser');
  if (method === 'keyboard') { await icon.focus(); await page.keyboard.press('Enter'); }
  else await icon.click();
  await (await chooser).setFiles(fileURLToPath(new URL('../../public/opening-app-animation.mp4', import.meta.url)));
  await expect(page.getByText('opening-app-animation.mp4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start manual session' })).toBeVisible();
});

test('readiness regression: live enable and retry send no analysis/media and returning starts fresh', async ({page}) => {
  const outgoing = [];
  page.on('request', request => { if (request.method() !== 'GET') outgoing.push({url:request.url(),data:request.postData()}); });
  const requests = await cameraFixture(page);
  await enable(page);
  await expect.poll(()=>page.evaluate(()=>window.readinessEvidence.results.length)).toBeGreaterThan(0);
  const workers = await page.evaluate(()=>window.readinessEvidence.workers);
  await page.getByRole('button',{name:'Retry camera checks',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.readinessEvidence.workers)).toBeGreaterThan(workers);
  await expect(connection(page)).toContainText('Ready');
  await page.getByRole('button',{name:'Back to AI Coach',exact:true}).click();
  await released(page);
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(connection(page)).toContainText('Unavailable');
  expect(requests.filter(r=>r.path.includes('/pose'))).toEqual([]);
  expect(outgoing).toEqual([]);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>/readiness|camera/i.test(key)))).toEqual([]);
});

for (const failure of ['denied','unsupported','model-failure','stale']) test(`readiness regression: ${failure} continues to API-backed manual workout and releases resources`,async({page})=>{
  const requests=await cameraFixture(page);
  if(failure==='denied') await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  if(failure==='unsupported') await page.evaluate(()=>{window.Worker=undefined;});
  if(failure==='model-failure') await page.route('**/pose/pose_landmarker_lite.task',route=>route.abort());
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  if(failure==='denied') await expect(page.locator('.camera-message[role=alert]')).toContainText('Camera access is blocked');
  if(failure==='unsupported') await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).toContainText('not supported');
  if(failure==='model-failure') await expect(page.locator('.readiness-row').filter({hasText:'Full body in frame'})).toContainText('Local analysis failed',{timeout:15000});
  if(failure==='stale') {
    await expect(connection(page)).toContainText('Ready');
    await page.evaluate(()=>{document.querySelector('.camera-preview-video').requestVideoFrameCallback=()=>0;});
    await expect(connection(page)).toContainText('Fresh evidence expired',{timeout:5000});
  }
  await page.getByRole('button',{name:'Continue without camera',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Camera check',exact:true})).toHaveCount(0);
  await released(page);
  const writes=requests.filter(r=>r.path.endsWith('/workouts') && r.method==='POST');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0].data).exerciseIds).toEqual(['push']);
  expect(JSON.parse(writes[0].data).exercises[0].sets).toBe(2);
  expect(requests.filter(r=>r.path.includes('/pose'))).toEqual([]);
});

test('readiness regression: explicit video rejects wrong type and over-20MB before an analysis request',async({page})=>{
  const requests=await cameraFixture(page);
  await page.getByRole('button',{name:'Upload video',exact:true}).click();
  await expect.poll(()=>requests.filter(r=>r.path.endsWith('/pose/status')).length).toBe(1);
  await page.getByLabel('Choose a recorded exercise video').setInputFiles({name:'set.webm',mimeType:'video/webm',buffer:Buffer.from('invalid-type')});
  await page.getByRole('button',{name:'Analyze video',exact:true}).click();
  await expect(page.locator('.error[role=alert]')).toContainText('Choose an MP4 or MOV video');
  await page.getByRole('button',{name:'Choose a different video',exact:true}).click();
  await page.getByLabel('Choose a recorded exercise video').setInputFiles({name:'large.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(20*1024*1024+1)});
  await page.getByRole('button',{name:'Analyze video',exact:true}).click();
  await expect(page.locator('.error[role=alert]')).toContainText('Choose a video smaller than 20 MB');
  expect(requests.filter(r=>r.method==='POST' && r.path.includes('/pose'))).toEqual([]);
});
