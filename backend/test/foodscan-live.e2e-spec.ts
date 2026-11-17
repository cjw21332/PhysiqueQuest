import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { AuthService } from '../src/auth/auth.service.js';
import { SessionService } from '../src/auth/session.service.js';
import { FoodScanModule } from '../src/foodscan/foodscan.module.js';
import { TINY_PNG_BASE64 } from './foodscan.fixtures.js';

// Explicit opt-in: makes a billable Gemini call using a synthetic image.
it.skipIf(process.env.PQ_LIVE_FOODSCAN !== '1' || !process.env.PQ_TEST_MONGO_URI || !process.env.GEMINI_API_KEY)('records the actual authenticated scan outcome against an isolated database', async () => {
  const dbName = `pq_foodscan_test_${randomUUID().replaceAll('-', '')}`, secret = 'isolated-live-diagnostic-secret', user = new Types.ObjectId();
  const moduleRef = await Test.createTestingModule({ imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_SECRET: secret, GEMINI_API_KEY: process.env.GEMINI_API_KEY, USDA_API_KEY: process.env.USDA_API_KEY })] }),
    MongooseModule.forRoot(process.env.PQ_TEST_MONGO_URI!, { dbName }), PassportModule, FoodScanModule,
  ], providers: [JwtStrategy, { provide: AuthService, useValue: { validateUser: async () => ({ sessionVersion: 0, emailVerified: true, $locals: { lifecycleGeneration: 0 } }) } }, { provide: SessionService, useValue: {} }] }).compile();
  const app = moduleRef.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const connection = app.get(getConnectionToken());
  try {
    await app.init();
    // The quota path fails closed without an active lifecycle row, so the live
    // diagnostic must provision the same account state registration creates.
    await connection.db.collection('users').insertOne({ _id: user, isActive: true, deletedAt: null, purgingAt: null });
    await connection.db.collection('account_lifecycle').insertOne({ _id: user, status: 'active', generation: 0, writeVersion: 0 });
    const start = Date.now(), token = jwt.sign({ sub: String(user) }, secret, { expiresIn: '5m' });
    const response = await request(app.getHttpServer()).post('/nutrition/scan').set('Authorization', `Bearer ${token}`).send({ image: TINY_PNG_BASE64 });
    const record = await connection.db.collection('food_scan_usage').findOne({ userId: user });
    expect(record).toBeTruthy();
    expect([200, 400, 429, 502, 503, 504]).toContain(response.status);
    process.stdout.write(`LIVE_SCAN_DIAGNOSTIC status=${response.status} duration_ms=${Date.now() - start} ledger_status=${record.status} usage_available=${record.usageAvailable}\n`);
  } finally {
    if (/^pq_foodscan_test_[a-f0-9]{32}$/.test(connection.name)) await connection.dropDatabase();
    await app.close();
  }
}, 45000);
