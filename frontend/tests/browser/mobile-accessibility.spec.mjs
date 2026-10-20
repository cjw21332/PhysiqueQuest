import { test,expect } from '@playwright/test';
test('bottom navigation scales text, exposes current destination and supports touch',async({page},info)=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  await page.addInitScript(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'touch-user',name:'Student',token:'test'})));
  await page.route('**/api/**',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    const path=new URL(route.request().url()).pathname;
    let json={};
    if(path.endsWith('/profile'))json={name:'Student',goal:'Strength',equipment:['Bodyweight only'],days:['Monday'],duration:'30 min'};
    if(path.endsWith('/coach/plan'))json={days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((name,index)=>({name,index,isWorkoutDay:false,exercises:[]})),libraryReady:true};
    if(path.endsWith('/workouts/active'))json=null;
    if(path.endsWith('/settings'))json={values:{threshold:30}};
    if(path.endsWith('/nutrition'))json={meals:[],water:[]};
    if(path.endsWith('/activity'))json={state:{},dailyMissions:[]};
    return route.fulfill({headers,json});
  });
  await page.goto('/coach');
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  await expect(nav.getByRole('button',{name:'Coach',exact:true})).toHaveAttribute('aria-current','page');
  await expect(nav.getByRole('button',{name:'Scan food and nutrition'})).toBeVisible();
  await expect(nav.getByRole('button',{name:'Me, account and settings'})).toBeVisible();
  for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024]])for(const scale of [1,2]){
    await page.setViewportSize({width,height});
    await page.evaluate(scale=>{document.documentElement.style.fontSize=`${16*scale}px`;document.documentElement.dataset.largeText=String(scale>=1.5);},scale);
    for(const button of await nav.getByRole('button').all()){
      const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(48);expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.y+box.height).toBeLessThanOrEqual(height);
      expect(await button.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    }
    expect(await nav.locator('small').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12*scale);
    await expect(nav).toBeInViewport();
    for(const button of await page.locator('.week-days-grid button').all()) { const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(48);expect(box.height).toBeGreaterThanOrEqual(48); }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`nav-${width}-${scale}.png`),animations:'disabled'});
  }
  await nav.getByRole('button',{name:'Me, account and settings'}).tap();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Me, account and settings'})).toHaveAttribute('aria-current','page');
});
