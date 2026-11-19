# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workout-routine.spec.mjs >> PoseTracker options in an active workout preserve manual draft values
- Location: tests\browser\workout-routine.spec.mjs:97:1

# Error details

```
Test timeout of 20000ms exceeded.
```

```
Error: locator.click: Test timeout of 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'PoseTracker options for Push-up', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
          - generic "Elapsed time" [ref=e20]: 00:19 Total workout time
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
                    - textbox "Reps, set 1" [active] [ref=e67]: "17"
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
  2   | test('manual workout scrolls to the final exercise and back to its controls', async ({ page }) => {
  3   |   await fixture(page);
  4   |   await resume(page);
  5   |   const scroller = page.locator('.manual-session');
  6   |   const bounds = await scroller.boundingBox();
  7   |   expect(bounds).not.toBeNull();
  8   |   await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  9   |   await page.mouse.wheel(0, 2500);
  10  |   await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  11  |   await expect(page.getByRole('button', { name: 'Cancel Workout', exact: true })).toBeInViewport();
  12  |   await page.getByRole('button', { name: 'View Plank', exact: true }).click();
  13  |   await expect(page.getByRole('region', { name: 'Current exercise' })).toContainText('45 sec');
  14  |   await page.mouse.wheel(0, -2500);
  15  |   await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(0);
  16  |   await expect(page.getByRole('button', { name: 'End session', exact: true })).toBeInViewport();
  17  | });
  18  | test('revisiting a skipped set saves the displayed prescription and clearing weight leaves it blank', async ({ page }) => {
  19  |   const state = await fixture(page);
  20  |   await resume(page);
  21  |   await page.getByRole('button', { name: 'Options for Push-up' }).click();
  22  |   await page.getByRole('button', { name: 'Skip exercise', exact: true }).click();
  23  |   await page.getByRole('button', { name: 'Revisit Push-up' }).click();
  24  |   await expect(page.getByLabel('Reps, set 1', { exact: true })).toHaveValue('12');
  25  |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  26  |   await expect.poll(() => state.workout.sets.find(row => row.setId === 'push:0')?.reps).toBe(12);
  27  |   await page.getByRole('button', { name: 'View Dumbbell Row' }).click();
  28  |   await page.getByLabel('Weight (lbs), set 1').click();
  29  |   const keypad = page.getByRole('region', { name: 'Weight', exact: true });
  30  |   await keypad.getByRole('button', { name: 'Clear' }).click();
  31  |   await keypad.getByRole('button', { name: 'Done' }).click();
  32  |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  33  |   await expect.poll(() => state.workout.sets.find(row => row.setId === 'row:0')?.status).toBe('completed');
  34  |   expect(state.workout.sets.find(row => row.setId === 'row:0')).not.toHaveProperty('loadKg');
  35  | });
  36  | test('manual workout replaces an unlogged exercise and confirms cancellation', async ({ page }) => {
  37  |   const state = await fixture(page);
  38  |   await page.route('**/exercises?*', route => route.fulfill({ headers, json: { items: [{ _id: 'press', name: 'Chest press', equipment: 'Dumbbells' }], total: 1 } }));
  39  |   await resume(page);
  40  |   await page.getByRole('button', { name: 'Options for Dumbbell Row' }).click();
  41  |   await page.getByRole('button', { name: 'Replace exercise', exact: true }).click();
  42  |   await page.getByRole('button', { name: 'Chest press Dumbbells' }).click();
  43  |   await expect(page.getByRole('button', { name: 'Options for Chest Press' })).toBeVisible();
  44  |   expect(state.workout.exerciseIds).toEqual(['push', 'press', 'plank']);
  45  |   await page.getByRole('button', { name: 'Cancel Workout', exact: true }).click();
  46  |   const confirm = page.getByRole('dialog', { name: 'Cancel workout?' });
  47  |   await expect(confirm).toBeVisible();
  48  |   await confirm.getByRole('button', { name: 'Discard workout' }).click();
  49  |   await expect(page.getByRole('button', { name: 'Cancel Workout', exact: true })).toHaveCount(0);
  50  |   expect(state.workout.status).toBe('cancelled');
  51  | });
  52  | test('manual redesign supports numeric keypad, ordinary added sets and persistent names', async ({ page }) => {
  53  |   const state = await fixture(page);
  54  |   await resume(page);
  55  |   await page.getByRole('button', { name: 'View Dumbbell Row', exact: true }).click();
  56  |   const weight = page.getByLabel('Weight (lbs), set 1');
  57  |   await expect(weight).toBeVisible();
  58  |   await weight.click();
  59  |   const keypad = page.getByRole('region', { name: 'Weight', exact: true });
  60  |   await keypad.getByRole('button', { name: '2', exact: true }).click();
  61  |   await keypad.getByRole('button', { name: '0', exact: true }).click();
  62  |   await keypad.getByRole('button', { name: 'kg', exact: true }).click();
  63  |   await expect(keypad.locator('output')).toContainText('9.07');
  64  |   await keypad.getByRole('button', { name: 'lbs', exact: true }).click();
  65  |   await expect(keypad.locator('output')).toContainText('20');
  66  |   await keypad.getByRole('button', { name: 'kg', exact: true }).click();
  67  |   await keypad.getByRole('button', { name: 'Done', exact: true }).click();
  68  |   await expect(page.getByLabel('Weight (kg), set 1')).toHaveValue('9.07');
  69  |   await page.getByLabel('Reps, set 1', { exact: true }).click();
  70  |   const reps = page.getByRole('region', { name: 'Reps', exact: true });
  71  |   await expect(reps.getByRole('button', { name: 'kg', exact: true })).toHaveCount(0);
  72  |   await page.keyboard.type('8e.-');
  73  |   await reps.getByRole('button', { name: 'Done', exact: true }).click();
  74  |   await expect(page.getByLabel('Reps, set 1', { exact: true })).toHaveValue('8');
  75  |   await page.getByRole('button', { name: '+ Add Set', exact: true }).click();
  76  |   await expect(page.getByLabel('Set type for set 2')).toHaveValue('normal');
  77  |   expect(state.workout.exercises.find(row => row.exerciseId === 'row').sets).toBe(2);
  78  |   await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  79  |   await expect.poll(() => state.workout.sets.find(row => row.setId === 'row:1')?.setType).toBe('normal');
  80  |   await page.locator('.manual-title-edit').getByRole('button', { name: 'Edit', exact: true }).click();
  81  |   await page.getByLabel('Workout session name').fill('Strength Day');
  82  |   await page.locator('.manual-title-edit').getByRole('button', { name: 'Save', exact: true }).click();
  83  |   await expect(page.getByRole('heading', { name: 'Strength Day' })).toBeVisible();
  84  |   await page.getByRole('button', { name: 'Options for Dumbbell Row' }).click();
  85  |   await page.getByRole('button', { name: 'Rename exercise', exact: true }).click();
  86  |   await page.getByRole('dialog', { name: 'Rename exercise' }).getByLabel('Name', { exact: true }).fill('My Row');
  87  |   await page.getByRole('button', { name: 'Save name', exact: true }).click();
  88  |   await expect(page.getByRole('button', { name: 'Options for My Row' })).toBeVisible();
  89  |   await page.reload();
  90  |   await expect(page.getByRole('heading', { name: 'Strength Day' })).toBeVisible();
  91  |   await expect(page.getByLabel('Set type for set 2')).toHaveValue('normal');
  92  |   for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
  93  |     await page.setViewportSize(viewport);
  94  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  95  |   }
  96  | });
  97  | test('PoseTracker options in an active workout preserve manual draft values',async({page})=>{
  98  |   const state=await fixture(page);await resume(page);
  99  |   await page.getByLabel('Reps, set 1',{exact:true}).fill('17');
  100 |   await page.route('**/exercises/push',route=>route.fulfill({json:{_id:'push',name:'Push-up',equipments:['bodyweight'],targetMuscles:['pectorals'],instructions:['Bend elbows']},headers}));
  101 |   await page.route('**/pose-tracker/exercises/push',route=>route.fulfill({status:503,json:{message:'Configuration service offline'},headers}));
> 102 |   await page.getByRole('button',{name:'PoseTracker options for Push-up',exact:true}).click();
      |                                                                                      ^ Error: locator.click: Test timeout of 20000ms exceeded.
  103 |   await expect(page.getByRole('region',{name:'PoseTracker exercise tracking'})).toBeVisible();
  104 |   await page.getByRole('button',{name:'Back to exercise',exact:true}).click();
  105 |   await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveValue('17');expect(state.workout.sets).toHaveLength(0);
  106 | });
  107 | test('manual logging converts pounds to kilograms and starts rest after saving', async ({ page }) => {
  108 |   const state = await fixture(page, { autoEndRest: false });
  109 |   await resume(page);
  110 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  111 |   await expect(page.getByRole('dialog', { name: 'Rest time' })).toBeVisible();
  112 |   const timer = page.getByRole('timer', { name: 'Rest time remaining' });
  113 |   const before = await timer.textContent();
  114 |   await page.getByRole('button', { name: '+1 min' }).click();
  115 |   await expect(timer).not.toHaveText(before);
  116 |   await page.getByRole('button', { name: 'End rest' }).click();
  117 |   await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  118 |   await page.getByRole('button', { name: 'End rest' }).click();
  119 |   await page.getByRole('button', { name: 'lbs', exact: true }).click();
  120 |   await page.getByLabel('Weight (lbs), set 1').fill('22.0462');
  121 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  122 |   await expect.poll(() => state.workout.sets.find(set => set.exerciseId === 'row')?.loadKg).toBeCloseTo(10, 2);
  123 |   await expect(page.getByRole('timer', { name: 'Rest time remaining' })).toBeVisible();
  124 |   await page.getByRole('button', { name: 'End rest' }).click();
  125 |   await expect(page.getByRole('dialog', { name: 'Rest time' })).not.toBeVisible();
  126 | });
  127 | test('manual session saves set type, exercise order and per-exercise rest', async ({ page }) => {
  128 |   const state = await fixture(page);
  129 |   await resume(page);
  130 |   await expect(page.getByLabel('Weight unit for Push-up')).toBeVisible();
  131 |   await page.getByLabel('Set type for set 1').selectOption('warmup');
  132 |   await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  133 |   await expect.poll(() => state.workout.sets[0]?.setType).toBe('warmup');
  134 |   await page.getByRole('button', { name: 'Reorder Dumbbell Row' }).click();
  135 |   await page.getByRole('button', { name: 'Move up' }).click();
  136 |   await expect.poll(() => state.workout.exerciseIds).toEqual(['row', 'push', 'plank']);
  137 |   await page.getByRole('button', { name: 'Options for Dumbbell Row' }).click();
  138 |   await page.getByRole('button', { name: 'Increase between sets rest for Dumbbell Row' }).click();
  139 |   await expect.poll(() => state.workout.exercises.find(item => item.exerciseId === 'row')?.restBetweenSets).toBe(105);
  140 |   await page.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  141 |   await page.getByRole('dialog', { name: 'Remove this exercise?' }).getByRole('button', { name: 'Remove exercise' }).click();
  142 |   await expect.poll(() => state.workout.exerciseIds).toEqual(['push', 'plank']);
  143 |   await page.reload();
  144 |   await expect(page.getByLabel('Set type for set 1')).toHaveValue('warmup');
  145 |   await expect(page.getByRole('button', { name: 'Options for Dumbbell Row' })).toHaveCount(0);
  146 | });
  147 | test('lost completion response recovers the completed report',async({page})=>{
  148 |   const state=await fixture(page,{loseCompletionReply:true});
  149 |   await resume(page);
  150 |   await page.getByRole('button',{name:'End session',exact:true}).click();
  151 |   await page.getByRole('button',{name:'Save and end workout'}).click();
  152 |   await expect(page.getByRole('heading',{name:'Workout report'})).toBeVisible();
  153 |   expect(state.workout.status).toBe('completed');
  154 | });
  155 | test('conflict recovery adopts the server pause state',async({page})=>{
  156 |   await fixture(page,{conflict:true,pauseConflict:true});
  157 |   await resume(page);
  158 |   await page.getByRole('button',{name:'Save set 1',exact:true}).click();
  159 |   await expect(page.getByRole('button',{name:'Save set 1',exact:true})).toBeDisabled();
  160 |   await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
  161 | });
  162 | test('malformed and other-account drafts do not replace confirmed state',async({page})=>{
  163 |   await fixture(page);
  164 |   await resume(page);
  165 |   await page.getByLabel('Reps, set 1',{exact:true}).fill('99');
  166 |   await page.evaluate(()=>{
  167 |     const key=Object.keys(localStorage).find(key=>key.startsWith('physiquequest-workout-draft:'));
  168 |     localStorage.setItem(key.replace(':routine-user:',':other-user:'),localStorage.getItem(key));
  169 |     localStorage.setItem(key,'{broken');
  170 |   });
  171 |   await page.reload();
  172 |   // The active-session route now restores its workout directly on reload.
  173 |   await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveValue('12');
  174 | });
  175 | const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  176 | async function fixture(page, { fail = false, conflict = false, failComplete = false, delaySave = 0, loseCompletionReply = false, pauseConflict = false, stale = false, staleActive = false, autoEndRest = true, transientReads = false } = {}) {
  177 |   if (autoEndRest) await page.addLocatorHandler(page.getByRole('dialog', { name: 'Rest time' }), async dialog => { await dialog.getByRole('button', { name: 'End rest' }).click(); });
  178 |   const exercises = [{ exerciseId: 'push', name: 'Push-up', equipment: 'Bodyweight', prescription: '2 × 12', sets: 2 }, { exerciseId: 'row', name: 'Dumbbell row', equipment: 'Dumbbells', prescription: '1 × 10', sets: 1 }, { exerciseId: 'plank', name: 'Plank', equipment: 'Bodyweight', prescription: '1 × 45 s', sets: 1 }];
  179 |   let workout = { _id: 'routine-1', exerciseIds: exercises.map(e => e.exerciseId), exercises, sets: [], revision: 0, startedAt: new Date(Date.now() - (stale ? 678091000 : 0)).toISOString(), status: 'active', pausedSeconds: 0 };
  180 |   let failNext = fail, conflictNext = conflict;
  181 |   const reads = { profile: 0, nutrition: 0 };
  182 |   await page.context().addInitScript(() => { localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'routine-user', token: 'test-token' })); });
  183 |   await page.context().route('**/api/**', async route => {
  184 |     const request = route.request(), path = new URL(request.url()).pathname;
  185 |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  186 |     let json = {};
  187 |     const resource = path.endsWith('/profile') ? 'profile' : path.endsWith('/nutrition') ? 'nutrition' : null;
  188 |     if (resource && request.method() === 'GET') {
  189 |       reads[resource]++;
  190 |       if (transientReads && reads[resource] === 1) return route.fulfill({ status: 500, headers, json: { message: 'Temporary error' } });
  191 |     }
  192 |     if (path.endsWith('/auth/session/migrate') || path.endsWith('/auth/session/refresh')) json = { access_token: 'test-token', expires_in: 3600, user: { id: 'routine-user', name: 'Student', email: 'student@example.test', emailVerified: true } };
  193 |     if (path.endsWith('/profile')) json = { name: 'Student', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min' };
  194 |     if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
  195 |     if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
  196 |     if (path.endsWith('/coach/plan')) json = { days: [], libraryReady: true };
  197 |     if (path.endsWith('/auth/me')) json = { role: 'user' };
  198 |     if (path.endsWith('/workouts/active')) json = staleActive ? { ...workout, status: 'active' } : workout.status === 'active' ? workout : null;
  199 |     if (path.endsWith('/workouts/routine-1')) json = workout;
  200 |     if (path.endsWith('/pause')) { const data = request.postDataJSON(); workout = { ...workout, pausedAt: data.paused ? data.occurredAt : null, revision: workout.revision + 1 }; json = workout; }
  201 |     if (path.endsWith('/sets')) {
  202 |       if(delaySave) await new Promise(resolve=>setTimeout(resolve,delaySave));
```