import { createConnection } from 'mongoose';
import { NutritionSchema } from '../dist/nutrition/schemas/nutrition.schema.js';
import { NutritionService } from '../dist/nutrition/nutrition.service.js';
import { ScanRateLimitGuard } from '../dist/common/foodscan/scan-rate-limit.guard.js';
const connection = await createConnection(process.env.PQ_TEST_MONGO_URI, { dbName: process.env.PQ_INSTANCE_DB, serverSelectionTimeoutMS: 3000 }).asPromise();
try {
  const userId = process.env.PQ_INSTANCE_USER;
  const guard = new ScanRateLimitGuard({ value: { rateLimit: { enabled: true, max: 2, windowMs: 3600000 } } }, { event() {} }, connection);
  const context = { switchToHttp: () => ({ getRequest: () => ({ user: { userId, lifecycleGeneration: 0 }, path: '/nutrition/scan' }), getResponse: () => ({ setHeader() {} }) }) };
  let allowed; try { await guard.canActivate(context); allowed = true; } catch (error) { if (error.code !== 'RATE_LIMITED') throw error; allowed = false; }
  const service = new NutritionService(connection.model('Nutrition', NutritionSchema));
  const receipt = await service.addMealsFromScan(userId, { meal: 'Dinner', idempotency_key: 'multiprocess_test_12345', items: [{ food_name: 'unknown', found: false, est_weight_g: 100, kcal: null, protein_g: null, carbs_g: null, fat_g: null }] });
  process.stdout.write(JSON.stringify({ allowed, receipt }));
} finally { await connection.close(); }
