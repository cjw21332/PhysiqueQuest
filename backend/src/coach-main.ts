import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { StandaloneCoachModule } from './coach/standalone-coach.module.js';
import { isAllowedFrontendOrigin } from './common/cors-policy.js';
import { securityMiddleware } from './common/security.middleware.js';
import { compressionMiddleware } from './common/compression.middleware.js';
import { queryValidationMiddleware } from './common/query-validation.middleware.js';

const app = await NestFactory.create<NestExpressApplication>(StandaloneCoachModule, { bodyParser: false });
app.setGlobalPrefix('api');
app.use(securityMiddleware(process.env));
app.use(compressionMiddleware);
app.use(queryValidationMiddleware);
app.useBodyParser('json', { limit: '32kb' });
const origins = (process.env.COACH_FRONTEND_URL || process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(value => value.trim());
app.enableCors({ origin: (origin, callback) => callback(isAllowedFrontendOrigin(origin, origins, process.env.NODE_ENV) ? null : new Error('Origin is not allowed by CORS'), true), methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] });
app.enableShutdownHooks();
await app.listen(Number(process.env.COACH_PORT || 4050), '0.0.0.0');
