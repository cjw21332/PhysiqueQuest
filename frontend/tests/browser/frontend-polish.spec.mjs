import { test, expect } from '@playwright/test';
async function fixture(page) {
  let profile = { name:'Student',email:'student@example.test',goal:'Strength',equipment:['Bodyweight only'],days:['Monday'],duration:'30 min',contactName:'Maria',contactPhone:'09123456789' };
  let values={threshold:30}, writes=0;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  await page.addInitScript(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'polish-user',token:'test',name:'Student'})));
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    let json={};
    if(path.endsWith('/profile')){if(request.method()==='PUT'){writes++;profile={...profile,...request.postDataJSON()};}json=profile;}
    if(path.endsWith('/settings')){if(request.method()==='PUT')values={...values,...request.postDataJSON().values};json={values};}
    if(path.endsWith('/activity/state'))json={state:{level:1},dailyMissions:[],badges:[]};
    if(path.endsWith('/coach/plan'))json={days:[],libraryReady:true};
    if(path.endsWith('/workouts/active'))json=null;
    if(path.endsWith('/exercises'))json={items:[],total:0,page:1,pages:0};
    return route.fulfill({headers,json});
  });
  return {get writes(){return writes;},get profile(){return profile;}};
}
test('Coach empty states and library search retain readable contrast and keyboard focus',async({page},info)=>{
  await fixture(page);await page.goto('/coach');
  await expect(page.locator('.rest-day-message h3')).toHaveCSS('color','rgb(248, 250, 252)');
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
    await page.setViewportSize({width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`coach-empty-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:/Exercise library Demos/}).click();
  const input=page.getByRole('searchbox');await input.focus();
  await expect(input).toHaveCSS('outline-style','solid');
  await expect(input).toHaveCSS('outline-width','2px');
  expect(await input.evaluate(el=>getComputedStyle(el,'::placeholder').color)).toBe('rgb(148, 163, 184)');
});
test('saved safety threshold announces selection and omitted targets read cleanly',async({page})=>{
  await fixture(page);await page.goto('/me');
  const group=page.getByRole('group',{name:'Inactivity threshold'});
  await expect(group.getByRole('button',{name:'30 s',exact:true})).toHaveAttribute('aria-pressed','true');
  await group.getByRole('button',{name:'45 s',exact:true}).click();
  await expect(group.getByRole('button',{name:'45 s',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(group.getByRole('button',{name:'30 s',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.me-row').filter({hasText:'Goals'})).not.toContainText('— by —');
});
test('profile save stays successful when only the optional local cache fails',async({page})=>{
  const state=await fixture(page);await page.goto('/me');
  await page.getByRole('button',{name:/Emergency contact Maria/}).click();
  await page.getByLabel('Name',{exact:true}).fill('Maria Cruz');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='physiquequest-profile')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Account & settings'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'saved'})).toBeVisible();
  expect(state.writes).toBe(1);expect(state.profile.contactName).toBe('Maria Cruz');
});
