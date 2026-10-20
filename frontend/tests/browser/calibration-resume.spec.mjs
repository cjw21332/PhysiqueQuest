import { test, expect } from '@playwright/test';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
async function account(page, { failSave = false, lostReply = false, failRecovery = false } = {}) {
  let profile = null, writes = 0;
  await page.context().addInitScript(()=>{
    if (!localStorage.getItem('physiquequest-auth')) localStorage.setItem('physiquequest-auth', JSON.stringify({ id:'calibration-user', token:'test', name:'Student', email:'student@example.test' }));
  });
  await page.context().route('**/api/**',async route=>{
    const request=route.request(), path=new URL(request.url()).pathname;
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(path.endsWith('/auth/login'))return route.fulfill({headers,json:{access_token:'test',user:{id:'calibration-user',name:'Student',email:'student@example.test'}}});
    if(path.endsWith('/profile')) {
      if(request.method()==='POST') {
        writes++;
        await new Promise(resolve=>setTimeout(resolve,150));
        if(failSave){failSave=false;return route.fulfill({status:503,headers,json:{message:'Profile save unavailable. Retry.'}});}
        profile=request.postDataJSON();
        if(lostReply){lostReply=false;return route.fulfill({status:503,headers,json:{message:'Response lost'}});}
      }
      if(failRecovery){failRecovery=false;return route.fulfill({status:503,headers,json:{message:'Recovery unavailable'}});}
      return route.fulfill({status:profile?200:404,headers,json:profile??{message:'Profile not found'}});
    }
    return route.fulfill({headers,json:{}});
  });
  return {get profile(){return profile;},get writes(){return writes;}};
}
async function basics(page) {
  await page.getByLabel('Age',{exact:true}).fill('24');
  await page.getByLabel('Height',{exact:true}).fill('180');
  await page.getByLabel('Weight',{exact:true}).fill('75');
  await page.getByRole('button',{name:'Male',exact:true}).click();
  await page.getByRole('button',{name:'Moderate',exact:true}).click();
}
async function toLastStep(page, open = true) {
  if(open)await page.goto('/register');
  await basics(page);
  await page.getByRole('button',{name:'Skip body measurements',exact:true}).click();
  await page.getByRole('button',{name:'Next: Goals',exact:true}).click();
  await page.getByRole('button',{name:/Build muscle Resistance training/}).click();
  await page.getByRole('button',{name:'Consistent',exact:true}).click();
  await page.getByRole('button',{name:'Skip weight target & date',exact:true}).click();
  await page.getByRole('button',{name:'Next: Training',exact:true}).click();
  await page.getByRole('button',{name:'Bodyweight only',exact:true}).click();
  await page.getByRole('button',{name:'Monday',exact:true}).click();
  await page.getByRole('button',{name:'30 min',exact:true}).click();
  await page.getByRole('button',{name:'Skip camera guidance',exact:true}).click();
  await page.getByRole('button',{name:'Next: Health info',exact:true}).click();
  await page.getByRole('button',{name:'Skip health notes',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Maria');
  await page.getByLabel('Mobile number').fill('09123456789');
}
test('close/reopen restores step and values; optional skips survive and final save retries',async({page},info)=>{
  const state=await account(page,{failSave:true});
  await toLastStep(page);
  const context=page.context();await page.close();page=await context.newPage();
  await page.goto('/register');
  await expect(page.getByRole('heading',{name:'Health & safety'})).toBeFocused();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Maria');
  await expect(page.getByRole('button',{name:'Add health notes',exact:true})).toBeVisible();
  for(const [width,height] of [[320,480],[390,844],[768,1024],[1440,900]]){
    await page.setViewportSize({width,height});
    await expect(page.getByRole('button',{name:'Save profile & continue',exact:true})).toBeInViewport();
    const box=await page.getByRole('button',{name:'Add health notes',exact:true}).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`calibration-resume-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Profile save unavailable');
  expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('physiquequest-calibration:')))).toBe(true);
  await page.getByRole('button',{name:'Save profile & continue',exact:true}).dblclick();
  await expect(page).toHaveURL(/\/home$/);
  expect(state.writes).toBe(2);
  expect(state.profile).toMatchObject({name:'Student',age:'24',contactName:'Maria',conditions:[],days:['Monday'],equipment:['Bodyweight only']});
  expect(state.profile.targetWeight).toBeUndefined();
  expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('physiquequest-calibration:')))).toBe(false);
});
test('skipped details can be added again and required fields remain required',async({page})=>{
  await account(page);await page.goto('/register');
  await page.getByLabel('Chest',{exact:true}).fill('100');
  await page.getByRole('button',{name:'Skip body measurements',exact:true}).click();
  await expect(page.getByLabel('Chest',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Add body measurements',exact:true}).click();
  await expect(page.getByLabel('Chest',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Next: Goals',exact:true}).click();
  await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Enter an age');
});
test('malformed and other-account drafts never restore personal details',async({page})=>{
  await account(page);await page.goto('/register');await basics(page);
  await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(key=>key.startsWith('physiquequest-calibration:'));
    localStorage.setItem(key.replace(':calibration-user',':other-user'),localStorage.getItem(key));
    localStorage.setItem(key,'{broken');
  });
  await page.reload();await expect(page.getByLabel('Age',{exact:true})).toHaveValue('');
});
test('storage failure is visible and does not block backend completion',async({page})=>{
  await account(page);
  await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('physiquequest-calibration:'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  await toLastStep(page);
  await expect(page.getByRole('status')).toContainText('Device storage is unavailable');
  await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  await expect(page).toHaveURL(/\/home$/);
});
test('failed recovery offers retry without showing duplicate registration',async({page})=>{
  await account(page,{failRecovery:true});await page.goto('/register');
  await expect(page.getByRole('alert').filter({hasText:'Could not check your profile'})).toBeVisible();
  await page.getByRole('button',{name:'Retry setup recovery'}).click();
  await expect(page.getByRole('heading',{name:'Personal data'})).toBeVisible();
});
test('lost final response recovers a server-created profile',async({page})=>{
  const state=await account(page,{lostReply:true});await toLastStep(page);
  await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  await expect(page).toHaveURL(/\/home$/);expect(state.writes).toBe(1);
});
test('signing in again resumes the same-account draft',async({page})=>{
  await account(page);await page.goto('/register');await basics(page);
  await page.getByRole('button',{name:'Next: Goals',exact:true}).click();
  await page.evaluate(()=>localStorage.removeItem('physiquequest-auth'));
  await page.goto('/login');
  await page.getByLabel('Email address',{exact:true}).fill('student@example.test');
  await page.getByLabel('Password',{exact:true}).fill('Testing123!');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading',{name:'What are you training for?'})).toBeVisible();
});
test('switching accounts while setup is open cannot submit another account’s draft',async({page})=>{
  const state=await account(page);await toLastStep(page);
  await page.evaluate(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'other-user',token:'other-token',name:'Other'})));
  await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('account or connection changed');
  expect(state.writes).toBe(0);
  expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('physiquequest-calibration:')&&key.endsWith(':other-user')))).toBe(false);
});
test('an account switch during final save cannot clear the new account’s draft',async({page})=>{
  await account(page);await toLastStep(page);
  const pending=page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/profile'));
  const click=page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  await pending;
  await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(key=>key.startsWith('physiquequest-calibration:'));
    localStorage.setItem(key.replace(':calibration-user',':other-user'),'other-account-draft');
    localStorage.setItem('physiquequest-auth',JSON.stringify({id:'other-user',token:'other-token',name:'Other'}));
  });
  await click;
  await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('account or connection changed');
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('physiquequest-calibration:')).map(key=>localStorage.getItem(key)))).toContain('other-account-draft');
});
test('an incomplete account without a device draft returns to calibration after login',async({page})=>{
  await account(page);await page.goto('/login');
  await page.getByLabel('Email address',{exact:true}).fill('student@example.test');
  await page.getByLabel('Password',{exact:true}).fill('Testing123!');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading',{name:'Personal data'})).toBeVisible();
});
test('account-created dialog rechecks identity before opening calibration',async({page})=>{
  let saved;
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(path.endsWith('/auth/register'))return route.fulfill({headers,json:{access_token:'first-token',user:{id:'first-user',name:'First',email:'first@example.test'}}});
    if(path.endsWith('/profile')){
      if(request.method()==='POST')saved=request.postDataJSON();
      return route.fulfill({status:saved?200:404,headers,json:saved??{message:'Profile not found'}});
    }
    return route.fulfill({headers,json:{}});
  });
  await page.goto('/register');
  await page.getByLabel('Full name').fill('First');
  await page.getByLabel('Email address',{exact:true}).fill('first@example.test');
  await page.getByLabel('Password',{exact:true}).fill('Testing123!');
  await page.getByLabel('Confirm password',{exact:true}).fill('Testing123!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start calibration',exact:true})).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'second-user',token:'second-token',name:'Second',email:'second@example.test'})));
  await page.getByRole('button',{name:'Start calibration',exact:true}).click();
  await toLastStep(page,false);
  await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  await expect.poll(()=>saved?.name).toBe('Second');
});
