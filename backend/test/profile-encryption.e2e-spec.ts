import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createConnection, Types, type Connection } from 'mongoose';
import { Profile, ProfileSchema } from '../src/profile/schemas/profile.schema.js';
try { loadEnvFile('.env'); } catch { /* Runner environment is also supported. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('profile field encryption persistence', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  const saved = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  let connection: Connection;
  beforeAll(async () => {
    process.env.HEALTH_DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10_000 }).asPromise();
  });
  afterAll(async () => {
    if (saved === undefined) delete process.env.HEALTH_DATA_ENCRYPTION_KEY; else process.env.HEALTH_DATA_ENCRYPTION_KEY = saved;
    if (!connection) return;
    try { if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw Error('Unsafe test cleanup'); await connection.dropDatabase(); }
    finally { await connection.close(); }
  });
  it('encrypts stored create/save/update fields while hydrated, lean and JSON reads return plaintext', async () => {
    const model = connection.model(Profile.name, ProfileSchema); await model.init();
    const userId = new Types.ObjectId();
    const profile = await model.create({ userId, name: 'Synthetic', age: '25', height: '170', heightUnit: 'cm', weight: '70', weightUnit: 'kg', gender: 'Other', activity: 'active', goal: 'fitness', seriousness: 'casual', equipment: [], days: [], duration: '30', conditions: ['Asthma'], healthNotes: 'Private', contactName: 'Contact', contactPhone: '123' });
    expect(profile.healthNotes).toBe('Private');
    expect(profile.toJSON().conditions).toEqual(['Asthma']);
    const stored = await model.collection.findOne({ userId });
    expect(stored!.healthNotes).toMatch(/^pqenc:v1:/);
    expect(stored!.conditions[0]).toMatch(/^pqenc:v1:/);
    expect((await model.findOne({ userId }))!.contactName).toBe('Contact');
    expect((await model.findOne({ userId }).lean())!.healthNotes).toBe('Private');
    const changed = await model.findOneAndUpdate({ userId }, { $set: { healthNotes: 'Updated', conditions: ['Changed'] } }, { returnDocument: 'after', runValidators: true });
    expect(changed!.healthNotes).toBe('Updated');
    expect((await model.collection.findOne({ userId }))!.healthNotes).toMatch(/^pqenc:v1:/);
    changed!.contactPhone = '456'; await changed!.save();
    expect(changed!.contactPhone).toBe('456');
    expect((await model.find({ userId }).lean())[0].contactPhone).toBe('456');
    expect((await model.findOne({ userId }).select('name').lean())!.name).toBe('Synthetic');
    const stale = await model.findOne({ userId });
    await model.findOneAndUpdate({ userId }, { $set: { healthNotes: 'Concurrent change' } });
    stale!.name = 'Unrelated edit'; await stale!.save();
    expect((await model.findOne({ userId }))!.healthNotes).toBe('Concurrent change');
    expect((await model.findOne({ userId }))!.name).toBe('Unrelated edit');
    await expect(model.updateOne({ userId }, { $push: { conditions: 'Unsafe' } })).rejects.toThrow('Unsupported profile update');
    const inserted = await model.insertMany([{ ...profile.toObject(), _id: new Types.ObjectId(), userId: new Types.ObjectId() }]);
    expect(inserted[0].healthNotes).toBe('Private');
    expect((await model.collection.findOne({ _id: inserted[0]._id }))!.healthNotes).toMatch(/^pqenc:v1:/);
  });
  it('runs reversible migration twice in each direction without corrupting existing values', async () => {
    const collection = connection.collection('profiles'), userId = new Types.ObjectId();
    await collection.insertOne({ userId, conditions: ['Synthetic'], healthNotes: 'Migration fixture', contactName: 'Contact', contactPhone: '123' });
    const uri = new URL(process.env.MONGODB_URI!); uri.pathname = `/${database}`;
    const run = (mode: string) => JSON.parse(execFileSync(process.execPath, ['scripts/migrate-profile-encryption.mjs', mode], {
      env: { ...process.env, MONGODB_URI: uri.toString() }, encoding: 'utf8', timeout: 20_000,
    }).trim());
    expect(run('encrypt').changed).toBeGreaterThan(0);
    expect(run('encrypt').changed).toBe(0);
    expect((await collection.findOne({ userId }))!.healthNotes).toMatch(/^pqenc:v1:/);
    expect(run('decrypt').changed).toBeGreaterThan(0);
    expect(run('decrypt').changed).toBe(0);
    expect((await collection.findOne({ userId }))!.healthNotes).toBe('Migration fixture');
  }, 60_000);
});
