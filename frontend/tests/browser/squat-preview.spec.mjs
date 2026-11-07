// Migration regression. Synthetic provider events do not validate live PoseTracker.
import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const squat={_id:'6YUfHPL',name:'quads (bodyweight squat)',targetMuscles:['quadriceps'],equipments:['bodyweight'],instructions:['Bend knees and hips.'],pose:'missing'};
const config={exerciseId:squat._id,name:squat.name,normalizedName:'quads bodyweight squat',bodyParts:['upper legs'],targetMuscles:['quadriceps'],equipment:['bodyweight'],category:'repetition',trackingMode:'builtin',providerExerciseId:'squat',cameraOrientation:'front',capabilities:['repetitions','provider-feedback'],referenceStatus:'not-required',validationStatus:'documentation-mapped',limitations:['Not validated with real people.'],configurationVersion:1};
const generatedAngleConfig={source:'gif-derived',verified:false,liveValidated:false,primaryJoints:['left_knee'],sideMode:'unilateral',startAngles:{left_knee:150},peakAngles:{left_knee:90},directions:{left_knee:'decreasing'},referenceRanges:{left_knee:60},stabilityConstraints:[],viewHint:'side',cycleCount:1,validFraction:1,thresholdsUsed:{},generatorVersion:'test',generatedAt:'test'};
async function setup(page,options={}) {
  await page.addInitScript(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'test',token:'test'})));
  await page.route('https://app.posetracker.com/pose_tracker/tracking?**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Mock PoseTracker</title><button>Mock camera</button><script>window.send=(data)=>parent.postMessage(JSON.stringify(data),"*");document.querySelector("button").onclick=async()=>{try{window.stream=await navigator.mediaDevices.getUserMedia({video:true});send({type:"initialization",message:"running",ready:true});}catch(e){send({type:"error",error:e.name,message:"Camera unavailable"});}};<\/script>'}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
    if(path.endsWith('/nutrition'))return route.fulfill({json:{meals:[],water:[]},headers});
    if(path.endsWith('/activity/state'))return route.fulfill({json:{state:{},dailyMissions:[]},headers});
    if(path.endsWith('/launch'))return route.fulfill({status:options.missingToken?503:200,json:options.missingToken?{message:'PoseTracker is not configured. Set POSETRACKER_API_TOKEN on the API server.'}:{config:{...config,...options.config},token:'mock-only-not-a-real-key',developerOutputs:true},headers});
    const json=path.includes('/auth/session/')?{access_token:'test',expires_in:3600,user:{id:'test',name:'Test',email:'test@example.test',emailVerified:true}}:path.endsWith('/profile')?{name:'Test',equipment:[]}:path.includes('/pose-tracker/exercises/')?{...config,...options.config}:path.endsWith('/coach/plan')?{days:[],libraryReady:false}:path.endsWith('/exercises')?{items:[squat],total:1,page:1,limit:12,pages:1}:path.endsWith(`/exercises/${squat._id}`)?squat:{};
    return route.fulfill({json,headers});
  });
  await page.goto('/coach');await page.getByRole('button',{name:/Exercise library/}).click();await page.getByRole('button',{name:/quads \(bodyweight squat\)/i}).click();
  await expect(page.getByRole('button',{name:'Try squat movement preview'})).toHaveCount(0);
  await page.getByRole('button',{name:'PoseTracker options',exact:true}).click();
}
async function start(page){await page.getByRole('checkbox',{name:/I agree to use my camera with PoseTracker/}).check();await page.getByRole('button',{name:'Start PoseTracker',exact:true}).click();await expect(page.locator('iframe')).toBeVisible();await expect.poll(()=>page.frames().some(f=>f.url().startsWith('https://app.posetracker.com/'))).toBe(true);return page.frames().find(f=>f.url().startsWith('https://app.posetracker.com/'));}
async function emit(frame,data){await frame.evaluate(d=>parent.postMessage(JSON.stringify(d),'*'),data);}
test('provider launch requires fresh explicit consent for each session',async({page})=>{
  await setup(page);let launches=0;page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/launch'))launches++;});
  const button=page.getByRole('button',{name:'Start PoseTracker',exact:true});await expect(button).toBeDisabled();await expect(page.locator('iframe')).toHaveCount(0);expect(launches).toBe(0);
  await start(page);expect(launches).toBe(1);await page.getByRole('button',{name:'Stop tracking'}).click();await expect(button).toBeDisabled();await expect(page.getByRole('checkbox',{name:/I agree to use my camera with PoseTracker/})).not.toBeChecked();expect(launches).toBe(1);
});
test('generated-angle camera session starts its worker and produces an unsaved summary',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'getBattery',{configurable:true,value:async()=>({level:0.1,charging:false,addEventListener(){},removeEventListener(){}})});
    window.__poseWorkerTerminations=0;
    window.Worker=class {
      onmessage=null;onerror=null;
      postMessage(message){if(message.type==='init')setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),0);if(message.type==='generic-frame'){message.bitmap.close();setTimeout(()=>this.onmessage?.({data:{type:'generic-result',frame:{landmarks:[],aspect:1,timestamp:message.timestamp},durationMs:10}}),0);}}
      terminate(){window.__poseWorkerTerminations++;}
    };
  });
  await setup(page,{config:{trackingMode:'generated-angle',providerExerciseId:undefined,validationStatus:'verified',generatedAngleConfig}});
  await expect(page.getByRole('region',{name:'Experimental movement tracking'})).toBeVisible();
  await page.getByRole('button',{name:'Start camera'}).click();
  await expect(page.getByText('Experimental tracking active.',{exact:false})).toBeVisible();
  await expect(page.getByText('Low battery: tracking updates are reduced.')).toBeVisible();
  await expect(page.getByText(/Device temperature is not available/)).toBeVisible();
  await page.getByRole('button',{name:'Finish tracking'}).click();
  await expect(page.getByText('Unsaved summary')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__poseWorkerTerminations)).toBeGreaterThan(0);
});
test('generated-angle session initializes the actual local worker with a fake camera',async({page})=>{
  await setup(page,{config:{trackingMode:'generated-angle',providerExerciseId:undefined,validationStatus:'verified',generatedAngleConfig}});
  await page.getByRole('button',{name:'Start camera'}).click();
  await expect(page.getByText('Experimental tracking active.',{exact:false})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Finish tracking'}).click();
  await expect(page.getByText('Unsaved summary')).toBeVisible();
});
test('provider initialization, iframe camera delegation, counter and cleanup',async({page})=>{
  await setup(page);const opened=Date.now();const frame=await start(page);await expect(page.locator('iframe')).toHaveAttribute('allow','camera https://app.posetracker.com');
  await emit(frame,{type:'counter',current_count:4});await expect(page.getByText('4 detected repetitions')).toHaveCount(0);
  await frame.getByRole('button',{name:'Mock camera'}).click();await expect(page.getByText('Waiting for the user to enter the frame',{exact:true})).toBeVisible();
  const initialized=Date.now();
  await emit(frame,{type:'counter',current_count:4,form_score:{score:80,grade:'B'}});await expect(page.getByText('4 detected repetitions')).toBeVisible();
  await writeFile('../output/posetracker-browser-performance.json',JSON.stringify({environment:'Desktop Chromium, mocked provider iframe, fake camera; Playwright assertion overhead included',mockInitializationMs:initialized-opened,mockCounterToUiMs:Date.now()-initialized,liveProviderMeasured:false},null,2));
  await emit(frame,{type:'progression',value:50});await expect(page.locator('progress')).toHaveAttribute('value','50');
  await emit(frame,{type:'recommendations',data:['Keep the whole body visible']});await expect(page.getByText('Keep the whole body visible',{exact:true})).toBeVisible();
  await page.screenshot({path:'../output/posetracker-session.png',fullPage:true});
  await page.getByRole('button',{name:'Stop tracking'}).click();await expect(page.locator('iframe')).toHaveCount(0);expect(frame.isDetached()).toBe(true);await expect(page.getByText('Session summary',{exact:true})).toBeVisible();
  await start(page);await expect(page.getByText('4 detected repetitions')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to exercise',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
});
test('missing token is explicit and never opens a fake service',async({page})=>{
  await setup(page,{missingToken:true});await page.getByRole('checkbox',{name:/I agree to use my camera with PoseTracker/}).check();await page.getByRole('button',{name:'Start PoseTracker',exact:true}).click();await expect(page.locator('.pose-tracker-session [role=alert]')).toContainText('Could not start PoseTracker');await expect(page.locator('iframe')).toHaveCount(0);
});
test('provider permission and disconnection errors stop the iframe',async({page})=>{
  await setup(page);let frame=await start(page);await emit(frame,{type:'error',error:'NotAllowedError',message:'Camera permission denied'});await expect(page.locator('.pose-tracker-session [role=alert]')).toContainText('Camera permission denied');await expect(page.locator('iframe')).toHaveCount(0);
  frame=await start(page);await emit(frame,{type:'initialization',message:'running',ready:true});await emit(frame,{type:'error',error:'NotReadableError',message:'Camera disconnected'});await expect(page.locator('.pose-tracker-session [role=alert]')).toContainText('Camera disconnected');await expect(page.locator('iframe')).toHaveCount(0);
});
test('reference mode, source validation, mobile layout and navigation cleanup',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page,{config:{trackingMode:'reference',providerExerciseId:undefined,referenceUuid:'12345678-1234-4234-8234-123456789012',validationStatus:'verified',capabilities:['repetitions','reference-similarity']}});
  const frame=await start(page);expect(new URL(frame.url()).searchParams.has('exercise')).toBe(false);
  await page.evaluate(()=>window.postMessage({type:'initialization',message:'running',ready:true},'*'));await expect(page.getByText('Waiting for the user to enter the frame',{exact:true})).toHaveCount(0);
  await emit(frame,{type:'initialization',message:'running',ready:true});await emit(frame,{type:'counter',current_count:2,reference_score:{overallScore:0.8,timingScore:0.9,grade:'B'}});await expect(page.getByText(/Similarity to the configured reference/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.goto('/coach');expect(frame.isDetached()).toBe(true);
});
test('pending reference keeps normal library available',async({page})=>{
  await setup(page,{config:{trackingMode:'reference',providerExerciseId:undefined,referenceUuid:'12345678-1234-4234-8234-123456789012',validationStatus:'pending'}});
  await expect(page.getByText(/administrator must configure/)).toBeVisible();await expect(page.getByRole('button',{name:'Start PoseTracker',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Back to exercise',exact:true}).click();await expect(page.getByRole('heading',{name:'Exercise library'})).toBeVisible();
});
test('initialization timeout and hidden-page interruption remove iframe resources',async({page})=>{
  await setup(page);await start(page);
  await page.clock.install();await page.clock.fastForward(46000);
  await expect(page.locator('.pose-tracker-session [role=alert]')).toContainText('did not initialize');await expect(page.locator('iframe')).toHaveCount(0);
  const frame=await start(page);await emit(frame,{type:'initialization',message:'running',ready:true});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('iframe')).toHaveCount(0);await expect.poll(()=>frame.isDetached()).toBe(true);
});
test('AI Coach recommendation cards open the same exercise-aware session',async({page})=>{
  await setup(page);
  await page.route('**/coach/plan',route=>route.fulfill({json:{weekLabel:'Week',duration:'30 min',libraryReady:true,days:[{index:0,name:'Monday',isWorkoutDay:true,title:'Training',exercises:[{exerciseId:squat._id,name:squat.name,equipment:'Bodyweight',tracking:'Manual',prescription:'3 × 12'}]}]}}));
  await page.goto('/coach');await page.getByRole('button',{name:`PoseTracker options for ${squat.name}`}).click();
  await expect(page.getByRole('region',{name:'PoseTracker exercise tracking'})).toBeVisible();await page.getByRole('button',{name:'Back to exercise',exact:true}).click();await expect(page.getByRole('heading',{name:'AI Coach',exact:true})).toBeVisible();
});
test('admin can save a pending reference without enabling ordinary user tracking',async({page})=>{
  await setup(page);let saved;
  await page.route('**/admin/pose-tracker/coverage',route=>route.fulfill({json:{records:[config]}}));
  await page.route(`**/admin/pose-tracker/exercises/${squat._id}`,route=>{saved=route.request().postDataJSON();return route.fulfill({json:{...config,...saved}});});
  await page.goto('/admin/pose-tracker/references');
  await page.getByRole('button',{name:/quads \(bodyweight squat\).*documentation-mapped/}).click();
  await page.getByLabel('Tracking mode').selectOption('reference');await page.getByLabel('Actual reference UUID').fill('12345678-1234-4234-8234-123456789012');await page.getByLabel('Camera orientation').selectOption('side');
  await page.getByRole('button',{name:'Save configuration'}).click();await expect(page.getByRole('status')).toContainText('Configuration saved');expect(saved.validationStatus).toBe('pending');expect(saved.providerExerciseId).toBeUndefined();
});
