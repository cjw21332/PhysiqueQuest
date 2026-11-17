import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createConnection, Types } from 'mongoose';
import { FoodScanUsageService } from '../src/foodscan/foodscan-usage.service.js';
import { AnalysisJobsService } from '../src/jobs/analysis-jobs.service.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';

it.skipIf(!process.env.PQ_TEST_REPLICA_URI)('fences usage and a delayed job enqueue against actual deletion', async () => {
  const name = `pq_usage_jobs_${randomBytes(12).toString('hex')}`;
  const connection = await createConnection(process.env.PQ_TEST_REPLICA_URI!, { dbName: name, serverSelectionTimeoutMS: 5000 }).asPromise();
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-test-secret';
  try {
    const db = connection.db!, owner = new Types.ObjectId();
    await db.collection('users').insertOne({ _id: owner, isActive: true, deletedAt: null, passwordHash: await bcrypt.hash('synthetic-password', 4) });
    await db.collection('account_lifecycle').insertOne({ _id: owner, status: 'active', writeVersion: 0 });
    const usage = new FoodScanUsageService(connection);
    const reservation = await usage.begin(String(owner), 'synthetic-request', 'synthetic-model');
    await expect(usage.begin(String(owner), 'synthetic-request', 'synthetic-model')).rejects.toThrow();
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const storage = { download: async () => { entered(); await gate; }, deleteUserObjects: async () => 0 };
    const jobs = new AnalysisJobsService(connection, storage as never, {} as never, usage, {} as never);
    const pending = jobs.enqueue(String(owner), String(new Types.ObjectId()));
    await waiting;
    const privacy = new PrivacyService(connection, storage as never);
    await privacy.requestDeletion(String(owner), 'synthetic-password');
    await db.collection('users').updateOne({ _id: owner }, { $set: { purgeAfter: new Date(0) } });
    await privacy.purgeUser(String(owner));
    release();
    await expect(pending).rejects.toThrow();
    await expect(usage.finish(reservation, 'success', { input: 1, output: 1, total: 2 })).rejects.toThrow();
    await expect(usage.begin(String(owner), 'after-deletion', 'synthetic-model')).rejects.toThrow();
    expect(await db.collection('food_scan_usage').countDocuments({ userId: owner })).toBe(0);
    expect(await db.collection('analysis_jobs').countDocuments({ userId: owner })).toBe(0);
    expect(await db.collection('account_lifecycle').findOne({ _id: owner })).toMatchObject({ status: 'deleted' });
  } finally {
    process.env.JWT_SECRET = previousSecret;
    try { if (/^pq_usage_jobs_[a-f0-9]{24}$/.test(connection.name)) await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
});
