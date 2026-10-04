import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

/**
 * Boots the whole application, which means Mongoose and the JWT config are real
 * dependencies. Skipped unless a database is configured, so `npm run test:e2e`
 * is meaningful where one exists and does not fail spuriously where it does not.
 */
const hasDatabase = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET);

describe.skipIf(!hasDatabase)('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app?.close();
  });
});
