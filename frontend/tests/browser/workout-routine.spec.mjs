import { test, expect } from '@playwright/test';
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
  await page.getByRole('button',{name:'Resume saved workout'}).click();
  await expect(page.getByLabel('Reps, set 1',{exact:true})).toHaveValue('12');
});
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function fixture(page, { fail = false, conflict = false, failComplete = false, delaySave = 0, loseCompletionReply = false, pauseConflict = false, stale = false, staleActive = false } = {}) {
  const exercises = [{ exerciseId: 'push', name: 'Push-up', equipment: 'Bodyweight', prescription: '2 × 12', sets: 2 }, { exerciseId: 'row', name: 'Dumbbell row', equipment: 'Dumbbells', prescription: '1 × 10', sets: 1 }, { exerciseId: 'plank', name: 'Plank', equipment: 'Bodyweight', prescription: '1 × 45 s', sets: 1 }];
  let workout = { _id: 'routine-1', exerciseIds: exercises.map(e => e.exerciseId), exercises, sets: [], revision: 0, startedAt: new Date(Date.now() - (stale ? 678091000 : 0)).toISOString(), status: 'active', pausedSeconds: 0 };
  let failNext = fail, conflictNext = conflict;
  await page.context().addInitScript(() => { localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'routine-user', token: 'test-token' })); });
  await page.context().route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (path.endsWith('/profile')) json = { name: 'Student', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min' };
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
    if (path.endsWith('/complete')) { if(failComplete){failComplete=false;return route.fulfill({status:503,headers,json:{message:'Completion unavailable. Retry.'}});}workout = { ...workout, ...request.postDataJSON(), status: 'completed' }; if(loseCompletionReply){loseCompletionReply=false;return route.fulfill({status:503,headers,json:{message:'Response lost'}});}json = workout; }
    return route.fulfill({ headers, json });
  });
  return { get workout() { return workout; } };
}
async function resume(page) {
  await page.goto('/coach');
  await page.getByRole('button', { name: 'Resume saved workout' }).click();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
}
test('full routine supports bodyweight, skip/revisit, kg correction, and camera-off completion', async ({ page }, info) => {
  const state = await fixture(page);
  await resume(page);
  await expect(page.getByRole('navigation', { name: 'Workout routine' })).toBeVisible();
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save set 2', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dumbbell row', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip exercise' }).click();
  await expect(page.getByRole('heading', { name: 'Plank', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  expect(state.workout.sets.find(s => s.exerciseId === 'plank')).toMatchObject({ reps: 0, durationSeconds: 45 });
  await page.getByRole('button', { name: /Revisit Dumbbell row/ }).click();
  await page.getByLabel('Weight (kg), set 1').fill('20');
  await page.getByRole('button', { name: 'Save set 1', exact: true }).click();
  await page.getByRole('button', { name: /Revisit Dumbbell row/ }).click();
  await page.getByLabel('Weight (kg), set 1').fill('22.5');
  await page.getByRole('button', { name: 'Update set 1', exact: true }).click();
  expect(state.workout.sets.filter(s => s.exerciseId === 'row')).toHaveLength(1);
  expect(state.workout.sets.find(s => s.exerciseId === 'row').loadKg).toBe(22.5);
  await page.screenshot({ path: info.outputPath('routine-390.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout report' })).toBeVisible();
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
  await page.getByRole('button',{name:'Enable camera',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Camera access is blocked'})).toBeVisible();
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
