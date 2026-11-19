# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-dark.spec.mjs >> login uses the dark palette and preserves password visibility
- Location: tests\browser\onboarding-dark.spec.mjs:143:1

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator: locator('.auth-screen')
Expected: "rgb(11, 15, 21)"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveCSS" locator('.auth-screen') with timeout 5000ms
  - waiting for locator('.auth-screen')

```

```yaml
- alert
- alert:
  - text: Could not restore your session. Check your connection and retry.
  - button "Retry"
```

# Test source

```ts
  45  |   }
  46  |   await page.setViewportSize({ width: 390, height: 844 });
  47  |   for (const size of [{ width: 320, height: 480 }, { width: 320, height: 568 }, { width: 390, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  48  |     await page.setViewportSize(size);
  49  |     await expect(page.locator('.launch')).toHaveCSS('overflow-y', 'clip');
  50  |     await page.locator('.launch').evaluate(el => { el.scrollTop = el.scrollHeight; });
  51  |     expect(await page.locator('.launch').evaluate(el => el.scrollTop)).toBe(0);
  52  |     expect(await page.locator('.launch').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  53  |     await expect(page.getByRole('link', { name: 'Get started', exact: true })).toBeInViewport();
  54  |     await expect(page.getByRole('link', { name: 'I already have an account', exact: true })).toBeInViewport();
  55  |   }
  56  |   await page.setViewportSize({ width: 390, height: 844 });
  57  |   await page.getByRole('link', { name: 'Get started', exact: true }).click();
  58  |   await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  59  |   await expectReferenceLayout(page, ['.auth-screen', '.auth-body', '.auth-heading', '.segmented', '.auth-footer']);
  60  |   await capture(page, testInfo, '02-register');
  61  |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  62  |     await page.setViewportSize(size);
  63  |     await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeInViewport();
  64  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  65  |   }
  66  |   await page.setViewportSize({ width: 390, height: 844 });
  67  |   // Confirm React's password interaction is live before entering form values.
  68  |   await page.getByRole('button', { name: 'Show password', exact: true }).click();
  69  |   await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  70  |   await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  71  |   await page.getByLabel('Full name').fill('Juan Dela Cruz');
  72  |   await page.getByLabel('Email address').fill('juan@example.test');
  73  |   await page.getByLabel('Password', { exact: true }).fill('Testing123');
  74  |   await page.getByLabel('Confirm password', { exact: true }).fill('Testing123');
  75  |   await page.getByRole('checkbox').check();
  76  |   await expect(page.getByLabel('Full name')).toHaveValue('Juan Dela Cruz');
  77  |   await page.getByRole('button', { name: 'Create account', exact: true }).click();
  78  |   await expect(page.getByRole('heading', { name: 'Verification code' })).toBeVisible();
  79  |   await page.getByLabel('Digit 1 of 6').fill('123456');
  80  |   await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  81  |   await page.getByRole('button', { name: 'Continue setup', exact: true }).click();
  82  |   await expect(page.getByRole('heading', { name: 'Personal data' })).toBeVisible();
  83  |   await expectReferenceLayout(page, ['.calibration-wizard', '.wizard-heading', '.step-content', '.calibration-footer']);
  84  |   await page.getByRole('button', { name: 'Next: Goals', exact: true }).click();
  85  |   await expect(page.locator('.calibration-wizard [role="alert"]')).toContainText('Enter an age');
  86  |   await page.getByLabel('Age', { exact: true }).fill('24');
  87  |   await page.locator('.section-header').filter({ hasText: 'Basic information' }).getByRole('button', { name: 'Clear', exact: true }).click();
  88  |   await expect(page.getByLabel('Age', { exact: true })).toHaveValue('');
  89  |   await page.getByLabel('Age', { exact: true }).fill('24');
  90  |   await page.getByLabel('Height', { exact: true }).fill('180');
  91  |   await page.getByLabel('Weight', { exact: true }).fill('75');
  92  |   await page.getByRole('button', { name: 'Male', exact: true }).click();
  93  |   await page.getByRole('button', { name: 'Moderate', exact: true }).click();
  94  |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  95  |   await capture(page, testInfo, '03-personal-data');
  96  |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  97  |   await capture(page, testInfo, '04-personal-data-scrolled');
  98  |   await page.getByRole('button', { name: 'Next: Goals', exact: true }).click();
  99  |   await page.getByRole('button', { name: 'Back', exact: true }).click();
  100 |   await expect(page.getByRole('heading', { name: 'Personal data', exact: true })).toBeVisible();
  101 |   await expect(page.getByLabel('Age', { exact: true })).toHaveValue('24');
  102 |   await page.getByRole('button', { name: 'Next: Goals', exact: true }).click();
  103 |   await page.getByRole('button', { name: /Build muscle Resistance training/ }).click();
  104 |   await page.getByRole('button', { name: 'Consistent', exact: true }).click();
  105 |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  106 |   await capture(page, testInfo, '05-goals');
  107 |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  108 |   await capture(page, testInfo, '06-goals-scrolled');
  109 |   await page.getByRole('button', { name: 'Next: Training', exact: true }).click();
  110 |   await page.getByRole('button', { name: 'Back', exact: true }).click();
  111 |   await expect(page.getByRole('button', { name: /Build muscle Resistance training/ })).toHaveAttribute('aria-pressed', 'true');
  112 |   await page.getByRole('button', { name: 'Next: Training', exact: true }).click();
  113 |   await page.getByRole('button', { name: 'Dumbbells', exact: true }).click();
  114 |   for (const day of ['Monday', 'Wednesday', 'Friday', 'Saturday']) await page.getByRole('button', { name: day, exact: true }).click();
  115 |   await page.getByRole('button', { name: '45 min', exact: true }).click();
  116 |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  117 |   await capture(page, testInfo, '07-training');
  118 |   await page.getByRole('checkbox', { name: 'I understand this camera setup guidance' }).check();
  119 |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  120 |   await capture(page, testInfo, '08-training-scrolled');
  121 |   await page.getByRole('button', { name: 'Next: Health info', exact: true }).click();
  122 |   await page.getByRole('button', { name: 'Back', exact: true }).click();
  123 |   await expect(page.locator('.equipment').filter({ hasText: 'Dumbbells' })).toHaveAttribute('aria-pressed', 'true');
  124 |   await page.getByRole('button', { name: 'Next: Health info', exact: true }).click();
  125 |   await page.getByRole('checkbox', { name: 'Knee injury', exact: true }).check();
  126 |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = 0; });
  127 |   await capture(page, testInfo, '09-health-safety');
  128 |   await page.locator('.calibration-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
  129 |   await capture(page, testInfo, '10-health-safety-scrolled');
  130 |   for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  131 |     await page.setViewportSize(size);
  132 |     await expect(page.getByRole('button', { name: 'Save profile & continue', exact: true })).toBeInViewport();
  133 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  134 |   }
  135 |   await page.getByLabel('Name', { exact: true }).fill('Maria Cruz');
  136 |   await page.getByLabel('Mobile number').fill('09123456789');
  137 |   await page.getByRole('button', { name: 'Save profile & continue', exact: true }).click();
  138 |   await expect.poll(() => savedProfile?.contactName).toBe('Maria Cruz');
  139 |   expect(savedProfile).toMatchObject({ age: '24', goal: 'Build muscle', equipment: ['Dumbbells'], duration: '45 min', conditions: ['Knee injury'] });
  140 |   expect(savedProfile.days).toHaveLength(4);
  141 | });
  142 | 
  143 | test('login uses the dark palette and preserves password visibility', async ({ page }, testInfo) => {
  144 |   await page.goto('/login');
> 145 |   await expect(page.locator('.auth-screen')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
      |                                              ^ Error: expect(locator).toHaveCSS(expected) failed
  146 |   await page.getByLabel('Password', { exact: true }).fill('Example123');
  147 |   await page.getByRole('button', { name: 'Show password', exact: true }).click();
  148 |   await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  149 |   await capture(page, testInfo, '11-login');
  150 |   await page.getByText('Forgot Password?', { exact: true }).click();
  151 |   await expect(page.locator('.forgot-password-modal')).toHaveCSS('background-color', 'rgb(11, 15, 21)');
  152 |   await expectReferenceLayout(page, ['.forgot-password-modal', '.modal-header', '.modal-footer']);
  153 |   await page.getByRole('button', { name: 'Close', exact: true }).click();
  154 |   await expect(page.locator('.forgot-password-modal')).toHaveCount(0);
  155 |   await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  156 | });
  157 | 
```