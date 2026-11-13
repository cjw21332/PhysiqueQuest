import { test, expect } from '@playwright/test';
test('manual workout scrolls to the final exercise and back to its controls', async ({ page }) => {
  await fixture(page);
  await resume(page);
  const scroller = page.locator('.manual-session');
  const bounds = await scroller.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 2500);
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Cancel Workout', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'View Plank', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise' })).toContainText('45 sec');
  await page.mouse.wheel(0, -2500);
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: 'End session', exact: true })).toBeInViewport();
});
test('revisiting a skipped set saves the displayed prescription and clearing weight leaves it blank', async ({ page }) => {
  const state = await fixture(page);
  await resume(page);
  await page.getByRole('button', { name: 'Options for Push-up' }).click();
  await page.getByRole('button', { name: 'Skip exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Revisit Push-up' }).click();
  await expect(page.getByLabel('Reps, set 1', { exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect.poll(() => state.workout.sets.find(row => row.setId === 'push:0')?.reps).toBe(12);
  await page.getByRole('button', { name: 'View Dumbbell Row' }).click();
  await page.getByLabel('Weight (lbs), set 1').click();
  const keypad = page.getByRole('region', { name: 'Weight', exact: true });
  await keypad.getByRole('button', { name: 'Clear' }).click();
  await keypad.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect.poll(() => state.workout.sets.find(row => row.setId === 'row:0')?.status).toBe('completed');
  expect(state.workout.sets.find(row => row.setId === 'row:0')).not.toHaveProperty('loadKg');
});
test('manual workout replaces an unlogged exercise and confirms cancellation', async ({ page }) => {
  const state = await fixture(page);
  await page.route('**/exercises?*', route => route.fulfill({ headers, json: { items: [{ _id: 'press', name: 'Chest press', equipment: 'Dumbbells' }], total: 1 } }));
  await resume(page);
  await page.getByRole('button', { name: 'Options for Dumbbell Row' }).click();
  await page.getByRole('button', { name: 'Replace exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Chest press Dumbbells' }).click();
  await expect(page.getByRole('button', { name: 'Options for Chest Press' })).toBeVisible();
  expect(state.workout.exerciseIds).toEqual(['push', 'press', 'plank']);
  await page.getByRole('button', { name: 'Cancel Workout', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancel workout?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Discard workout' }).click();
  await expect(page.getByRole('button', { name: 'Cancel Workout', exact: true })).toHaveCount(0);
  expect(state.workout.status).toBe('cancelled');
});
test('manual redesign supports numeric keypad, ordinary added sets and persistent names', async ({ page }) => {
  const state = await fixture(page);
  await resume(page);
  await page.getByRole('button', { name: 'View Dumbbell Row', exact: true }).click();
  const weight = page.getByLabel('Weight (lbs), set 1');
  await expect(weight).toBeVisible();
  await weight.click();
  const keypad = page.getByRole('region', { name: 'Weight', exact: true });
  await keypad.getByRole('button', { name: '2', exact: true }).click();
  await keypad.getByRole('button', { name: '0', exact: true }).click();
  await keypad.getByRole('button', { name: 'kg', exact: true }).click();
  await expect(keypad.locator('output')).toContainText('9.07');
  await keypad.getByRole('button', { name: 'lbs', exact: true }).click();
  await expect(keypad.locator('output')).toContainText('20');
  await keypad.getByRole('button', { name: 'kg', exact: true }).click();
  await keypad.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByLabel('Weight (kg), set 1')).toHaveValue('9.07');
  await page.getByLabel('Reps, set 1', { exact: true }).click();
  const reps = page.getByRole('region', { name: 'Reps', exact: true });
  await expect(reps.getByRole('button', { name: 'kg', exact: true })).toHaveCount(0);
  await page.keyboard.type('8e.-');
  await reps.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByLabel('Reps, set 1', { exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: '+ Add Set', exact: true }).click();
  await expect(page.getByLabel('Set type for set 2')).toHaveValue('normal');
  expect(state.workout.exercises.find(row => row.exerciseId === 'row').sets).toBe(2);
  await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  await expect.poll(() => state.workout.sets.find(row => row.setId === 'row:1')?.setType).toBe('normal');
  await page.locator('.manual-title-edit').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Workout session name').fill('Strength Day');
  await page.locator('.manual-title-edit').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Strength Day' })).toBeVisible();
  await page.getByRole('button', { name: 'Options for Dumbbell Row' }).click();
  await page.getByRole('button', { name: 'Rename exercise', exact: true }).click();
  await page.getByRole('dialog', { name: 'Rename exercise' }).getByLabel('Name', { exact: true }).fill('My Row');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Options for My Row' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Strength Day' })).toBeVisible();
  await expect(page.getByLabel('Set type for set 2')).toHaveValue('normal');
  for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
test('PoseTracker options in an active workout preserve manual draft values',async({page})=>{
  const state=await fixture(page);await resume(page);
  await page.getByLabel('Reps, set 1',{exact:true}).fill('17');
  await page.route('**/exercises/push',route=>route.fulfill({json:{_id:'push',name:'Push-up',equipments:['bodyweight'],targetMuscles:['pectorals'],instructions:['Bend elbows']},headers}));
  await page.route('**/pose-tracker/exercises/push',route=>route.fulfill({status:503,json:{message:'Configuration service offline'},headers}));
  await page.getByRole('button',{name:'PoseTracker options for Push-up',exact:true}).click();
  await expect(page.getByRole('region',{name:'PoseTracker exercise tracking'})).toBeVisible();
  await page.getByRole('button',{name:'Back to exercise',exact:true}).click();
  await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveValue('17');expect(state.workout.sets).toHaveLength(0);
});
test('manual logging converts pounds to kilograms and starts rest after saving', async ({ page }) => {
  const state = await fixture(page, { autoEndRest: false });
  await resume(page);
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Rest time' })).toBeVisible();
  const timer = page.getByRole('timer', { name: 'Rest time remaining' });
  const before = await timer.textContent();
  await page.getByRole('button', { name: '+1 min' }).click();
  await expect(timer).not.toHaveText(before);
  await page.getByRole('button', { name: 'End rest' }).click();
  await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  await page.getByRole('button', { name: 'End rest' }).click();
  await page.getByRole('button', { name: 'lbs', exact: true }).click();
  await page.getByLabel('Weight (lbs), set 1').fill('22.0462');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect.poll(() => state.workout.sets.find(set => set.exerciseId === 'row')?.loadKg).toBeCloseTo(10, 2);
  expect(state.workout.sets.find(set => set.exerciseId === 'row')).toMatchObject({ loadValue: 22.0462, loadUnit: 'lbs' });
  await expect(page.getByRole('timer', { name: 'Rest time remaining' })).toBeVisible();
  await page.getByRole('button', { name: 'End rest' }).click();
  await expect(page.getByRole('dialog', { name: 'Rest time' })).not.toBeVisible();
});
test('manual session saves set type, exercise order and per-exercise rest', async ({ page }) => {
  const state = await fixture(page);
  await resume(page);
  await expect(page.getByLabel('Weight unit for Push-up')).toBeVisible();
  await page.getByLabel('Set type for set 1').selectOption('warmup');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect.poll(() => state.workout.sets[0]?.setType).toBe('warmup');
  await page.getByRole('button', { name: 'Reorder Dumbbell Row' }).click();
  await page.getByRole('button', { name: 'Move up' }).click();
  await expect.poll(() => state.workout.exerciseIds).toEqual(['row', 'push', 'plank']);
  await page.getByRole('button', { name: 'Options for Dumbbell Row' }).click();
  await page.getByRole('button', { name: 'Increase between sets rest for Dumbbell Row' }).click();
  await expect.poll(() => state.workout.exercises.find(item => item.exerciseId === 'row')?.restBetweenSets).toBe(105);
  await page.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove this exercise?' }).getByRole('button', { name: 'Remove exercise' }).click();
  await expect.poll(() => state.workout.exerciseIds).toEqual(['push', 'plank']);
  await page.reload();
  await expect(page.getByLabel('Set type for set 1')).toHaveValue('warmup');
  await expect(page.getByRole('button', { name: 'Options for Dumbbell Row' })).toHaveCount(0);
});
test('lost completion response recovers the completed report',async({page})=>{
  const state=await fixture(page,{loseCompletionReply:true});
  await resume(page);
  await page.getByRole('button',{name:'End session',exact:true}).click();
  await page.getByRole('button',{name:'Save and end workout'}).click();
  await expect(page.getByRole('heading',{name:'Workout report'})).toBeVisible();
  expect(state.workout.status).toBe('completed');
});
test('conflict recovery adopts the server pause state',async({page})=>{
  await fixture(page,{conflict:true,pauseConflict:true});
  await resume(page);
  await page.getByRole('button',{name:'Save set 1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save set 1',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
});
test('malformed and other-account drafts do not replace confirmed state',async({page})=>{
  await fixture(page);
  await resume(page);
  await page.getByLabel('Reps, set 1',{exact:true}).fill('99');
  await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(key=>key.startsWith('physiquequest-workout-draft:'));
    localStorage.setItem(key.replace(':routine-user:',':other-user:'),localStorage.getItem(key));
    localStorage.setItem(key,'{broken');
  });
  await page.reload();
  // The active-session route now restores its workout directly on reload.
  await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveValue('12');
});
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function fixture(page, { fail = false, conflict = false, failComplete = false, delaySave = 0, loseCompletionReply = false, pauseConflict = false, stale = false, staleActive = false, autoEndRest = true, transientReads = false } = {}) {
  if (autoEndRest) await page.addLocatorHandler(page.getByRole('dialog', { name: 'Rest time' }), async dialog => { await dialog.getByRole('button', { name: 'End rest' }).click(); });
  const exercises = [{ exerciseId: 'push', name: 'Push-up', equipment: 'Bodyweight', prescription: '2 × 12', sets: 2 }, { exerciseId: 'row', name: 'Dumbbell row', equipment: 'Dumbbells', prescription: '1 × 10', sets: 1 }, { exerciseId: 'plank', name: 'Plank', equipment: 'Bodyweight', prescription: '1 × 45 s', sets: 1 }];
  let workout = { _id: 'routine-1', exerciseIds: exercises.map(e => e.exerciseId), exercises, sets: [], revision: 0, startedAt: new Date(Date.now() - (stale ? 678091000 : 0)).toISOString(), status: 'active', pausedSeconds: 0 };
  let failNext = fail, conflictNext = conflict;
  const reads = { profile: 0, nutrition: 0 };
  await page.context().addInitScript(() => { localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'routine-user', token: 'test-token' })); });
  await page.context().route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    const resource = path.endsWith('/profile') ? 'profile' : path.endsWith('/nutrition') ? 'nutrition' : null;
    if (resource && request.method() === 'GET') {
      reads[resource]++;
      if (transientReads && reads[resource] === 1) return route.fulfill({ status: 500, headers, json: { message: 'Temporary error' } });
    }
    if (path.endsWith('/auth/session/migrate') || path.endsWith('/auth/session/refresh')) json = { access_token: 'test-token', expires_in: 3600, user: { id: 'routine-user', name: 'Student', email: 'student@example.test', emailVerified: true } };
    if (path.endsWith('/profile')) json = { name: 'Student', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min' };
    if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
    if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
    if (path.endsWith('/coach/plan')) json = { days: [], libraryReady: true };
    if (path.endsWith('/auth/me')) json = { role: 'user' };
    if (path.endsWith('/workouts/active')) json = staleActive ? { ...workout, status: 'active' } : workout.status === 'active' ? workout : null;
    if (path.endsWith('/workouts/routine-1')) json = workout;
    if (path.endsWith('/pause')) { const data = request.postDataJSON(); workout = { ...workout, pausedAt: data.paused ? data.occurredAt : null, revision: workout.revision + 1 }; json = workout; }
    if (path.endsWith('/sets')) {
      if(delaySave) await new Promise(resolve=>setTimeout(resolve,delaySave));
      if (failNext) { failNext = false; return route.fulfill({ status: 503, headers, json: { message: 'Set save unavailable. Retry.' } }); }
      if (conflictNext) { conflictNext = false; workout.revision++; if(pauseConflict)workout.pausedAt=new Date().toISOString(); return route.fulfill({ status: 409, headers, json: { message: 'Workout changed. Reload.' } }); }
      const data = request.postDataJSON();
      if (data.expectedRevision !== workout.revision) return route.fulfill({ status: 409, headers, json: { message: 'Revision conflict' } });
      workout = { ...workout, sets: [...workout.sets.filter(s => s.setId !== data.result.setId), data.result], revision: workout.revision + 1 }; json = workout;
    }
    if (path.endsWith('/routine')) { const data = request.postDataJSON(); const saved = workout.exercises; workout = { ...workout, routineName: data.routineName ?? workout.routineName, exercises: data.exercises.map(item => ({ ...saved.find(row => row.exerciseId === item.exerciseId), ...item })), exerciseIds: data.exercises.map(item => item.exerciseId), revision: workout.revision + 1 }; json = workout; }
    if (path.endsWith('/cancel')) { workout = { ...workout, status: 'cancelled' }; json = { cancelled: true }; }
    if (path.endsWith('/complete')) { if(failComplete){failComplete=false;return route.fulfill({status:503,headers,json:{message:'Completion unavailable. Retry.'}});}workout = { ...workout, ...request.postDataJSON(), status: 'completed' }; if(loseCompletionReply){loseCompletionReply=false;return route.fulfill({status:503,headers,json:{message:'Response lost'}});}json = workout; }
    return route.fulfill({ headers, json });
  });
  return { get workout() { return workout; }, reads };
}
test('profile and nutrition reads recover from a temporary server error', async ({ page }) => {
  const state = await fixture(page, { transientReads: true });
  await page.goto('/scan');
  await expect.poll(() => state.reads.profile).toBeGreaterThanOrEqual(2);
  await expect.poll(() => state.reads.nutrition).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('heading', { name: /nutrition/i }).first()).toBeVisible();
});
test('Phiq keeps data sharing optional, hides sources and clears its conversation', async ({ page }) => {
  await fixture(page);
  const requests = [];
  let refreshOnce = true;
  await page.route('**/api/chat', route => {
    requests.push(route.request().postDataJSON());
    if (refreshOnce) { refreshOnce = false; return route.fulfill({ status: 401, headers, json: { message: 'Refresh session' } }); }
    const personal = route.request().postDataJSON().includePersonalData;
    return route.fulfill({ json: { reply: personal ? 'Your saved workouts are available.\n\nSources: Your workouts. Your saved goals and preferences.' : 'Coach supports manual set logging.', sources: [{ id: personal ? 'workouts' : 'coach', label: personal ? 'Your workouts' : 'Coach guide' }], privacy: { personalDataIncluded: personal, historyStored: false, provider: 'self-hosted' } }, headers });
  });
  await page.goto('/coach');
  const launcher = page.getByRole('button', { name: 'Open Phiq coach' });
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Phiq' });
  await expect(dialog).toBeVisible();
  const input = dialog.getByLabel('Ask Phiq a question');
  const consent = dialog.getByRole('checkbox', { name: 'Use my saved fitness data' });
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const box = await dialog.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(size.height * .8 - 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    await expect(input).toBeInViewport();
  }
  await dialog.getByText('What can Phiq access?', { exact: true }).click();
  await expect(dialog.locator('.coach-chat-access-details p')).toContainText(/private AI service, not an external AI provider/i);
  await dialog.getByText('What can Phiq access?', { exact: true }).click();
  await expect(consent).not.toBeChecked();
  await input.fill('How does Coach work?');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.getByText('Coach supports manual set logging.')).toBeVisible();
  await expect(dialog.getByRole('list', { name: 'Reply sources' })).toHaveCount(0);
  await expect(dialog.getByText('Coach guide', { exact: true })).toHaveCount(0);
  expect(requests[0].includePersonalData).toBe(false);
  expect(requests[0].page).toBe('/coach');
  // Refreshing the same account must preserve its in-memory conversation.
  await expect(dialog.getByText('How does Coach work?', { exact: true })).toBeVisible();
  await consent.check();
  await expect(dialog.getByText('Coach supports manual set logging.')).toHaveCount(0);
  await input.fill('What workouts have I saved?');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.getByText('Your saved workouts are available.')).toBeVisible();
  await expect(dialog.getByRole('list', { name: 'Reply sources' })).toHaveCount(0);
  await expect(dialog.getByText(/Sources:|Your saved goals and preferences/)).toHaveCount(0);
  expect(requests.at(-1)).toEqual({ messages: [{ role: 'user', text: 'What workouts have I saved?' }], includePersonalData: true, page: '/coach' });
  await dialog.getByRole('button', { name: 'Clear chat' }).click();
  await expect(dialog.getByText('Your saved workouts are available.')).toHaveCount(0);
  await expect(dialog.getByRole('list', { name: 'Reply sources' })).toHaveCount(0);
  await page.route('**/api/chat', route => route.fulfill({ status: 503, headers, json: { message: 'Internal model host secret detail' } }));
  await input.fill('How does Scan work?');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Phiq’s private AI is unavailable right now. Please try again later.');
  await expect(dialog.getByText('Internal model host secret detail')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
});
test('Phiq drops an in-flight response when consent changes', async ({ page }) => {
  await fixture(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let finished;
  const completed = new Promise(resolve => { finished = resolve; });
  const requests = [];
  await page.route('**/api/chat', async route => {
    requests.push(route.request().postDataJSON());
    const first = requests.length === 1;
    if (first) await pending;
    await route.fulfill({ headers, json: { reply: first ? 'Old private response' : 'Fresh guide response', sources: [], privacy: { personalDataIncluded: first, historyStored: false, provider: 'self-hosted' } } });
    finished();
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Open Phiq coach' }).click();
  const dialog = page.getByRole('dialog', { name: 'Phiq' });
  const consent = dialog.getByRole('checkbox', { name: 'Use my saved fitness data' });
  await consent.check();
  await dialog.getByLabel('Ask Phiq a question').fill('Show my progress');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.getByRole('status')).toContainText('thinking');
  await consent.uncheck();
  release();
  await completed;
  await dialog.getByLabel('Ask Phiq a question').fill('How does Scan work?');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.getByText('Fresh guide response')).toBeVisible();
  expect(requests.at(-1)).toEqual({ messages: [{ role: 'user', text: 'How does Scan work?' }], includePersonalData: false, page: '/coach' });
  await expect(dialog.getByText('Old private response')).toHaveCount(0);
  await expect(dialog.getByText('Show my progress', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Ask Phiq a question')).toBeEnabled();
});
test('Phiq resets consent and history when a refreshed session belongs to another account', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/auth/session/refresh', route => route.fulfill({ headers, json: { access_token: 'other-token', expires_in: 3600, user: { id: 'other-account', name: 'Other user', email: 'other@example.test', emailVerified: true } } }));
  let calls = 0;
  await page.route('**/api/chat', route => {
    calls++;
    return route.fulfill(calls === 1 ? { status: 401, headers, json: { message: 'Refresh session' } } : { headers, json: { reply: 'Late account response', sources: [], privacy: { personalDataIncluded: true, historyStored: false, provider: 'self-hosted' } } });
  });
  await page.goto('/coach');
  const launcher = page.getByRole('button', { name: 'Open Phiq coach' });
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Phiq' });
  await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  await dialog.getByLabel('Ask Phiq a question').fill('Private account question');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog).not.toBeVisible();
  await launcher.click();
  await expect(dialog.getByRole('checkbox', { name: 'Use my saved fitness data' })).not.toBeChecked();
  await expect(dialog.getByText('Private account question', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Late account response')).toHaveCount(0);
  expect(calls).toBe(1);
});
test('Phiq cancels waiting, restores the draft and ignores a late response', async ({ page }) => {
  await fixture(page);
  let release, finish;
  const delayed = new Promise(resolve => { release = resolve; });
  const completed = new Promise(resolve => { finish = resolve; });
  await page.route('**/api/chat', async route => {
    await delayed;
    try { await route.fulfill({ headers, json: { reply: 'Old response that should not appear', sources: [] } }); }
    finally { finish(); }
  });
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Open Phiq coach' }).click();
  const dialog = page.getByRole('dialog', { name: 'Phiq' });
  const input = dialog.getByLabel('Ask Phiq a question');
  await input.fill('Explain my current workout');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Phiq is thinking…');
  const cancelled = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname.endsWith('/chat') });
  await dialog.getByRole('button', { name: 'Stop waiting' }).click();
  await cancelled;
  await expect(input).toHaveValue('Explain my current workout');
  await expect(input).toBeEnabled();
  await expect(dialog.getByRole('status')).toContainText('Stopped waiting');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  release();
  await completed;
  await expect(dialog.getByText('Old response that should not appear', { exact: true })).toHaveCount(0);
});
for (const path of ['/home/notifications', '/coach', '/scan/history', '/quests', '/me/training']) {
  test(`Phiq page help sends the current pathname on ${path}`, async ({ page }) => {
    await fixture(page);
    let submitted;
    await page.route('**/api/chat', route => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ headers, json: { reply: 'This page is part of PhysiqueQuest.', sources: [{ id: 'internal-only', label: 'Hidden internal reference' }] } });
    });
    await page.goto(path);
    await page.getByRole('button', { name: 'Open Phiq coach' }).click();
    const dialog = page.getByRole('dialog', { name: 'Phiq' });
    await dialog.getByRole('button', { name: 'Explain this page', exact: true }).click();
    await expect(dialog.getByText('This page is part of PhysiqueQuest.', { exact: true })).toBeVisible();
    expect(submitted).toEqual({ messages: [{ role: 'user', text: 'How do I use this page?' }], includePersonalData: false, page: path });
    await expect(dialog.getByText('Hidden internal reference', { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('list', { name: 'Reply sources' })).toHaveCount(0);
  });
}
async function resume(page) {
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Resume saved workout' }).click();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
}
test('account pages support direct links and browser history', async ({ page }) => {
  await fixture(page);
  await page.goto('/me');
  await page.getByRole('button', { name: /Personal data/ }).click();
  await expect(page).toHaveURL(/\/me\/personal-data$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/me$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/me\/personal-data$/);
  await page.reload();
  await expect(page).toHaveURL(/\/me\/personal-data$/);
  await expect(page.getByText('Personal data', { exact: true }).first()).toBeVisible();
});
test('full routine supports bodyweight, skip/revisit, kg correction, and camera-off completion', async ({ page }, info) => {
  const state = await fixture(page);
  await resume(page);
  await expect(page.getByRole('navigation', { name: 'Workout routine' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Dumbbell Row' })).toBeVisible();
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Dumbbell row' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Skip exercise' }).click();
  await expect(page.getByRole('button', { name: 'View Plank' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  expect(state.workout.sets.find(s => s.exerciseId === 'plank')).toMatchObject({ reps: 0, durationSeconds: 45 });
  await page.getByRole('button', { name: /Revisit Dumbbell row/i }).click();
  await page.getByLabel('Weight (kg), set 1').fill('20');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await page.getByLabel('Weight (kg), set 1').fill('22.5');
  await page.getByRole('button', { name: 'Update set 1', exact: true }).click();
  expect(state.workout.sets.filter(s => s.exerciseId === 'row')).toHaveLength(1);
  expect(state.workout.sets.find(s => s.exerciseId === 'row').loadKg).toBe(22.5);
  await page.screenshot({ path: info.outputPath('routine-390.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  await expect(page).toHaveURL(/\/coach\/report$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exercise breakdown' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workout summary' })).toContainText('Sets logged');
  await expect(page.getByRole('region', { name: 'Confirmed results' })).toContainText('Dumbbell Row');
  await expect(page.getByText(/form analysis|form errors/i)).toHaveCount(0);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`workout-report-${width}.png`), animations: 'disabled' });
  }
});
test('failed save retains input and retry saves once; pause preserves the current draft', async ({ page }) => {
  const state = await fixture(page, { fail: true });
  await resume(page);
  await page.getByLabel('Reps, set 1', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Set save unavailable' })).toBeVisible();
  await expect(page.getByLabel('Reps, set 1', { exact: true })).toHaveValue('9');
  await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save set 1', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  expect(state.workout.sets).toHaveLength(1);
  expect(state.workout.sets[0].reps).toBe(9);
});
test('reopen restores server sets and unsaved device inputs; ending early confirms skipped work', async ({ page }) => {
  const state = await fixture(page);
  await resume(page);
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await page.getByLabel('Reps, set 2', { exact: true }).fill('8');
  const context=page.context();
  await page.close();
  page=await context.newPage();
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Resume saved workout' }).click();
  await expect(page.getByLabel('Reps, set 2', { exact: true })).toHaveValue('8');
  await expect(page.getByRole('button', { name: 'Update set 1', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'End workout early?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep training' }).click();
  expect(state.workout.status).toBe('active');
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Save and end workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  expect(state.workout.sets.filter(s => s.status === 'completed')).toHaveLength(1);
  expect(state.workout.sets.filter(s => s.status === 'skipped')).toHaveLength(3);
});

test('camera denial never blocks routine logging and controls meet phone target sizes', async ({page},info)=>{
  const state=await fixture(page);
  await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
  await resume(page);
  await page.route('**/exercises/push',route=>route.fulfill({json:{_id:'push',name:'Push-up',equipments:['bodyweight'],targetMuscles:['pectorals'],instructions:['Bend elbows']},headers}));
  await page.route('**/pose-tracker/exercises/push',route=>route.fulfill({status:503,json:{message:'Configuration unavailable'},headers}));
  await page.route('**/pose-tracker/exercises/push/launch',route=>route.fulfill({json:{config:{exerciseId:'push',name:'Push-up',trackingMode:'builtin',providerExerciseId:'push_up',validationStatus:'documentation-mapped',cameraOrientation:'side',targetMuscles:['pectorals'],equipment:['bodyweight'],capabilities:['repetitions'],limitations:[]},token:'mock-only',developerOutputs:false},headers}));
  await page.route('https://app.posetracker.com/pose_tracker/tracking?**',route=>route.fulfill({contentType:'text/html',body:'<script>parent.postMessage(JSON.stringify({type:"error",error:"NotAllowedError",message:"Camera permission denied"}),"*")</script>'}));
  await page.getByRole('button',{name:'PoseTracker options for Push-up'}).click();
  await page.getByRole('button',{name:'Start PoseTracker',exact:true}).click();
  await expect(page.locator('.pose-tracker-session [role=alert]')).toContainText('Camera permission denied');
  await page.getByRole('button',{name:'Back to exercise',exact:true}).click();
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:844});
    for(const button of await page.locator('.routine-current button').all()) { const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44); }
    await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveAttribute('inputmode','numeric');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`routine-camera-off-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Save set 1',exact:true}).click();
  expect(state.workout.sets[0].reps).toBe(12);
});

test('repeated clicks cannot double-save and failed early completion stays recoverable',async({page})=>{
  const state=await fixture(page,{delaySave:250,failComplete:true});
  await resume(page);
  await page.getByRole('button',{name:'Save set 1',exact:true}).dblclick();
  await expect.poll(()=>state.workout.sets.length).toBe(1);
  await page.getByRole('button',{name:'End session',exact:true}).click();
  await page.getByRole('button',{name:'Save and end workout'}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Completion unavailable');
  expect(state.workout.status).toBe('active');
  await page.getByRole('button',{name:'Save and end workout'}).click();
  await expect(page.getByRole('heading',{name:'Workout report'})).toBeVisible();
  expect(state.workout.sets).toHaveLength(4);
});
test('revision conflicts refresh confirmed state and preserve the draft for explicit retry', async ({ page }) => {
  const state = await fixture(page, { conflict: true });
  await resume(page);
  await page.getByLabel('Reps, set 1', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /Reload|changed/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  expect(state.workout.sets[0].reps).toBe(7);
});
test('an abandoned workout older than 24 hours can still end without sending a duration counter', async ({ page }) => {
  const state = await fixture(page, { stale: true });
  await resume(page);
  const request = page.waitForRequest(request => request.url().endsWith('/complete'));
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Save and end workout' }).click();
  expect((await request).postDataJSON()).not.toHaveProperty('durationSeconds');
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  expect(state.workout.status).toBe('completed');
  expect(state.workout.sets).toHaveLength(4);
});
test('ending a workout clears recovery after report Back and after reload, even with a stale active response', async ({ page }) => {
  await fixture(page, { staleActive: true });
  await resume(page);
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Save and end workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to AI Coach', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workout in progress' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'AI Coach', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume saved workout' })).toHaveCount(0);
});
test('returning focus removes a workout completed on another screen', async ({ page }) => {
  const state = await fixture(page, { staleActive: true });
  await page.goto('/coach');
  await expect(page.getByRole('button', { name: 'Resume saved workout' })).toBeVisible();
  state.workout.status = 'completed';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Resume saved workout' })).toHaveCount(0);
});
