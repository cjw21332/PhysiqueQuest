import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createConnection, Types } from 'mongoose';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { NutritionSchema } from '../src/nutrition/schemas/nutrition.schema.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';

// This is an application-level regression test. It deliberately asserts the
// required safety property; until the real deletion and save paths share a
// fence, it fails and must not be treated as evidence of a completed fix.
it.skipIf(!process.env.PQ_TEST_REPLICA_URI)('does not resurrect nutrition when an actual purge wins during a USDA lookup', async () => {
  const database = `pq_actual_race_${randomBytes(12).toString('hex')}`;
  const connection = await createConnection(process.env.PQ_TEST_REPLICA_URI!, { dbName: database, serverSelectionTimeoutMS: 5000 }).asPromise();
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-race-test-secret';
  try {
    const db = connection.db!;
    const owner = new Types.ObjectId(), other = new Types.ObjectId();
    await db.collection('users').insertOne({ _id: owner, isActive: true, deletedAt: null, passwordHash: await bcrypt.hash('synthetic-password', 4) });
    await db.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0 });
    await db.collection('nutrition').insertOne({ userId: other, meals: [{ name: 'Other user meal' }] });
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const usda = { getNutrients: async () => { entered(); await gate; return { description: 'Chicken', kcal_per_100g: 165, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 }; } };
    const nutrition = new NutritionService(connection.model('Nutrition', NutritionSchema), usda as never);
    await nutrition.onModuleInit();
    const privacy = new PrivacyService(connection, { deleteUserObjects: async () => 0 } as never);
    const save = nutrition.addMealsFromScan(String(owner), { meal: 'Lunch', idempotency_key: 'race_request_123456789', items: [{ food_name: 'Chicken', found: true, fdc_id: 101, est_weight_g: 100 }] });
    await waiting;
    await privacy.requestDeletion(String(owner), 'synthetic-password');
    await db.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } });
    await privacy.purgeUser(String(owner));
    expect(await db.collection('users').findOne({ _id: owner })).toBeNull();
    release();
    await expect(save).rejects.toThrow('Account data is unavailable');
    expect(await db.collection('nutrition').findOne({ userId: owner })).toBeNull();
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleted' });
    expect(await db.collection('nutrition').findOne({ userId: other })).toMatchObject({ userId: other });
  } finally {
    process.env.JWT_SECRET = previousSecret;
    try { if (/^pq_actual_race_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
});

it.skipIf(!process.env.PQ_TEST_REPLICA_URI)('rejects a delayed scan started before deletion even if the account is recovered', async () => {
  const database = `pq_actual_race_${randomBytes(12).toString('hex')}`;
  const connection = await createConnection(process.env.PQ_TEST_REPLICA_URI!, { dbName: database, serverSelectionTimeoutMS: 5000 }).asPromise();
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-race-test-secret';
  try {
    const db = connection.db!, owner = new Types.ObjectId();
    await db.collection('users').insertOne({ _id: owner, email: 'synthetic@example.test', isActive: true, deletedAt: null, passwordHash: await bcrypt.hash('synthetic-password', 4) });
    await db.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0 });
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const usda = { getNutrients: async () => { entered(); await gate; return { description: 'Chicken', kcal_per_100g: 165, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 }; } };
    const nutrition = new NutritionService(connection.model('Nutrition', NutritionSchema), usda as never);
    const privacy = new PrivacyService(connection, { deleteUserObjects: async () => 0 } as never);
    const save = nutrition.addMealsFromScan(String(owner), { meal: 'Lunch', items: [{ food_name: 'Chicken', found: true, fdc_id: 101, est_weight_g: 100 }] });
    await waiting;
    await privacy.requestDeletion(String(owner), 'synthetic-password');
    await privacy.recover('synthetic@example.test', 'synthetic-password');
    release();
    await expect(save).rejects.toThrow('Account data is unavailable');
    expect(await db.collection('nutrition').findOne({ userId: owner })).toBeNull();
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'active', generation: 2 });
  } finally {
    process.env.JWT_SECRET = previousSecret;
    try { if (/^pq_actual_race_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
});
