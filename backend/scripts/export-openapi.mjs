import 'reflect-metadata';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createConnection } from 'mongoose';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { VERSION_NEUTRAL, VersioningType } from '@nestjs/common';

// Schema export never opens a database or reads deployment credentials.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/openapi_export_unused';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { AppModule } = await import('../dist/app.module.js');
const { createOpenApiDocument } = await import('../dist/openapi.js');
const connection = createConnection();
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(getConnectionToken()).useValue(connection).compile();
const app = module.createNestApplication({ logger: false });
try {
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: [VERSION_NEUTRAL, '1'] });
  const document = createOpenApiDocument(app);
  assert(document.paths['/api/auth/session/login']);
  assert(document.components.schemas.LoginDto.properties.email);
  assert(document.components.securitySchemes.refreshCookie);
  assert(document.components.schemas.StandardError);
  await writeFile(new URL('../openapi.json', import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Exported openapi.json: ${Object.keys(document.paths).length} paths; no database connection.`);
} finally {
  await app.close();
  await connection.close();
}
