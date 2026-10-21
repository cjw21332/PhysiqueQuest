import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, Types, type Connection } from 'mongoose';
import { AnalysisJobsService } from '../src/jobs/analysis-jobs.service.js';
try { loadEnvFile('.env'); } catch { /* Runner env accepted. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('reference-only analysis jobs', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`; let connection: Connection, service: AnalysisJobsService;
  const storage = { download: vi.fn(async () => ({})), analysisInput: vi.fn(async () => ({ image: 'synthetic-image', mimeType: 'image/png' })), markAnalyzed: vi.fn(async () => {}) };
  const scanner = { analyze: vi.fn(async () => ({ items: [], totals: { kcal: 0 } })) };
  beforeAll(async () => { connection = await createConnection(process.env.MONGODB_URI!, { dbName: database }).asPromise(); service = new AnalysisJobsService(connection, storage as any, scanner as any); await service.onModuleInit(); service.onModuleDestroy(); });
  afterAll(async () => { if (!connection) return; try { if (connection.name !== database || !/^pq_security_test_[a-f0-9]{16}$/.test(database)) throw Error('Unsafe database'); await connection.dropDatabase(); } finally { await connection.close(); } });
  it('deduplicates by owned upload, keeps queue media-free, and publishes only owned results', async () => {
    const userId = new Types.ObjectId(), uploadId = String(new Types.ObjectId());
    await connection.collection('users').insertOne({ _id: userId, isActive: true });
    const first = await service.enqueue(String(userId), uploadId);
    expect((await service.enqueue(String(userId), uploadId)).id).toBe(first.id);
    const stored = await connection.collection('analysis_jobs').findOne({ _id: new Types.ObjectId(first.id) });
    expect(stored!.payload).toEqual({ userId: String(userId), resourceId: uploadId });
    expect(JSON.stringify(stored)).not.toContain('synthetic-image');
    await service.tick();
    expect((await service.status(String(userId), first.id)).status).toBe('completed');
    await expect(service.status(String(new Types.ObjectId()), first.id)).rejects.toThrow();
    expect(scanner.analyze).toHaveBeenCalledOnce();
    expect(storage.markAnalyzed).toHaveBeenCalledWith(uploadId, String(userId));
  });
  it('does not resurrect results when the account is deleted during analysis', async () => {
    const userId = new Types.ObjectId();
    await connection.collection('users').insertOne({ _id: userId, isActive: true });
    const job = await service.enqueue(String(userId), String(new Types.ObjectId()));
    scanner.analyze.mockImplementationOnce(async () => { await connection.collection('users').deleteOne({ _id: userId }); return { items: [], totals: { kcal: 0 } }; });
    await service.tick();
    expect(await connection.collection('analysis_results').findOne({ _id: new Types.ObjectId(job.id) })).toBeNull();
    expect((await service.status(String(userId), job.id)).status).toBe('failed');
  });
});
