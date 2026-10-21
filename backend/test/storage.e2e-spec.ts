import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createConnection, Types, type Connection } from 'mongoose';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { StorageService } from '../src/storage/storage.service.js';
import { StorageController } from '../src/storage/storage.controller.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
try { loadEnvFile('.env'); } catch { /* Environment-only runner is supported. */ }
describe.skipIf(process.env.PQ_SECURITY_DB_TEST !== '1' || !process.env.MONGODB_URI)('local private storage HTTP and retention', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`, owner = String(new Types.ObjectId());
  let connection: Connection, storage: StorageService, app: INestApplication, directory: string;
  const saved = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR, JWT_SECRET: process.env.JWT_SECRET };
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pq-storage-test-'));
    process.env.STORAGE_DRIVER = 'local'; process.env.STORAGE_LOCAL_DIR = directory; process.env.JWT_SECRET = randomBytes(32).toString('hex');
    connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10_000 }).asPromise();
    storage = new StorageService(connection);
    const module = await Test.createTestingModule({ controllers: [StorageController], providers: [{ provide: StorageService, useValue: storage }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: ExecutionContext) { context.switchToHttp().getRequest().user = { userId: owner }; return true; } }).compile();
    app = module.createNestApplication({ logger: false }); app.setGlobalPrefix('api'); await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (connection) { try { if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw Error('Unsafe database cleanup'); await connection.dropDatabase(); } finally { await connection.close(); } }
    if (directory) { if (!resolve(directory).startsWith(resolve(tmpdir()) + '\\') && !resolve(directory).startsWith(resolve(tmpdir()) + '/')) throw Error('Unsafe directory cleanup'); await rm(directory, { recursive: true, force: true }); }
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  const image = Buffer.from('89504e470d0a1a0a00000000', 'hex');
  it('uploads exact image bytes, verifies content and signs private downloads without accepting another owner', async () => {
    const created = await request(app.getHttpServer()).post('/api/storage/uploads').send({ contentType: 'image/png', size: image.length }).expect(201);
    await expect(storage.download(created.body.id, owner)).rejects.toThrow('not verified');
    await request(app.getHttpServer()).put(created.body.uploadUrl).set('Content-Type', 'image/png').send(image).expect(200);
    await request(app.getHttpServer()).post(`/api/storage/uploads/${created.body.id}/complete`).send({}).expect(201);
    await expect(storage.download(created.body.id, String(new Types.ObjectId()))).rejects.toThrow();
    const download = await request(app.getHttpServer()).get(`/api/storage/uploads/${created.body.id}/download`).expect(200);
    const result = await request(app.getHttpServer()).get(download.body.downloadUrl).expect(200);
    expect(result.body).toEqual(image);
    await request(app.getHttpServer()).get(download.body.downloadUrl.replace(/.$/, 'x')).expect(404);
    await storage.markAnalyzed(created.body.id, owner);
    const first = await connection.collection('storage_uploads').findOne({ _id: new Types.ObjectId(created.body.id) });
    await storage.markAnalyzed(created.body.id, owner);
    expect((await connection.collection('storage_uploads').findOne({ _id: first!._id }))!.expiresAt).toEqual(first!.expiresAt);
    expect(await storage.deleteUserObjects(owner)).toBe(1);
    await expect(access(join(directory, first!.key))).rejects.toThrow();
  });
  it('rejects spoofed images and pose media; cleanup is object-first, idempotent and expires orphan metadata', async () => {
    await expect(storage.createUpload(owner, 'video/mp4', 20)).rejects.toThrow();
    const upload = await storage.createUpload(owner, 'image/png', image.length);
    await request(app.getHttpServer()).put(upload.uploadUrl).set('Content-Type', 'image/png').send(Buffer.alloc(image.length)).expect(400);
    await request(app.getHttpServer()).put(upload.uploadUrl).set('Content-Type', 'image/png').send(image).expect(200);
    const record = await connection.collection('storage_uploads').findOne({ _id: new Types.ObjectId(upload.id) });
    await connection.collection('storage_uploads').updateOne({ _id: record!._id }, { $set: { expiresAt: new Date(0) } });
    expect(await storage.cleanup()).toEqual({ deleted: 1 });
    expect(await storage.cleanup()).toEqual({ deleted: 0 });
    await expect(access(join(directory, record!.key))).rejects.toThrow();
    expect(await connection.collection('storage_uploads').findOne({ _id: record!._id })).toBeNull();
  });
});
