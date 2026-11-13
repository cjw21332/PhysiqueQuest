import { test, expect } from '@playwright/test';

test('strength filters narrow exercises and keep the selected ranking clear', async ({ page }, info) => {
  const choices = [{id:'personal-row',name:'Chest-Supported T-Bar Row'},{id:'personal-curl',name:'Dumbbell Hammer Curl'},{id:'personal-bench',name:'Bench Press'}];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, url = new URL(route.request().url());
    let json = {};
    if (path.endsWith('/auth/session/refresh')) json = { access_token:'test', expires_in:3600, user:{id:'strength-test',name:'Test',email:'test@example.test',emailVerified:true} };
    else if (path.endsWith('/profile')) json = { name:'Test',equipment:[],days:[],goal:'General fitness' };
    else if (path.endsWith('/activity/state')) json = {state:{level:1,currentExp:0,nextLevelExp:100,dayStreak:0,earnedPoints:0},dailyMissions:[],badges:[]};
    else if (path.endsWith('/settings')) json = {values:{showLeaderboard:true}};
    else if (path.endsWith('/coach/plan')) json = {days:[]};
    else if (path.endsWith('/leaderboard/strength')) json = {exercises:choices,exerciseId:url.searchParams.get('exerciseId') || 'personal-bench',metric:url.searchParams.get('metric'),entries:[{userId:'u',rank:1,name:'Test',score:100,maxKg:100,loadKg:80,reps:8}],self:null,hidden:false};
    else if (path.endsWith('/leaderboard')) json = {entries:[],self:{rank:1,points:0}};
    else if (path.endsWith('/notifications')) json = {items:[]};
    await route.fulfill({json});
  });
  await page.goto('/quests/leaderboard');
  await page.getByRole('button',{name:/Strength Logged lifts/}).click();
  const panel=page.getByRole('region',{name:'Find an exercise'});
  await expect(panel.getByRole('combobox',{name:'Exercise',exact:true})).toHaveValue('personal-bench');
  await panel.getByLabel('Muscle group').selectOption('Back');
  await panel.getByLabel('Search exercises').fill('row');
  await expect(panel.getByRole('status')).toHaveText('1 exercise matches your filters.');
  await panel.getByRole('combobox',{name:'Exercise',exact:true}).selectOption('personal-row');
  await expect(panel.getByRole('combobox',{name:'Exercise',exact:true})).toHaveValue('personal-row');
  await panel.getByLabel('Search exercises').fill('nothing matches');
  await expect(panel.getByRole('status')).toContainText('No exercises match');
  await expect(panel.getByRole('combobox',{name:'Exercise',exact:true})).toHaveValue('personal-row');
  await page.getByRole('button',{name:/Pound for pound/}).click();
  await expect(page.getByRole('button',{name:/Pound for pound/})).toHaveAttribute('aria-pressed','true');
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:800});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    if (width === 320 || width === 1440) await page.screenshot({path:info.outputPath(`strength-${width}.png`),animations:'disabled'});
  }
});

test('strength rankings can be retried after a load failure', async ({ page }) => {
  let attempts=0;
  await page.route('**/api/**', async route => {
    const path=new URL(route.request().url()).pathname;
    if (path.endsWith('/leaderboard/strength')) {
      attempts++;
      return attempts === 1 ? route.fulfill({status:503,json:{message:'Rankings unavailable'}}) : route.fulfill({json:{exercises:[],exerciseId:null,metric:'heaviest',entries:[],self:null,hidden:false}});
    }
    let json={};
    if(path.endsWith('/auth/session/refresh')) json={access_token:'test',expires_in:3600,user:{id:'retry-test',name:'Test',email:'test@example.test',emailVerified:true}};
    else if(path.endsWith('/profile')) json={name:'Test',equipment:[],days:[],goal:'General fitness'};
    else if(path.endsWith('/activity/state')) json={state:{level:1,currentExp:0,nextLevelExp:100,dayStreak:0,earnedPoints:0},dailyMissions:[],badges:[]};
    else if(path.endsWith('/settings')) json={values:{}};
    else if(path.endsWith('/coach/plan')) json={days:[]};
    else if(path.endsWith('/leaderboard')) json={entries:[],self:{rank:1,points:0}};
    else if(path.endsWith('/notifications')) json={items:[]};
    await route.fulfill({json});
  });
  await page.goto('/quests/leaderboard');
  await page.getByRole('button',{name:/Strength Logged lifts/}).click();
  await expect(page.getByRole('alert').filter({hasText:'Rankings unavailable'})).toBeVisible();
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByText('No ranked exercises are available yet.')).toBeVisible();
  expect(attempts).toBe(2);
});
