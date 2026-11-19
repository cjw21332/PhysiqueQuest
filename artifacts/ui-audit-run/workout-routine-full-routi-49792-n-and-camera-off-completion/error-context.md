# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workout-routine.spec.mjs >> full routine supports bodyweight, skip/revisit, kg correction, and camera-off completion
- Location: tests\browser\workout-routine.spec.mjs:399:1

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Skip exercise' })
    - found getByRole('dialog', { name: 'Rest time' }), intercepting action to run the handler
    - locator handler has finished, waiting for getByRole('dialog', { name: 'Rest time' }) to be hidden
    - interception handler has finished, continuing

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - main [ref=e4]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - button "Pause workout" [ref=e11] [cursor=pointer]: Pause
          - button "End session" [ref=e14] [cursor=pointer]
        - generic [ref=e15]:
          - generic [ref=e17]:
            - heading "Workout session" [level=1] [ref=e18]
            - button "Edit" [ref=e19] [cursor=pointer]
          - generic "Elapsed time" [ref=e20]: 00:14 Total workout time
        - heading "Exercises · 3" [level=2] [ref=e21]
        - status [ref=e22]: 2 of 4 sets completed · Manual logging
        - navigation "Workout routine" [ref=e23]:
          - list [ref=e24]:
            - listitem [ref=e25]:
              - button "Revisit Push-Up" [ref=e26] [cursor=pointer]:
                - generic [ref=e27]: "1"
                - generic [ref=e28]:
                  - strong [ref=e29]: Push-Up
                  - generic [ref=e30]: 2 sets · 12 reps
                - generic [ref=e31]: 2/2
              - generic [ref=e35]:
                - button "Reorder Push-Up" [ref=e36] [cursor=pointer]
                - button "Options for Push-Up" [ref=e39] [cursor=pointer]
            - listitem [ref=e44]:
              - button "View Dumbbell Row" [expanded] [ref=e45] [cursor=pointer]:
                - generic [ref=e46]: "2"
                - generic [ref=e47]:
                  - strong [ref=e48]: Dumbbell Row
                  - generic [ref=e49]: 1 sets · 10 reps
                - generic [ref=e50]: 0/1
              - generic [ref=e54]:
                - button "Reorder Dumbbell Row" [ref=e55] [cursor=pointer]
                - button "Options for Dumbbell Row" [ref=e58] [cursor=pointer]
              - region "Current exercise" [ref=e63]:
                - generic [ref=e64]:
                  - strong [ref=e65]: Weight unit
                  - group "Weight unit for Dumbbell Row" [ref=e66]:
                    - button "lbs" [pressed] [ref=e67] [cursor=pointer]
                    - button "kg" [ref=e68] [cursor=pointer]
                - paragraph [ref=e69]: Tap a number to log your set. Blank weight means no added load.
                - complementary [ref=e70]:
                  - strong [ref=e71]: Next-session guidance
                  - paragraph [ref=e72]: Workout history is unavailable.
                  - generic [ref=e73]: Set a dietary goal in Scan to include your nutrition phase. Suggestion only. Adjust for technique, recovery and available equipment; stop if you feel pain.
                - generic [aria-hidden] [ref=e74]:
                  - generic [ref=e75]: Set
                  - generic [ref=e76]: lbs
                  - generic [ref=e77]: Reps
                - generic [ref=e79]:
                  - generic [ref=e80]:
                    - generic [ref=e81]: Set type for set 1
                    - combobox "Set type for set 1" [ref=e82]:
                      - option "Normal set" [selected]: "1"
                      - option "Warm-up set": W
                      - option "Drop set": D
                      - option "Failure set": F
                  - generic [ref=e83]:
                    - generic [ref=e84]: Weight (lbs)
                    - textbox "Weight (lbs), set 1" [ref=e85]
                  - generic [ref=e86]:
                    - generic [ref=e87]: Reps
                    - textbox "Reps, set 1" [ref=e88]: "10"
                  - button "Save set 1" [ref=e89] [cursor=pointer]
                - button "+ Add Set" [ref=e92] [cursor=pointer]
            - listitem [ref=e93]:
              - button "View Plank" [ref=e94] [cursor=pointer]:
                - generic [ref=e95]: "3"
                - generic [ref=e96]:
                  - strong [ref=e97]: Plank
                  - generic [ref=e98]: 1 sets · 45 sec
                - generic [ref=e99]: 0/1
              - generic [ref=e103]:
                - button "Reorder Plank" [ref=e104] [cursor=pointer]
                - button "Options for Plank" [ref=e107] [cursor=pointer]
        - status [ref=e112]: Set 2 saved to your account.
        - button "Cancel Workout" [ref=e113] [cursor=pointer]
    - button "Open Phiq coach" [ref=e114] [cursor=pointer]
```

# Test source

```ts
  307 |   await expect(dialog.getByText('Fresh guide response')).toBeVisible();
  308 |   expect(requests.at(-1)).toEqual({ messages: [{ role: 'user', text: 'How does Scan work?' }], includePersonalData: false, page: '/coach' });
  309 |   await expect(dialog.getByText('Old private response')).toHaveCount(0);
  310 |   await expect(dialog.getByText('Show my progress', { exact: true })).toHaveCount(0);
  311 |   await expect(dialog.getByLabel('Ask Phiq about PhysiqueQuest')).toBeEnabled();
  312 | });
  313 | test('Phiq resets consent and history when a refreshed session belongs to another account', async ({ page }) => {
  314 |   await fixture(page);
  315 |   await page.route('**/api/auth/session/refresh', route => route.fulfill({ headers, json: { access_token: 'other-token', expires_in: 3600, user: { id: 'other-account', name: 'Other user', email: 'other@example.test', emailVerified: true } } }));
  316 |   let calls = 0;
  317 |   await page.route('**/api/chat', route => {
  318 |     calls++;
  319 |     return route.fulfill(calls === 1 ? { status: 401, headers, json: { message: 'Refresh session' } } : { headers, json: { reply: 'Late account response', sources: [], privacy: { personalDataIncluded: true, historyStored: false, provider: 'self-hosted' } } });
  320 |   });
  321 |   await page.goto('/coach');
  322 |   const launcher = page.getByRole('button', { name: 'Open Phiq coach' });
  323 |   await launcher.click();
  324 |   const dialog = page.getByRole('dialog', { name: 'Phiq' });
  325 |   await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  326 |   await dialog.getByLabel('Ask Phiq about PhysiqueQuest').fill('Private account question');
  327 |   await dialog.getByRole('button', { name: 'Send message' }).click();
  328 |   await expect(dialog).not.toBeVisible();
  329 |   await launcher.click();
  330 |   await expect(dialog.getByRole('checkbox', { name: 'Use my saved fitness data' })).not.toBeChecked();
  331 |   await expect(dialog.getByText('Private account question', { exact: true })).toHaveCount(0);
  332 |   await expect(dialog.getByText('Late account response')).toHaveCount(0);
  333 |   expect(calls).toBe(1);
  334 | });
  335 | test('Phiq cancels waiting, restores the draft and ignores a late response', async ({ page }) => {
  336 |   await fixture(page);
  337 |   let release, finish;
  338 |   const delayed = new Promise(resolve => { release = resolve; });
  339 |   const completed = new Promise(resolve => { finish = resolve; });
  340 |   await page.route('**/api/chat', async route => {
  341 |     await delayed;
  342 |     try { await route.fulfill({ headers, json: { reply: 'Old response that should not appear', sources: [] } }); }
  343 |     finally { finish(); }
  344 |   });
  345 |   await page.goto('/coach');
  346 |   await page.getByRole('button', { name: 'Open Phiq coach' }).click();
  347 |   const dialog = page.getByRole('dialog', { name: 'Phiq' });
  348 |   const input = dialog.getByLabel('Ask Phiq about PhysiqueQuest');
  349 |   await input.fill('Explain my current workout');
  350 |   await dialog.getByRole('button', { name: 'Send message' }).click();
  351 |   await expect(dialog.getByRole('status')).toHaveText('Phiq is thinking…');
  352 |   const cancelled = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname.endsWith('/chat') });
  353 |   await dialog.getByRole('button', { name: 'Stop waiting' }).click();
  354 |   await cancelled;
  355 |   await expect(input).toHaveValue('Explain my current workout');
  356 |   await expect(input).toBeEnabled();
  357 |   await expect(dialog.getByRole('status')).toContainText('Stopped waiting');
  358 |   await expect(dialog.getByRole('alert')).toHaveCount(0);
  359 |   release();
  360 |   await completed;
  361 |   await expect(dialog.getByText('Old response that should not appear', { exact: true })).toHaveCount(0);
  362 | });
  363 | for (const path of ['/home/notifications', '/coach', '/scan/history', '/quests', '/me/training']) {
  364 |   test(`Phiq page help sends the current pathname on ${path}`, async ({ page }) => {
  365 |     await fixture(page);
  366 |     let submitted;
  367 |     await page.route('**/api/chat', route => {
  368 |       submitted = route.request().postDataJSON();
  369 |       return route.fulfill({ headers, json: { reply: 'This page is part of PhysiqueQuest.', sources: [{ id: 'internal-only', label: 'Hidden internal reference' }] } });
  370 |     });
  371 |     await page.goto(path);
  372 |     await page.getByRole('button', { name: 'Open Phiq coach' }).click();
  373 |     const dialog = page.getByRole('dialog', { name: 'Phiq' });
  374 |     await dialog.getByRole('button', { name: 'Explain this page', exact: true }).click();
  375 |     await expect(dialog.getByText('This page is part of PhysiqueQuest.', { exact: true })).toBeVisible();
  376 |     expect(submitted).toEqual({ messages: [{ role: 'user', text: 'How do I use this page?' }], includePersonalData: false, page: path });
  377 |     await expect(dialog.getByText('Hidden internal reference', { exact: true })).toHaveCount(0);
  378 |     await expect(dialog.getByRole('list', { name: 'Reply sources' })).toHaveCount(0);
  379 |   });
  380 | }
  381 | async function resume(page) {
  382 |   await page.goto('/coach');
  383 |   await page.getByRole('button', { name: 'Resume saved workout' }).click();
  384 |   await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  385 | }
  386 | test('account pages support direct links and browser history', async ({ page }) => {
  387 |   await fixture(page);
  388 |   await page.goto('/me');
  389 |   await page.getByRole('button', { name: /Personal data/ }).click();
  390 |   await expect(page).toHaveURL(/\/me\/personal-data$/);
  391 |   await page.goBack();
  392 |   await expect(page).toHaveURL(/\/me$/);
  393 |   await page.goForward();
  394 |   await expect(page).toHaveURL(/\/me\/personal-data$/);
  395 |   await page.reload();
  396 |   await expect(page).toHaveURL(/\/me\/personal-data$/);
  397 |   await expect(page.getByText('Personal data', { exact: true }).first()).toBeVisible();
  398 | });
  399 | test('full routine supports bodyweight, skip/revisit, kg correction, and camera-off completion', async ({ page }, info) => {
  400 |   const state = await fixture(page);
  401 |   await resume(page);
  402 |   await expect(page.getByRole('navigation', { name: 'Workout routine' })).toBeVisible();
  403 |   await expect(page.getByRole('button', { name: 'View Dumbbell Row' })).toBeVisible();
  404 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  405 |   await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  406 |   await expect(page.getByRole('button', { name: 'View Dumbbell row' })).toHaveAttribute('aria-expanded', 'true');
> 407 |   await page.getByRole('button', { name: 'Skip exercise' }).click();
      |                                                             ^ Error: locator.click: Test timeout of 15000ms exceeded.
  408 |   await expect(page.getByRole('button', { name: 'View Plank' })).toHaveAttribute('aria-expanded', 'true');
  409 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  410 |   expect(state.workout.sets.find(s => s.exerciseId === 'plank')).toMatchObject({ reps: 0, durationSeconds: 45 });
  411 |   await page.getByRole('button', { name: /Revisit Dumbbell row/i }).click();
  412 |   await page.getByLabel('Weight (kg), set 1').fill('20');
  413 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  414 |   await page.getByLabel('Weight (kg), set 1').fill('22.5');
  415 |   await page.getByRole('button', { name: 'Update set 1', exact: true }).click();
  416 |   expect(state.workout.sets.filter(s => s.exerciseId === 'row')).toHaveLength(1);
  417 |   expect(state.workout.sets.find(s => s.exerciseId === 'row').loadKg).toBe(22.5);
  418 |   await page.screenshot({ path: info.outputPath('routine-390.png'), animations: 'disabled' });
  419 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  420 |   await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  421 |   await expect(page).toHaveURL(/\/coach\/report$/);
  422 |   await page.reload();
  423 |   await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  424 |   await expect(page.getByRole('heading', { name: 'Exercise breakdown' })).toBeVisible();
  425 |   await expect(page.getByRole('region', { name: 'Workout summary' })).toContainText('Sets logged');
  426 |   await expect(page.getByRole('region', { name: 'Confirmed results' })).toContainText('Dumbbell Row');
  427 |   await expect(page.getByText(/form analysis|form errors/i)).toHaveCount(0);
  428 |   for (const width of [320, 390, 768]) {
  429 |     await page.setViewportSize({ width, height: 844 });
  430 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  431 |     await page.screenshot({ path: info.outputPath(`workout-report-${width}.png`), animations: 'disabled' });
  432 |   }
  433 | });
  434 | test('failed save retains input and retry saves once; pause preserves the current draft', async ({ page }) => {
  435 |   const state = await fixture(page, { fail: true });
  436 |   await resume(page);
  437 |   await page.getByLabel('Reps, set 1', { exact: true }).fill('9');
  438 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  439 |   await expect(page.getByRole('alert').filter({ hasText: 'Set save unavailable' })).toBeVisible();
  440 |   await expect(page.getByLabel('Reps, set 1', { exact: true })).toHaveValue('9');
  441 |   await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  442 |   await expect(page.getByRole('button', { name: 'Save set 1', exact: true })).toBeDisabled();
  443 |   await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  444 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  445 |   expect(state.workout.sets).toHaveLength(1);
  446 |   expect(state.workout.sets[0].reps).toBe(9);
  447 | });
  448 | test('reopen restores server sets and unsaved device inputs; ending early confirms skipped work', async ({ page }) => {
  449 |   const state = await fixture(page);
  450 |   await resume(page);
  451 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  452 |   await page.getByLabel('Reps, set 2', { exact: true }).fill('8');
  453 |   const context=page.context();
  454 |   await page.close();
  455 |   page=await context.newPage();
  456 |   await page.goto('/coach');
  457 |   await page.getByRole('button', { name: 'Resume saved workout' }).click();
  458 |   await expect(page.getByLabel('Reps, set 2', { exact: true })).toHaveValue('8');
  459 |   await expect(page.getByRole('button', { name: 'Update set 1', exact: true })).toBeDisabled();
  460 |   await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  461 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  462 |   await expect(page.getByRole('dialog', { name: 'End workout early?' })).toBeVisible();
  463 |   await page.getByRole('button', { name: 'Keep training' }).click();
  464 |   expect(state.workout.status).toBe('active');
  465 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  466 |   await page.getByRole('button', { name: 'Save and end workout' }).click();
  467 |   await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  468 |   expect(state.workout.sets.filter(s => s.status === 'completed')).toHaveLength(1);
  469 |   expect(state.workout.sets.filter(s => s.status === 'skipped')).toHaveLength(3);
  470 | });
  471 | 
  472 | test('camera denial never blocks routine logging and controls meet phone target sizes', async ({page},info)=>{
  473 |   const state=await fixture(page);
  474 |   await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
  475 |   await resume(page);
  476 |   await page.route('**/exercises/push',route=>route.fulfill({json:{_id:'push',name:'Push-up',equipments:['bodyweight'],targetMuscles:['pectorals'],instructions:['Bend elbows']},headers}));
  477 |   await page.route('**/pose-tracker/exercises/push',route=>route.fulfill({status:503,json:{message:'Configuration unavailable'},headers}));
  478 |   await page.route('**/pose-tracker/exercises/push/launch',route=>route.fulfill({json:{config:{exerciseId:'push',name:'Push-up',trackingMode:'builtin',providerExerciseId:'push_up',validationStatus:'documentation-mapped',cameraOrientation:'side',targetMuscles:['pectorals'],equipment:['bodyweight'],capabilities:['repetitions'],limitations:[]},token:'mock-only',developerOutputs:false},headers}));
  479 |   await page.route('https://app.posetracker.com/pose_tracker/tracking?**',route=>route.fulfill({contentType:'text/html',body:'<script>parent.postMessage(JSON.stringify({type:"error",error:"NotAllowedError",message:"Camera permission denied"}),"*")</script>'}));
  480 |   await page.getByRole('button',{name:'PoseTracker options for Push-up'}).click();
  481 |   await page.getByRole('button',{name:'Start PoseTracker',exact:true}).click();
  482 |   await expect(page.locator('.pose-tracker-session [role=alert]')).toContainText('Camera permission denied');
  483 |   await page.getByRole('button',{name:'Back to exercise',exact:true}).click();
  484 |   for(const width of [320,390,768,1440]){
  485 |     await page.setViewportSize({width,height:844});
  486 |     for(const button of await page.locator('.routine-current button').all()) { const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44); }
  487 |     await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveAttribute('inputmode','numeric');
  488 |     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  489 |     await page.screenshot({path:info.outputPath(`routine-camera-off-${width}.png`),animations:'disabled'});
  490 |   }
  491 |   await page.getByRole('button',{name:'Save set 1',exact:true}).click();
  492 |   expect(state.workout.sets[0].reps).toBe(12);
  493 | });
  494 | 
  495 | test('repeated clicks cannot double-save and failed early completion stays recoverable',async({page})=>{
  496 |   const state=await fixture(page,{delaySave:250,failComplete:true});
  497 |   await resume(page);
  498 |   await page.getByRole('button',{name:'Save set 1',exact:true}).dblclick();
  499 |   await expect.poll(()=>state.workout.sets.length).toBe(1);
  500 |   await page.getByRole('button',{name:'End session',exact:true}).click();
  501 |   await page.getByRole('button',{name:'Save and end workout'}).click();
  502 |   await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Completion unavailable');
  503 |   expect(state.workout.status).toBe('active');
  504 |   await page.getByRole('button',{name:'Save and end workout'}).click();
  505 |   await expect(page.getByRole('heading',{name:'Workout report'})).toBeVisible();
  506 |   expect(state.workout.sets).toHaveLength(4);
  507 | });
```