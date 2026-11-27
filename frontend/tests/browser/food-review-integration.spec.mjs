import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
// Signed-in pages show What's New once per release; mark it seen so it never covers the controls under test.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { sessionStorage.setItem('pq-whats-new-shown', '1'); } catch {} }); });

const backend = path.resolve(process.cwd(), '../backend');
const requireBackend = createRequire(path.join(backend, 'package.json'));
const load = name => import(pathToFileURL(path.join(backend, 'dist', name)).href);

test('browser review saves through the authenticated backend to isolated MongoDB', async ({ page }, testInfo) => {
  test.skip(!process.env.PQ_TEST_MONGO_URI, 'Set PQ_TEST_MONGO_URI to an isolated local MongoDB server');
  const { Test } = requireBackend('@nestjs/testing'), { ConfigModule } = requireBackend('@nestjs/config');
  const { MongooseModule, getConnectionToken } = requireBackend('@nestjs/mongoose');
  const { PassportModule } = requireBackend('@nestjs/passport'), { ValidationPipe } = requireBackend('@nestjs/common');
  const { Types } = requireBackend('mongoose'), jwt = requireBackend('jsonwebtoken');
  const [{ FoodScanModule }, { NutritionModule }, { JwtStrategy }, { AuthService }, { SessionService }, { GeminiService }, { UsdaService }] = await Promise.all([
    load('foodscan/foodscan.module.js'), load('nutrition/nutrition.module.js'), load('auth/jwt.strategy.js'), load('auth/auth.service.js'), load('auth/session.service.js'), load('foodscan/services/gemini.service.js'), load('foodscan/services/usda.service.js'),
  ]);
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`, secret = 'isolated-browser-foodscan-secret', user = new Types.ObjectId();
  const record = id => ({ fdcId: id, description: id === 101 ? 'Roasted chicken' : 'Fried egg', dataType: 'test', kcal_per_100g: id === 101 ? 165 : 200, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 });
  let analyses = 0, loseSaveResponse = true;
  const moduleRef = await Test.createTestingModule({ imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_SECRET: secret, GEMINI_API_KEY: 'test', USDA_API_KEY: 'test' })] }),
    MongooseModule.forRoot(process.env.PQ_TEST_MONGO_URI, { dbName }), PassportModule, FoodScanModule, NutritionModule,
  ], providers: [JwtStrategy, { provide: AuthService, useValue: { validateUser: async () => ({ sessionVersion: 0, emailVerified: true }) } }, { provide: SessionService, useValue: {} }] })
    .overrideProvider(GeminiService).useValue({ detectFoods: async (_image, _mime, usage) => { analyses++; usage?.({ input: 10, output: 2, total: 12 }); return [{ food_name: 'chicken', est_weight_g: 100, confidence: 0.8 }, { food_name: 'unwanted food', est_weight_g: 25, confidence: 0.3 }]; } })
    .overrideProvider(UsdaService).useValue({ lookupFood: async () => record(101), getNutrients: async id => record(id), searchCandidates: async query => [{ fdc_id: query.toLowerCase().includes('egg') ? 102 : 101, description: query.toLowerCase().includes('egg') ? 'Fried egg' : 'Roasted chicken', data_type: 'test' }] }).compile();
  const app = moduleRef.createNestApplication(); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const connection = app.get(getConnectionToken());
  try {
    await app.listen(0, '127.0.0.1'); await connection.db.collection('users').insertOne({ _id: user, isActive: true });
    const port = app.getHttpServer().address().port, token = jwt.sign({ sub: String(user) }, secret, { expiresIn: '5m' });
    await page.context().addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'integration', token: 'test' })));
    await page.context().route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname;
      if (p.includes('/auth/session/')) return route.fulfill({ json: { access_token: token, expires_in: 3600, user: { id: String(user), name: 'Test', email: 'test@example.test', emailVerified: true } } });
      if (p.startsWith('/api/nutrition')) {
        const response = await fetch(`http://127.0.0.1:${port}${p}${url.search}`, { method: req.method(), headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, ...(req.postData() ? { body: req.postData() } : {}) });
        if (p.endsWith('/nutrition/meals/from-scan') && req.method() === 'POST' && response.ok && loseSaveResponse) { loseSaveResponse = false; return route.fulfill({ status: 504, json: { message: 'Response interrupted' } }); }
        return route.fulfill({ status: response.status, body: await response.text(), headers: { 'content-type': 'application/json' } });
      }
      const json = p.endsWith('/profile') ? { name: 'Test', goal: 'General fitness', equipment: [], days: [] } : p.endsWith('/activity/state') ? { state: {}, dailyMissions: [] } : p.endsWith('/workouts') ? [] : {};
      return route.fulfill({ json });
    });
    await page.goto('/scan');
    await page.getByRole('button', { name: /Scan your meal/ }).click();
    await page.getByLabel('Upload a meal photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aP8AAAAASUVORK5CYII=', 'base64') });
    await expect(page.getByRole('heading', { name: 'Review your meal' })).toBeVisible();
    await page.locator('.detected-items li').first().getByRole('button', { name: 'Change food' }).click();
    await page.getByRole('searchbox', { name: 'Food name' }).fill('roasted chicken');
    await page.getByRole('button', { name: /Roasted Chicken/ }).click();
    await expect(page.getByText(/Selected: Roasted chicken/)).toBeVisible();
    await page.getByRole('button', { name: 'Use food' }).click();
    await page.getByLabel('Estimated weight for Roasted chicken in grams').fill('120');
    await page.getByRole('button', { name: 'Add missing food' }).click();
    await page.getByRole('searchbox', { name: 'Food name' }).fill('egg');
    await page.getByRole('button', { name: /Fried Egg/ }).click();
    await expect(page.getByText(/Selected: Fried egg/)).toBeVisible();
    await page.getByLabel('Weight (g)', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Use food' }).click();
    const egg = page.locator('.detected-items li').filter({ hasText: 'Fried Egg' });
    await egg.getByRole('button', { name: 'Exclude' }).click(); await egg.getByRole('button', { name: 'Restore' }).click();
    await page.locator('.detected-items li').filter({ hasText: 'Unwanted Food' }).getByRole('button', { name: 'Exclude' }).click();
    await page.getByRole('button', { name: 'Save meal' }).click();
    await expect.poll(async () => (await connection.db.collection('nutrition').findOne({ userId: user }))?.meals?.length ?? 0).toBe(2);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Meal save recovery' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('recovery.png') });
    const second = await page.context().newPage(); await second.goto('/scan');
    await expect(second.getByRole('region', { name: 'Meal save recovery' })).toBeVisible();
    await Promise.all([page.evaluate(() => document.querySelector('[aria-label="Meal save recovery"] button')?.click()), second.evaluate(() => document.querySelector('[aria-label="Meal save recovery"] button')?.click())]);
    await expect(page.getByRole('region', { name: 'Meal save recovery' })).toHaveCount(0);
    await expect(second.getByRole('region', { name: 'Meal save recovery' })).toHaveCount(0);
    const saved = await connection.db.collection('nutrition').findOne({ userId: user });
    expect(saved.meals[0]).toMatchObject({ name: 'Roasted chicken', estWeightG: 120, fdcId: 101, calories: 198 });
    expect(saved.meals[1]).toMatchObject({ name: 'Fried egg', estWeightG: 50, fdcId: 102, calories: 100 });
    expect(saved.scanSaveReceipts).toHaveLength(1); expect(analyses).toBe(1);
    expect((await connection.db.collection('food_scan_usage').findOne({ userId: user })).status).toBe('success');
  } finally {
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await app.close();
  }
});
