import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, Types, type Connection } from 'mongoose';
import { Nutrition, NutritionSchema } from '../src/nutrition/schemas/nutrition.schema.js';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
try { loadEnvFile('.env'); } catch { /* Explicit runner configuration is also supported. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('atomic nutrition updates', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection;
  beforeAll(async () => { connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10_000 }).asPromise(); });
  afterAll(async () => {
    if (!connection) return;
    try { if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw Error('Unsafe test cleanup'); await connection.dropDatabase(); }
    finally { await connection.close(); }
  });
  it('retains simultaneous water writes with one entry per day and scopes meal edits to the owner', async () => {
    const model = connection.model(Nutrition.name, NutritionSchema); await model.init();
    const service = new NutritionService(model), owner = String(new Types.ObjectId());
    await service.get(owner);
    await Promise.all(Array.from({ length: 10 }, (_, i) => service.setWater(owner, { date: `2026-10-${String(i + 1).padStart(2, '0')}`, glasses: i })));
    await Promise.all(Array.from({ length: 5 }, () => service.setWater(owner, { date: '2026-10-01', glasses: 2 })));
    expect((await service.read(owner)).water).toHaveLength(10);
    await Promise.all(Array.from({ length: 5 }, () => service.setWater(owner, { date: '2026-10-21', glasses: 2 })));
    expect((await service.read(owner)).water.filter(entry => entry.date === '2026-10-21')).toHaveLength(1);
    await service.addMeal(owner, { id: 'meal', name: 'Rice', meal: 'Lunch', calories: 100, source: 'Scanned', time: '12:00' });
    await expect(service.updateMeal(String(new Types.ObjectId()), 'meal', { name: 'Stolen', meal: 'Lunch', calories: 2 })).rejects.toThrow();
    const edited = await service.updateMeal(owner, 'meal', { name: 'Edited', meal: 'Lunch', calories: 200, source: 'Manual', time: '20:00' });
    expect(edited.meals[0]).toMatchObject({ name: 'Edited', calories: 200, source: 'Scanned', time: '12:00', edited: true });
    const credits = await service.read(owner, 'userId meals.date water.date water.glasses');
    expect(credits.meals[0]).not.toHaveProperty('name');
    expect(credits.meals[0]).toHaveProperty('date');
  });
});
