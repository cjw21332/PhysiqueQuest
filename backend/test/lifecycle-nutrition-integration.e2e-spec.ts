import { randomBytes } from 'node:crypto';
import { createConnection, Types } from 'mongoose';
import { AuthService } from '../src/auth/auth.service.js';
import { GoogleAuthService } from '../src/auth/google-auth.service.js';
import { UserSchema } from '../src/auth/schemas/user.schema.js';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { NutritionSchema } from '../src/nutrition/schemas/nutrition.schema.js';

it.skipIf(!process.env.PQ_TEST_REPLICA_URI)('registers both account types and fences real nutrition writes and receipts', async () => {
  const name = `pq_slice_${randomBytes(12).toString('hex')}`;
  const connection = await createConnection(process.env.PQ_TEST_REPLICA_URI!, { dbName: name, serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    const users = connection.model('User', UserSchema);
    const events = { create: async () => ({}) };
    const auth = new AuthService(users, events as never, { sign: () => 'token' } as never);
    const registered = await auth.register({ email: 'local@example.test', name: 'Local', password: 'Example-Password1', requestId: 'x', code: '123456' });
    const identity = { verify: async () => ({ email: 'google@example.test', name: 'Google', uid: 'google-synthetic' }) };
    const google = new GoogleAuthService(users, events as never, identity as never, { consumeRegistration: async () => {} } as never);
    const googleUser = await google.register({ idToken: 'synthetic', password: 'Example-Password1', requestId: 'x', code: '123456' });
    for (const id of [registered.user.id, String(googleUser._id)]) expect(await connection.collection('account_lifecycle').findOne({ _id: new Types.ObjectId(id) })).toMatchObject({ status: 'active' });
    const service = new NutritionService(connection.model('Nutrition', NutritionSchema));
    await service.onModuleInit();
    const body = { meal: 'Lunch', idempotency_key: 'protected_save_123456', items: [{ food_name: 'Unknown food', found: false, est_weight_g: 100 }] };
    const saves = await Promise.all(Array.from({ length: 3 }, () => service.addMealsFromScan(registered.user.id, body)));
    expect(saves).toEqual([saves[0], saves[0], saves[0]]);
    const doc = await connection.collection('nutrition').findOne({ userId: new Types.ObjectId(registered.user.id) });
    expect(doc?.meals).toHaveLength(1);
    expect(doc?.scanSaveReceipts).toHaveLength(1);
    await expect(service.addMealsFromScan(registered.user.id, { ...body, meal: 'Dinner' })).rejects.toThrow();
    const missing = new Types.ObjectId();
    await expect(service.addMeal(String(missing), { name: 'Food', meal: 'Lunch', calories: 1 } as never)).rejects.toThrow();
    expect(await connection.collection('nutrition').findOne({ userId: missing })).toBeNull();
  } finally {
    try { if (/^pq_slice_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
});
