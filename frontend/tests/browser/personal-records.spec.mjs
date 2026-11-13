import { test, expect } from '@playwright/test';

test('records preserve units and sort and filter one best per exercise', async ({ page }) => {
  const records = [
    { exerciseId:'row', name:'Cable Row', loadKg:40, loadValue:88, loadUnit:'lbs', volumeKg:300, date:'2026-11-12' },
    { exerciseId:'bench', name:'Bench Press', loadKg:30, loadValue:30, loadUnit:'kg', volumeKg:500, date:'2026-11-11' },
    { exerciseId:'pulldown', name:'Lat Pulldown', loadKg:20, loadValue:20, loadUnit:'kg', volumeKg:600, date:'2026-11-11' },
    { exerciseId:'curl', name:'Biceps Curl', loadKg:50, loadValue:50, loadUnit:'kg', volumeKg:200, date:'2026-11-11' },
  ];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token:'test', expires_in:3600, user:{ id:'records-test',name:'Test',email:'test@example.test',emailVerified:true } };
    else if (path.endsWith('/profile')) json = { name:'Test',equipment:[],days:[],goal:'General fitness' };
    else if (path.endsWith('/coach/plan')) json = { days:[{ index:0,name:'Monday',title:'Training',isWorkoutDay:true,exercises:[{exerciseId:'row',name:'Cable Row',targetMuscle:'Back'},{exerciseId:'bench',name:'Bench Press',targetMuscle:'Chest'},{exerciseId:'pulldown',name:'Lat Pulldown',targetMuscle:'Back'}] }] };
    else if (path.endsWith('/workouts/summary')) json = { trainingDates:[],personalRecords:records };
    else if (path.endsWith('/workouts') || path.includes('/progress')) json = [];
    else if (path.endsWith('/nutrition')) json = { meals:[],water:[] };
    else if (path.endsWith('/activity/state')) json = { state:{},dailyMissions:[] };
    else if (path.endsWith('/notifications')) json = { items:[] };
    await route.fulfill({ json });
  });
  await page.goto('/progress');
  await page.getByRole('button',{name:'Records',exact:true}).click();
  const list=page.getByRole('region',{name:'Personal records'});
  await expect(list.locator('.records-item')).toHaveCount(4);
  await expect(list.locator('.records-group h3')).toHaveText(['Back', 'Biceps', 'Chest']);
  await expect(list.locator('.records-item').first()).toContainText('88 lbs');
  await list.getByLabel('Muscle group').selectOption('Back');
  await expect(list.locator('.records-item')).toHaveCount(2);
  await list.getByLabel('Sort by').selectOption('volume');
  await expect(list.locator('.records-item').first()).toContainText('Lat Pulldown');
  await list.getByLabel('Sort by').selectOption('za');
  await expect(list.locator('.records-item').first()).toContainText('Lat Pulldown');
  await list.getByLabel('Sort by').selectOption('az');
  await expect(list.locator('.records-item').first()).toContainText('Cable Row');
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:800});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(list.getByLabel('Muscle group')).toBeVisible();
  }
});
