import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createConnection, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { FoodScanConfigService } from '../src/common/foodscan/foodscan-config.js';
import { FoodScanSchemasService } from '../src/foodscan/foodscan.schemas.js';
import { FoodScanService } from '../src/foodscan/foodscan.service.js';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { NutritionSchema } from '../src/nutrition/schemas/nutrition.schema.js';
import { TINY_PNG_BASE64 } from './foodscan.fixtures.js';
import { ScanRateLimitGuard } from '../src/common/foodscan/scan-rate-limit.guard.js';
import { FoodScanUsageService } from '../src/foodscan/foodscan-usage.service.js';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { AuthService } from '../src/auth/auth.service.js';
import { SessionService } from '../src/auth/session.service.js';
import { FoodScanModule } from '../src/foodscan/foodscan.module.js';
import { NutritionModule } from '../src/nutrition/nutrition.module.js';
import { AI_VISION_PROVIDER } from '../src/foodscan/services/vision-provider.js';
import type { VisionProvider } from '../src/foodscan/services/vision-provider.js';
import { UsdaService } from '../src/foodscan/services/usda.service.js';
import { issueEvidenceProof } from '../src/foodscan/services/evidence-proof.js';

it.skipIf(!process.env.PQ_TEST_MONGO_URI)('atomically consumes scan evidence while permitting the identical save retry', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`;
  const connection = await createConnection(process.env.PQ_TEST_MONGO_URI!, { dbName, serverSelectionTimeoutMS: 3000 }).asPromise();
  vi.stubEnv('JWT_SECRET', 'isolated-replay-test-secret');
  try {
    const owner = new Types.ObjectId().toString();
    await connection.collection('account_lifecycle').insertOne({ _id: new Types.ObjectId(owner), status: 'active', generation: 0, writeVersion: 0 });
    await connection.collection('nutrition').createIndex({ userId: 1 }, { unique: true });
    const evidence = { name: 'visually_identified', quantity: 'estimated', preparation: 'unknown', added_oil: 'unknown' } as const;
    const scan = { id: randomUUID(), image: 'a'.repeat(64), analysis: 'b'.repeat(64) };
    const proof = issueEvidenceProof(owner, 'rice', 100, evidence, scan)!;
    const item = { food_name: 'rice', found: false, est_weight_g: 100, kcal: null, protein_g: null, carbs_g: null, fat_g: null, evidence, evidence_ref: proof };
    const service = new NutritionService(connection.model('Nutrition', NutritionSchema));
    const body = { meal: 'Lunch', items: [item], idempotency_key: 'scan_save_key_0001' };
    const saved = await service.addMealsFromScan(owner, body);
    expect(await service.addMealsFromScan(owner, body)).toEqual(saved);
    await expect(service.addMealsFromScan(owner, { ...body, idempotency_key: 'scan_save_key_0002' })).rejects.toThrow('already been saved');
    await expect(service.addMealsFromScan(owner, { ...body, idempotency_key: undefined })).rejects.toThrow('already been saved');
    const record = await service.read(owner);
    expect(record.meals).toHaveLength(1);
    expect(record.consumedScanEvidence).toHaveLength(1);
    const otherScan = { ...scan, id: randomUUID() };
    const otherProof = issueEvidenceProof(owner, 'rice', 100, evidence, otherScan)!;
    const competing = await Promise.allSettled(['scan_save_key_0003', 'scan_save_key_0004'].map(idempotency_key =>
      service.addMealsFromScan(owner, { ...body, idempotency_key, items: [{ ...item, evidence_ref: otherProof }] })));
    expect(competing.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(competing.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await service.read(owner)).meals).toHaveLength(2);
  } finally {
    vi.unstubAllEnvs();
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await connection.close();
  }
});

// Real isolated MongoDB; provider data is synthetic, and no browser/JWT is used.
it.skipIf(!process.env.PQ_TEST_MONGO_URI)('persists corrected scan selections with server-priced nutrition and user isolation', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`;
  const connection = await createConnection(process.env.PQ_TEST_MONGO_URI!, { dbName, serverSelectionTimeoutMS: 3000 }).asPromise();
  try {
    const config = new FoodScanConfigService(new ConfigService());
    const food = { fdcId: 101, description: 'Roasted chicken', dataType: 'test', kcal_per_100g: 165, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 };
    const egg = { ...food, fdcId: 102, description: 'Fried egg', kcal_per_100g: 200 };
    const usda = { lookupFood: async () => food, getNutrients: async (id: number) => id === 101 ? food : egg };
    const scan = new FoodScanService(config, new FoodScanSchemasService(config), { detectFoods: async () => [{ food_name: 'chicken', est_weight_g: 100, confidence: 0.8 }, { food_name: 'extra', est_weight_g: 20, confidence: 0.2 }] } as never, usda as never);
    const analyzed = await scan.analyze({ image: TINY_PNG_BASE64 }, 'test');
    expect(analyzed.items).toHaveLength(2);
    const owner = new Types.ObjectId().toString(), other = new Types.ObjectId().toString();
    await connection.collection('account_lifecycle').insertMany([owner, other].map(id => ({ _id: new Types.ObjectId(String(id)), status: 'active', generation: 0, writeVersion: 0 })));
    const nutrition = new NutritionService(connection.model('Nutrition', NutritionSchema), usda as never);
    // Simulates review: replace the first match, add an egg and exclude the second.
    await nutrition.addMealsFromScan(owner, { meal: 'Dinner', items: [
      { ...analyzed.items[0], food_name: 'Roasted chicken', fdc_id: 101, est_weight_g: 120, kcal: 999, identification_method: 'corrected' },
      { food_name: 'Fried egg', found: true, fdc_id: 102, est_weight_g: 50, confidence: 0, identification_method: 'manual', kcal: 999, protein_g: null, carbs_g: null, fat_g: null },
    ] });
    const saved = await nutrition.read(owner), isolated = await nutrition.read(other);
    expect(saved.meals).toHaveLength(2);
    expect(saved.meals[0]).toMatchObject({ name: 'Roasted chicken', fdcId: 101, estWeightG: 120, calories: 198, protein: 37.2, nutritionProvider: 'USDA FoodData Central' });
    expect(saved.meals[1]).toMatchObject({ name: 'Fried egg', fdcId: 102, estWeightG: 50, calories: 100, identificationMethod: 'manual' });
    expect(isolated.meals).toEqual([]);
  } finally {
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await connection.close();
  }
});

it.skipIf(!process.env.PQ_TEST_MONGO_URI)('runs authenticated scanner and meal HTTP routes with real isolated MongoDB and mocked providers', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`, secret = 'isolated-foodscan-test-secret';
  const owner = new Types.ObjectId().toString(), other = new Types.ObjectId().toString();
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_SECRET: secret, GEMINI_API_KEY: 'test', USDA_API_KEY: 'test' })] }),
      MongooseModule.forRoot(process.env.PQ_TEST_MONGO_URI!, { dbName }), PassportModule, FoodScanModule, NutritionModule],
    providers: [JwtStrategy, { provide: AuthService, useValue: { validateUser: async () => ({ sessionVersion: 0, emailVerified: true, $locals: { lifecycleGeneration: 0 } }) } }, { provide: SessionService, useValue: {} }],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const connection = app.get(getConnectionToken());
  const record = (id: number) => ({ fdcId: id, description: id === 101 ? 'Roasted chicken' : 'Fried egg', dataType: 'test', kcal_per_100g: id === 101 ? 165 : 200, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 });
  vi.spyOn(app.get<VisionProvider>(AI_VISION_PROVIDER), 'detectFoods').mockImplementation(async (_image, _mime, usage) => { usage?.({ input: 10, output: 2, total: 12 }); return [{ food_name: 'chicken', est_weight_g: 100, confidence: 0.8 }, { food_name: 'extra', est_weight_g: 20, confidence: 0.2 }]; });
  vi.spyOn(app.get(UsdaService), 'lookupFood').mockResolvedValue(record(101));
  vi.spyOn(app.get(UsdaService), 'getNutrients').mockImplementation(async id => record(id));
  vi.spyOn(app.get(UsdaService), 'searchCandidates').mockResolvedValue([{ fdc_id: 101, description: 'Roasted chicken', data_type: 'test' }]);
  try {
    await app.init();
    const api = request(app.getHttpServer()), token = (id: string) => `Bearer ${jwt.sign({ sub: id }, secret, { expiresIn: '5m' })}`;
    await connection.db.collection('users').insertMany([{ _id: new Types.ObjectId(owner), isActive: true }, { _id: new Types.ObjectId(other), isActive: true }]);
    await connection.collection('account_lifecycle').insertMany([owner, other].map(id => ({ _id: new Types.ObjectId(String(id)), status: 'active', generation: 0, writeVersion: 0 })));
    expect((await api.post('/nutrition/scan').send({ image: TINY_PNG_BASE64 })).status).toBe(401);
    const scan = await api.post('/nutrition/scan').set('Authorization', token(owner)).set('X-Request-ID', 'idempotent-scan-1').send({ image: TINY_PNG_BASE64 });
    expect(scan.status).toBe(200);
    const duplicate = await api.post('/nutrition/scan').set('Authorization', token(owner)).set('X-Request-ID', 'idempotent-scan-1').send({ image: TINY_PNG_BASE64 });
    expect(duplicate.status).toBe(400);
    expect(app.get<VisionProvider>(AI_VISION_PROVIDER).detectFoods).toHaveBeenCalledTimes(1);
    const search = await api.get('/nutrition/foods/search?q=roasted').set('Authorization', token(owner));
    expect(search.status).toBe(200);
    const detail = await api.get('/nutrition/foods/101').set('Authorization', token(owner));
    expect(detail.status).toBe(200);
    const items = [{ ...scan.body.items[0], food_name: 'Roasted chicken', fdc_id: 101, est_weight_g: 120, kcal: 999, identification_method: 'corrected' },
      { food_name: 'Fried egg', found: true, fdc_id: 102, est_weight_g: 50, confidence: 0, identification_method: 'manual', kcal: 999, protein_g: null, carbs_g: null, fat_g: null }];
    const save = await api.post('/nutrition/meals/from-scan').set('Authorization', token(owner)).send({ meal: 'Dinner', items });
    expect(save.status).toBe(201);
    const diary = await api.get('/nutrition').set('Authorization', token(owner));
    expect(diary.body.meals).toHaveLength(2);
    expect(diary.body.meals[0]).toMatchObject({ name: 'Roasted chicken', fdcId: 101, estWeightG: 120, calories: 198, protein: 37.2, nutritionProvider: 'USDA FoodData Central' });
    expect(diary.body.meals[1]).toMatchObject({ name: 'Fried egg', fdcId: 102, calories: 100, identificationMethod: 'manual' });
    expect((await api.get('/nutrition').set('Authorization', token(other))).body.meals).toEqual([]);
    expect((await api.get('/nutrition/scan-usage').set('Authorization', token(owner))).body).toMatchObject({ scans: 1, successful: 1, input_tokens: 10, output_tokens: 2, total_tokens: 12 });
    expect((await api.get('/nutrition/scan-usage').set('Authorization', token(other))).body).toMatchObject({ scans: 0 });
    // Same key and payload across concurrent requests yields one atomic write and the same receipt.
    await connection.collection('nutrition').createIndex({ userId: 1 }, { unique: true });
    const saveBody = { meal: 'Lunch', items, idempotency_key: 'save_request_1234567890' };
    const attempts = await Promise.all(Array.from({ length: 5 }, () => api.post('/nutrition/meals/from-scan').set('Authorization', token(owner)).send(saveBody)));
    expect(attempts.every(response => response.status === 201)).toBe(true);
    expect(attempts.map(response => response.body)).toEqual(Array(5).fill(attempts[0].body));
    expect((await api.get('/nutrition/meals/from-scan/receipts/save_request_1234567890').set('Authorization', token(owner))).body).toMatchObject({ status: 'confirmed', save_id: 'save_request_1234567890', meal_ids: attempts[0].body.meal_ids });
    expect((await api.get('/nutrition/meals/from-scan/receipts/save_request_1234567890').set('Authorization', token(other))).body).toEqual({ status: 'unknown' });
    expect((await api.get('/nutrition/meals/from-scan/receipts/save_request_1234567890')).status).toBe(401);
    expect((await api.get('/nutrition').set('Authorization', token(owner))).body.meals).toHaveLength(4);
    expect((await api.post('/nutrition/meals/from-scan').set('Authorization', token(owner)).send({ ...saveBody, meal: 'Snack' })).status).toBe(409);
    expect((await api.post('/nutrition/meals/from-scan').set('Authorization', token(other)).send(saveBody)).status).toBe(201);
    const newUser = new Types.ObjectId().toString();
    await connection.collection('account_lifecycle').insertMany([newUser].map(id => ({ _id: new Types.ObjectId(String(id)), status: 'active', generation: 0, writeVersion: 0 })));
    const firstWrites = await Promise.all(Array.from({ length: 5 }, () => api.post('/nutrition/meals/from-scan').set('Authorization', token(newUser)).send(saveBody)));
    expect(firstWrites.every(response => response.status === 201)).toBe(true);
    expect(firstWrites.map(response => response.body)).toEqual(Array(5).fill(firstWrites[0].body));
    expect((await api.get('/nutrition').set('Authorization', token(newUser))).body.meals).toHaveLength(2);
  } finally {
    vi.restoreAllMocks();
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await app.close();
  }
});

it.skipIf(!process.env.PQ_TEST_MONGO_URI)('shares atomic quota and persistent usage between instances', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`;
  const connection = await createConnection(process.env.PQ_TEST_MONGO_URI!, { dbName, serverSelectionTimeoutMS: 3000 }).asPromise();
  try {
    const user = new Types.ObjectId().toString(), other = new Types.ObjectId().toString();
    await connection.db!.collection('users').insertOne({ _id: new Types.ObjectId(user), isActive: true });
    await connection.collection('account_lifecycle').insertMany([user, other].map(id => ({ _id: new Types.ObjectId(String(id)), status: 'active', generation: 0, writeVersion: 0 })));
    const config = { value: { rateLimit: { enabled: true, max: 3, windowMs: 3600000 } } };
    const guard = () => new ScanRateLimitGuard(config as never, { event: () => {} } as never, connection);
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { userId: user, lifecycleGeneration: 0 }, path: '/nutrition/scan' }), getResponse: () => ({ setHeader: () => {} }) }) } as never;
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => guard().canActivate(context)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
    const ledger = new FoodScanUsageService(connection), id = await ledger.begin(user, 'test', 'test-model');
    await ledger.finish(id, 'success', { input: 10, output: 2, total: 12 });
    await expect(ledger.begin(user, 'test', 'test-model')).rejects.toThrow();
    expect(await new FoodScanUsageService(connection).summary(user)).toMatchObject({ scans: 1, successful: 1, input_tokens: 10, output_tokens: 2, total_tokens: 12 });
    expect(await ledger.summary(other)).toMatchObject({ scans: 0, input_tokens: null });
    const stale = await ledger.begin(user, 'stale', 'test-model');
    const old = await ledger.begin(user, 'old-complete', 'test-model');
    const unresolved = await ledger.begin(user, 'old-unresolved', 'test-model');
    await ledger.finish(old, 'success', { input: 1, output: 1, total: 2 });
    await ledger.finish(unresolved, 'failure', null);
    const records = connection.db!.collection('food_scan_usage');
    await records.updateOne({ _id: stale } as never, { $set: { createdAt: new Date(Date.now() - 60 * 60_000) } });
    await records.updateMany({ _id: { $in: [old, unresolved] } } as never, { $set: { resolvedAt: new Date(Date.now() - 100 * 86400_000) } });
    await Promise.all([ledger.maintain(), new FoodScanUsageService(connection).maintain()]);
    expect((await records.findOne({ _id: stale } as never))?.status).toBe('incomplete');
    await ledger.finish(stale, 'success', { input: 4, output: 2, total: 6 });
    expect(await records.findOne({ _id: stale } as never)).toMatchObject({ status: 'success', usageComplete: true });
    expect(await records.findOne({ _id: old } as never)).toBeNull();
    expect(await records.findOne({ _id: unresolved } as never)).toBeTruthy();
  } finally {
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await connection.close();
  }
});

it.skipIf(!process.env.PQ_TEST_MONGO_URI)('refuses startup index creation when legacy users have duplicate nutrition documents', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`;
  const connection = await createConnection(process.env.PQ_TEST_MONGO_URI!, { dbName, serverSelectionTimeoutMS: 3000 }).asPromise();
  try {
    const userId = new Types.ObjectId();
    await connection.db!.collection('nutrition').insertMany([{ userId }, { userId }]);
    const service = new NutritionService(connection.model('Nutrition', NutritionSchema));
    await expect(service.onModuleInit()).rejects.toThrow();
    expect(await connection.db!.collection('nutrition').countDocuments({ userId })).toBe(2);
  } finally {
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await connection.close();
  }
});

it.skipIf(!process.env.PQ_TEST_MONGO_URI)('shares quotas and idempotent saves across independent Node processes', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`, owner = new Types.ObjectId().toString();
  const connection = await createConnection(process.env.PQ_TEST_MONGO_URI!, { dbName, serverSelectionTimeoutMS: 3000 }).asPromise();
  try {
    await connection.db!.collection('nutrition').createIndex({ userId: 1 }, { unique: true });
    await connection.collection('account_lifecycle').insertMany([owner].map(id => ({ _id: new Types.ObjectId(String(id)), status: 'active', generation: 0, writeVersion: 0 })));
    const run = promisify(execFile);
    const env = { ...process.env, PQ_INSTANCE_DB: dbName, PQ_INSTANCE_USER: owner };
    const results = await Promise.all(Array.from({ length: 4 }, () => run(process.execPath, ['test/foodscan-instance-worker.mjs'], { env, timeout: 20000 }).then(result => JSON.parse(result.stdout))));
    expect(results.filter(result => result.allowed)).toHaveLength(2);
    expect(results.map(result => result.receipt)).toEqual(Array(4).fill(results[0].receipt));
    expect((await connection.db!.collection('nutrition').findOne({ userId: new Types.ObjectId(owner) }))?.meals).toHaveLength(1);
  } finally {
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await connection.close();
  }
});
