# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calibration-resume.spec.mjs >> switching accounts while setup is open cannot submit another account’s draft
- Location: tests\browser\calibration-resume.spec.mjs:127:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.calibration-wizard [role="alert"]')
Expected substring: "account or connection changed"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('.calibration-wizard [role="alert"]') with timeout 5000ms
  - waiting for locator('.calibration-wizard [role="alert"]')

```

```yaml
- alert
- main:
  - text: Friday
  - heading "Hi, Student" [level=1]
  - button "Notifications"
  - region "Today's session":
    - text: Today’s session
    - alert: The server returned incomplete data. Try refreshing.
    - text: Plan unavailable · Bodyweight only
    - button "Start workout"
    - button "View full plan"
  - region "Activity summary": — day streak — points Lv —
  - heading "Daily missions · 0 of 0" [level=3]
  - button "View all"
  - alert: The server returned incomplete data. Try refreshing.
  - heading "Nutrition today" [level=3]
  - button "Scan meal"
  - alert: The server returned incomplete data. Try refreshing.
  - heading "Your journey" [level=3]
  - button "Goals & milestones Build muscle"
  - button "Progress Review saved measurements"
  - navigation "Main navigation":
    - button "Home"
    - button "Coach"
    - button "Scan food and nutrition": Scan
    - button "Quests"
    - button "Me, account and settings": Me
- button "Open Phiq coach"
```

# Test source

```ts
  31  |   await page.getByLabel('Height',{exact:true}).fill('180');
  32  |   await page.getByLabel('Weight',{exact:true}).fill('75');
  33  |   await page.getByRole('button',{name:'Male',exact:true}).click();
  34  |   await page.getByRole('button',{name:'Moderate',exact:true}).click();
  35  | }
  36  | async function toLastStep(page, open = true) {
  37  |   if(open)await page.goto('/register');
  38  |   await basics(page);
  39  |   await page.getByRole('button',{name:'Skip body measurements',exact:true}).click();
  40  |   await page.getByRole('button',{name:'Next: Goals',exact:true}).click();
  41  |   await page.getByRole('button',{name:/Build muscle Resistance training/}).click();
  42  |   await page.getByRole('button',{name:'Consistent',exact:true}).click();
  43  |   await page.getByRole('button',{name:'Skip weight target & date',exact:true}).click();
  44  |   await page.getByRole('button',{name:'Next: Training',exact:true}).click();
  45  |   await page.getByRole('button',{name:'Bodyweight only',exact:true}).click();
  46  |   await page.getByRole('button',{name:'Monday',exact:true}).click();
  47  |   await page.getByRole('button',{name:'30 min',exact:true}).click();
  48  |   await page.getByRole('button',{name:'Skip camera guidance',exact:true}).click();
  49  |   await page.getByRole('button',{name:'Next: Health info',exact:true}).click();
  50  |   await page.getByRole('button',{name:'Skip health notes',exact:true}).click();
  51  |   await page.getByLabel('Name',{exact:true}).fill('Maria');
  52  |   await page.getByLabel('Mobile number').fill('09123456789');
  53  | }
  54  | test('close/reopen restores step and values; optional skips survive and final save retries',async({page},info)=>{
  55  |   const state=await account(page,{failSave:true});
  56  |   await toLastStep(page);
  57  |   const context=page.context();await page.close();page=await context.newPage();
  58  |   await page.goto('/register');
  59  |   await expect(page.getByRole('heading',{name:'Health & safety'})).toBeFocused();
  60  |   await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Maria');
  61  |   await expect(page.getByRole('button',{name:'Add health notes',exact:true})).toBeVisible();
  62  |   for(const [width,height] of [[320,480],[390,844],[768,1024],[1440,900]]){
  63  |     await page.setViewportSize({width,height});
  64  |     await expect(page.getByRole('button',{name:'Save profile & continue',exact:true})).toBeInViewport();
  65  |     const box=await page.getByRole('button',{name:'Add health notes',exact:true}).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  66  |     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  67  |     await page.screenshot({path:info.outputPath(`calibration-resume-${width}.png`),animations:'disabled'});
  68  |   }
  69  |   await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  70  |   await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Profile save unavailable');
  71  |   expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('physiquequest-calibration:')))).toBe(true);
  72  |   await page.getByRole('button',{name:'Save profile & continue',exact:true}).dblclick();
  73  |   await expect(page).toHaveURL(/\/home$/);
  74  |   expect(state.writes).toBe(2);
  75  |   expect(state.profile).toMatchObject({name:'Student',age:'24',contactName:'Maria',conditions:[],days:['Monday'],equipment:['Bodyweight only']});
  76  |   expect(state.profile.targetWeight).toBeUndefined();
  77  |   expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('physiquequest-calibration:')))).toBe(false);
  78  | });
  79  | test('skipped details can be added again and required fields remain required',async({page})=>{
  80  |   await account(page);await page.goto('/register');
  81  |   await page.getByLabel('Chest',{exact:true}).fill('100');
  82  |   await page.getByRole('button',{name:'Skip body measurements',exact:true}).click();
  83  |   await expect(page.getByLabel('Chest',{exact:true})).toHaveCount(0);
  84  |   await page.getByRole('button',{name:'Add body measurements',exact:true}).click();
  85  |   await expect(page.getByLabel('Chest',{exact:true})).toHaveValue('');
  86  |   await page.getByRole('button',{name:'Next: Goals',exact:true}).click();
  87  |   await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Enter an age');
  88  | });
  89  | test('malformed and other-account drafts never restore personal details',async({page})=>{
  90  |   await account(page);await page.goto('/register');await basics(page);
  91  |   await page.evaluate(()=>{
  92  |     const key=Object.keys(localStorage).find(key=>key.startsWith('physiquequest-calibration:'));
  93  |     localStorage.setItem(key.replace(':calibration-user',':other-user'),localStorage.getItem(key));
  94  |     localStorage.setItem(key,'{broken');
  95  |   });
  96  |   await page.reload();await expect(page.getByLabel('Age',{exact:true})).toHaveValue('');
  97  | });
  98  | test('storage failure is visible and does not block backend completion',async({page})=>{
  99  |   await account(page);
  100 |   await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('physiquequest-calibration:'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  101 |   await toLastStep(page);
  102 |   await expect(page.getByRole('status')).toContainText('Device storage is unavailable');
  103 |   await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  104 |   await expect(page).toHaveURL(/\/home$/);
  105 | });
  106 | test('failed recovery offers retry without showing duplicate registration',async({page})=>{
  107 |   await account(page,{failRecovery:true});await page.goto('/register');
  108 |   await expect(page.getByRole('alert').filter({hasText:'Could not check your profile'})).toBeVisible();
  109 |   await page.getByRole('button',{name:'Retry setup recovery'}).click();
  110 |   await expect(page.getByRole('heading',{name:'Personal data'})).toBeVisible();
  111 | });
  112 | test('lost final response recovers a server-created profile',async({page})=>{
  113 |   const state=await account(page,{lostReply:true});await toLastStep(page);
  114 |   await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  115 |   await expect(page).toHaveURL(/\/home$/);expect(state.writes).toBe(1);
  116 | });
  117 | test('signing in again resumes the same-account draft',async({page})=>{
  118 |   await account(page);await page.goto('/register');await basics(page);
  119 |   await page.getByRole('button',{name:'Next: Goals',exact:true}).click();
  120 |   await page.evaluate(()=>localStorage.removeItem('physiquequest-auth'));
  121 |   await page.goto('/login');
  122 |   await page.getByLabel('Email address',{exact:true}).fill('student@example.test');
  123 |   await page.getByLabel('Password',{exact:true}).fill('Testing123!');
  124 |   await page.locator('button[type="submit"]').click();
  125 |   await expect(page.getByRole('heading',{name:'What are you training for?'})).toBeVisible();
  126 | });
  127 | test('switching accounts while setup is open cannot submit another account’s draft',async({page})=>{
  128 |   const state=await account(page);await toLastStep(page);
  129 |   await page.evaluate(()=>localStorage.setItem('physiquequest-auth',JSON.stringify({id:'other-user',token:'other-token',name:'Other'})));
  130 |   await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
> 131 |   await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('account or connection changed');
      |                                                                    ^ Error: expect(locator).toContainText(expected) failed
  132 |   expect(state.writes).toBe(0);
  133 |   expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('physiquequest-calibration:')&&key.endsWith(':other-user')))).toBe(false);
  134 | });
  135 | test('an account switch during final save cannot clear the new account’s draft',async({page})=>{
  136 |   await account(page);await toLastStep(page);
  137 |   const pending=page.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/profile'));
  138 |   const click=page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  139 |   await pending;
  140 |   await page.evaluate(()=>{
  141 |     const key=Object.keys(localStorage).find(key=>key.startsWith('physiquequest-calibration:'));
  142 |     localStorage.setItem(key.replace(':calibration-user',':other-user'),'other-account-draft');
  143 |     localStorage.setItem('physiquequest-auth',JSON.stringify({id:'other-user',token:'other-token',name:'Other'}));
  144 |   });
  145 |   await click;
  146 |   await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('account or connection changed');
  147 |   expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('physiquequest-calibration:')).map(key=>localStorage.getItem(key)))).toContain('other-account-draft');
  148 | });
  149 | test('an incomplete account without a device draft returns to calibration after login',async({page})=>{
  150 |   await account(page);await page.goto('/login');
  151 |   await page.getByLabel('Email address',{exact:true}).fill('student@example.test');
  152 |   await page.getByLabel('Password',{exact:true}).fill('Testing123!');
  153 |   await page.locator('button[type="submit"]').click();
  154 |   await expect(page.getByRole('heading',{name:'Personal data'})).toBeVisible();
  155 | });
  156 | test('email verification does not complete registration before profile setup',async({page})=>{
  157 |   let saved;
  158 |   await page.route('**/api/**',async route=>{
  159 |     const request=route.request(),path=new URL(request.url()).pathname;
  160 |     if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  161 |     if(path.endsWith('/auth/session/refresh'))return route.fulfill({status:401,headers,json:{message:'No active session'}});
  162 |     if(path.endsWith('/auth/registration-code/request'))return route.fulfill({headers,json:{requestId:'a'.repeat(64)}});
  163 |     if(path.endsWith('/auth/session/register'))return route.fulfill({headers,json:{access_token:'first-token',expires_in:900,user:{id:'first-user',name:'First',email:'first@example.test'}}});
  164 |     if(path.endsWith('/profile')){
  165 |       if(request.method()==='POST')saved=request.postDataJSON();
  166 |       return route.fulfill({status:saved?200:404,headers,json:saved??{message:'Profile not found'}});
  167 |     }
  168 |     return route.fulfill({headers,json:{}});
  169 |   });
  170 |   await page.goto('/register');
  171 |   await page.getByLabel('Full name').fill('First');
  172 |   await page.getByLabel('Email address',{exact:true}).fill('first@example.test');
  173 |   await page.getByLabel('Password',{exact:true}).fill('Testing123!');
  174 |   await page.getByLabel('Confirm password',{exact:true}).fill('Testing123!');
  175 |   await page.getByRole('checkbox').check();
  176 |   await page.getByRole('button',{name:'Create account',exact:true}).click();
  177 |   await expect(page.getByRole('heading',{name:'Verification code'})).toBeVisible();
  178 |   await page.getByLabel('Digit 1 of 6').fill('123456');
  179 |   await page.getByRole('button',{name:'Confirm',exact:true}).click();
  180 |   await expect(page.getByText(/Registration is not complete until you finish your profile/)).toBeVisible();
  181 |   await expect(page.getByRole('button',{name:'Continue setup',exact:true})).toBeVisible();
  182 |   await page.getByRole('button',{name:'Continue setup',exact:true}).click();
  183 |   await toLastStep(page,false);
  184 |   await page.getByRole('button',{name:'Save profile & continue',exact:true}).click();
  185 |   await expect(page).toHaveURL(/\/home$/);
  186 |   expect(saved?.name).toBe('First');
  187 | });
  188 | 
```