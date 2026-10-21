import { NestFactory } from '@nestjs/core';
import { initializeSentry } from './common/sentry.js';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { PinoLogger } from './common/foodscan/pino-logger.js';
import { scannerBodyErrorHandler } from './common/foodscan/app-exception.filter.js';
import { FoodScanConfigService } from './common/foodscan/foodscan-config.js';
import { isAllowedFrontendOrigin } from './common/cors-policy.js';
import { SCANNER_ROUTE_PATHS } from './foodscan/foodscan.module.js';
import { securityMiddleware } from './common/security.middleware.js';
import { SafeExceptionFilter } from './common/safe-exception.filter.js';
import { compressionMiddleware } from './common/compression.middleware.js';
import { json } from 'express';
import { queryValidationMiddleware } from './common/query-validation.middleware.js';
import { setupOpenApi } from './openapi.js';
import { PrivacyService } from './privacy/privacy.service.js';

export async function createApplication() {
  initializeSentry();
  // bufferLogs holds Nest's bootstrap output until the pino logger is installed,
  // so the first lines of the process are structured JSON like everything else.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  app.use(securityMiddleware(process.env, logger, event => app.get(PrivacyService).audit(event)));
  app.use(compressionMiddleware);
  app.use(queryValidationMiddleware);
  app.useGlobalFilters(new SafeExceptionFilter(logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const configService = app.get(ConfigService);
  // Built during dependency resolution, so an invalid value has already thrown
  // by this point and the limits below always match what the validators enforce.
  const foodScan = app.get(FoodScanConfigService).value;

  // Global prefix for all routes. Set before the body parser below because the
  // error handler matches on the fully prefixed request path.
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: [VERSION_NEUTRAL, '1'] });

  // A base64 photo is ~4/3 the size of the image, so Express's 100 KB default
  // would reject every scan request with 413 before any handler runs.
  app.use(['/api/pose/analyze', '/api/v1/pose/analyze'], json({ limit: '28mb' }));
  app.use(['/api/nutrition/scan', '/api/v1/nutrition/scan'], json({ limit: foodScan.maxBodyBytes }));
  app.useBodyParser('json', { limit: '128kb' });

  // Registered after the parser so oversized or unparseable bodies reach it,
  // and scoped to the scanner routes so every other endpoint keeps the error
  // shape the web client already parses.
  app.use(
    scannerBodyErrorHandler(
      logger,
      SCANNER_ROUTE_PATHS.flatMap((p) => [`/api${p}`, `/api/v1${p}`])
    )
  );

  // Only trust X-Forwarded-For as far as the real proxy chain reaches, so a
  // direct client cannot spoof its IP past the per-user rate limit.
  app.set('trust proxy', Number(configService.get<string>('TRUST_PROXY') ?? foodScan.trustProxyHops));

  const configuredOrigins = (configService.get<string>('CORS_ALLOWED_ORIGINS') || configService.get<string>('FRONTEND_URL') || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Expo Go loads the Next app from the development computer's private LAN IP.
  // Allow only that dev origin on port 3000; production remains explicit.
  app.enableCors({
    origin: ((origin, callback) => {
      if (isAllowedFrontendOrigin(origin, configuredOrigins, configService.get<string>('NODE_ENV'))) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    }) satisfies CustomOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-App-Version'],
    exposedHeaders: ['X-Request-ID', 'Retry-After'],
  });

  const server = app.getHttpServer();
  server.requestTimeout = 65_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.setTimeout(70_000);

  setupOpenApi(app);
  return app;
}
