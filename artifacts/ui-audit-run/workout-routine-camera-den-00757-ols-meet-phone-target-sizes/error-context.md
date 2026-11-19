# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workout-routine.spec.mjs >> camera denial never blocks routine logging and controls meet phone target sizes
- Location: tests\browser\workout-routine.spec.mjs:472:1

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'PoseTracker options for Push-up' })

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
        - status [ref=e22]: 0 of 4 sets completed · Manual logging
        - navigation "Workout routine" [ref=e23]:
          - list [ref=e24]:
            - listitem [ref=e25]:
              - button "View Push-Up" [expanded] [ref=e26] [cursor=pointer]:
                - generic [ref=e27]: "1"
                - generic [ref=e28]:
                  - strong [ref=e29]: Push-Up
                  - generic [ref=e30]: 2 sets · 12 reps
                - generic [ref=e31]: 0/2
              - generic [ref=e35]:
                - button "Reorder Push-Up" [ref=e36] [cursor=pointer]
                - button "Options for Push-Up" [ref=e39] [cursor=pointer]
              - region "Current exercise" [ref=e44]:
                - generic [ref=e45]:
                  - strong [ref=e46]: Weight unit
                  - group "Weight unit for Push-Up" [ref=e47]:
                    - button "lbs" [pressed] [ref=e48] [cursor=pointer]
                    - button "kg" [ref=e49] [cursor=pointer]
                - paragraph [ref=e50]: Tap a number to log your set. Blank weight means no added load.
                - complementary [ref=e51]:
                  - strong [ref=e52]: Next-session guidance
                  - paragraph [ref=e53]: Workout history is unavailable.
                  - generic [ref=e54]: Set a dietary goal in Scan to include your nutrition phase. Suggestion only. Adjust for technique, recovery and available equipment; stop if you feel pain.
                - generic [aria-hidden] [ref=e55]:
                  - generic [ref=e56]: Set
                  - generic [ref=e57]: Load
                  - generic [ref=e58]: Reps
                - generic [ref=e60]:
                  - generic [ref=e61]:
                    - generic [ref=e62]: Set type for set 1
                    - combobox "Set type for set 1" [ref=e63]:
                      - option "Normal set" [selected]: "1"
                      - option "Warm-up set": W
                      - option "Drop set": D
                      - option "Failure set": F
                  - paragraph [ref=e64]: Bodyweight · no added load
                  - generic [ref=e65]:
                    - generic [ref=e66]: Reps
                    - textbox "Reps, set 1" [ref=e67]: "12"
                  - button "Save set 1" [ref=e68] [cursor=pointer]
                - generic [ref=e71]:
                  - generic [ref=e72]:
                    - generic [ref=e73]: Set type for set 2
                    - combobox "Set type for set 2" [ref=e74]:
                      - option "Normal set" [selected]: "2"
                      - option "Warm-up set": W
                      - option "Drop set": D
                      - option "Failure set": F
                  - paragraph [ref=e75]: Bodyweight · no added load
                  - generic [ref=e76]:
                    - generic [ref=e77]: Reps
                    - textbox "Reps, set 2" [ref=e78]: "12"
                  - button "Save set 2" [ref=e79] [cursor=pointer]
                - button "+ Add Set" [ref=e82] [cursor=pointer]
            - listitem [ref=e83]:
              - button "View Dumbbell Row" [ref=e84] [cursor=pointer]:
                - generic [ref=e85]: "2"
                - generic [ref=e86]:
                  - strong [ref=e87]: Dumbbell Row
                  - generic [ref=e88]: 1 sets · 10 reps
                - generic [ref=e89]: 0/1
              - generic [ref=e93]:
                - button "Reorder Dumbbell Row" [ref=e94] [cursor=pointer]
                - button "Options for Dumbbell Row" [ref=e97] [cursor=pointer]
            - listitem [ref=e102]:
              - button "View Plank" [ref=e103] [cursor=pointer]:
                - generic [ref=e104]: "3"
                - generic [ref=e105]:
                  - strong [ref=e106]: Plank
                  - generic [ref=e107]: 1 sets · 45 sec
                - generic [ref=e108]: 0/1
              - generic [ref=e112]:
                - button "Reorder Plank" [ref=e113] [cursor=pointer]
                - button "Options for Plank" [ref=e116] [cursor=pointer]
        - button "Cancel Workout" [ref=e121] [cursor=pointer]
    - button "Open Phiq coach" [ref=e122] [cursor=pointer]
```

# Test source

```ts
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
  407 |   await page.getByRole('button', { name: 'Skip exercise' }).click();
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
> 480 |   await page.getByRole('button',{name:'PoseTracker options for Push-up'}).click();
      |                                                                           ^ Error: locator.click: Test timeout of 15000ms exceeded.
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
  508 | test('revision conflicts refresh confirmed state and preserve the draft for explicit retry', async ({ page }) => {
  509 |   const state = await fixture(page, { conflict: true });
  510 |   await resume(page);
  511 |   await page.getByLabel('Reps, set 1', { exact: true }).fill('7');
  512 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  513 |   await expect(page.getByRole('alert').filter({ hasText: /Reload|changed/ })).toBeVisible();
  514 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  515 |   expect(state.workout.sets[0].reps).toBe(7);
  516 | });
  517 | test('an abandoned workout older than 24 hours can still end without sending a duration counter', async ({ page }) => {
  518 |   const state = await fixture(page, { stale: true });
  519 |   await resume(page);
  520 |   const request = page.waitForRequest(request => request.url().endsWith('/complete'));
  521 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  522 |   await page.getByRole('button', { name: 'Save and end workout' }).click();
  523 |   expect((await request).postDataJSON()).not.toHaveProperty('durationSeconds');
  524 |   await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  525 |   expect(state.workout.status).toBe('completed');
  526 |   expect(state.workout.sets).toHaveLength(4);
  527 | });
  528 | test('ending a workout clears recovery after report Back and after reload, even with a stale active response', async ({ page }) => {
  529 |   await fixture(page, { staleActive: true });
  530 |   await resume(page);
  531 |   await page.getByRole('button', { name: 'End session', exact: true }).click();
  532 |   await page.getByRole('button', { name: 'Save and end workout' }).click();
  533 |   await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  534 |   await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  535 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  536 |   await expect(page.getByRole('heading', { name: 'Workout in progress' })).toHaveCount(0);
  537 |   await page.reload();
  538 |   await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  539 |   await expect(page.getByRole('button', { name: 'Resume saved workout' })).toHaveCount(0);
  540 | });
  541 | test('returning focus removes a workout completed on another screen', async ({ page }) => {
  542 |   const state = await fixture(page, { staleActive: true });
  543 |   await page.goto('/coach');
  544 |   await expect(page.getByRole('button', { name: 'Resume saved workout' })).toBeVisible();
  545 |   state.workout.status = 'completed';
  546 |   await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  547 |   await expect(page.getByRole('button', { name: 'Resume saved workout' })).toHaveCount(0);
  548 | });
  549 | 
```