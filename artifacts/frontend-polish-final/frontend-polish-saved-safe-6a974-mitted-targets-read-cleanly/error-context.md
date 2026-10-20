# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-polish.spec.mjs >> saved safety threshold announces selection and omitted targets read cleanly
- Location: tests\browser\frontend-polish.spec.mjs:35:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('group', { name: 'Inactivity threshold' }).getByRole('button', { name: '45 s', exact: true })
Expected: "true"
Received: "false"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" getByRole('group', { name: 'Inactivity threshold' }).getByRole('button', { name: '45 s', exact: true }) with timeout 5000ms
  - waiting for getByRole('group', { name: 'Inactivity threshold' }).getByRole('button', { name: '45 s', exact: true })
    14 × locator resolved to <button class="" type="button" aria-pressed="false">45 s</button>
       - unexpected value "false"

```

```yaml
- button "45 s"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | async function fixture(page) {
  3  |   let profile = { name:'Student',email:'student@example.test',goal:'Strength',equipment:['Bodyweight only'],days:['Monday'],duration:'30 min',contactName:'Maria',contactPhone:'09123456789' };
  4  |   let values={threshold:30}, writes=0;
  5  |   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  6  |   await page.addInitScript(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'polish-user',token:'test',name:'Student'})));
  7  |   await page.route('**/api/**',async route=>{
  8  |     const request=route.request(),path=new URL(request.url()).pathname;
  9  |     if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  10 |     let json={};
  11 |     if(path.endsWith('/profile')){if(request.method()==='PUT'){writes++;profile={...profile,...request.postDataJSON()};}json=profile;}
  12 |     if(path.endsWith('/settings')){if(request.method()==='PUT')values={...values,...request.postDataJSON().values};json={values};}
  13 |     if(path.endsWith('/activity/state'))json={state:{level:1},dailyMissions:[],badges:[]};
  14 |     if(path.endsWith('/coach/plan'))json={days:[],libraryReady:true};
  15 |     if(path.endsWith('/workouts/active'))json=null;
  16 |     if(path.endsWith('/exercises'))json={items:[],total:0,page:1,pages:0};
  17 |     return route.fulfill({headers,json});
  18 |   });
  19 |   return {get writes(){return writes;},get profile(){return profile;}};
  20 | }
  21 | test('Coach empty states and library search retain readable contrast and keyboard focus',async({page},info)=>{
  22 |   await fixture(page);await page.goto('/coach');
  23 |   await expect(page.locator('.rest-day-message h3')).toHaveCSS('color','rgb(248, 250, 252)');
  24 |   for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
  25 |     await page.setViewportSize({width,height});
  26 |     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  27 |     await page.screenshot({path:info.outputPath(`coach-empty-${width}.png`),animations:'disabled'});
  28 |   }
  29 |   await page.getByRole('button',{name:/Exercise library Demos/}).click();
  30 |   const input=page.getByRole('searchbox');await input.focus();
  31 |   await expect(input).toHaveCSS('outline-style','solid');
  32 |   await expect(input).toHaveCSS('outline-width','2px');
  33 |   expect(await input.evaluate(el=>getComputedStyle(el,'::placeholder').color)).toBe('rgb(148, 163, 184)');
  34 | });
  35 | test('saved safety threshold announces selection and omitted targets read cleanly',async({page})=>{
  36 |   await fixture(page);await page.goto('/me');
  37 |   const group=page.getByRole('group',{name:'Inactivity threshold'});
  38 |   await expect(group.getByRole('button',{name:'30 s',exact:true})).toHaveAttribute('aria-pressed','true');
  39 |   await group.getByRole('button',{name:'45 s',exact:true}).click();
> 40 |   await expect(group.getByRole('button',{name:'45 s',exact:true})).toHaveAttribute('aria-pressed','true');
     |                                                                    ^ Error: expect(locator).toHaveAttribute(expected) failed
  41 |   await expect(group.getByRole('button',{name:'30 s',exact:true})).toHaveAttribute('aria-pressed','false');
  42 |   await expect(page.locator('.me-row').filter({hasText:'Goals'})).not.toContainText('— by —');
  43 | });
  44 | test('profile save stays successful when only the optional local cache fails',async({page})=>{
  45 |   const state=await fixture(page);await page.goto('/me');
  46 |   await page.getByRole('button',{name:/Emergency contact Maria/}).click();
  47 |   await page.getByLabel('Name',{exact:true}).fill('Maria Cruz');
  48 |   await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='physiquequest-profile')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  49 |   await page.getByRole('button',{name:'Save changes',exact:true}).click();
  50 |   await expect(page.getByRole('heading',{name:'Account & settings'})).toBeVisible();
  51 |   await expect(page.getByRole('status').filter({hasText:'saved'})).toBeVisible();
  52 |   expect(state.writes).toBe(1);expect(state.profile.contactName).toBe('Maria Cruz');
  53 | });
  54 |
```