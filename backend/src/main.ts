import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { PinoLogger } from './common/foodscan/pino-logger.js';
import { scannerBodyErrorHandler } from './common/foodscan/app-exception.filter.js';
import { FoodScanConfigService } from './common/foodscan/foodscan-config.js';
import { isAllowedFrontendOrigin } from './common/cors-policy.js';
import { SCANNER_ROUTE_PATHS } from './foodscan/foodscan.module.js';

async function bootstrap() {
  // bufferLogs holds Nest's bootstrap output until the pino logger is installed,
  // so the first lines of the process are structured JSON like everything else.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const configService = app.get(ConfigService);
  // Built during dependency resolution, so an invalid value has already thrown
  // by this point and the limits below always match what the validators enforce.
  const foodScan = app.get(FoodScanConfigService).value;

  // Global prefix for all routes. Set before the body parser below because the
  // error handler matches on the fully prefixed request path.
  app.setGlobalPrefix('api');

  // A base64 photo is ~4/3 the size of the image, so Express's 100 KB default
  // would reject every scan request with 413 before any handler runs.
  app.useBodyParser('json', { limit: foodScan.maxBodyBytes });

  // Registered after the parser so oversized or unparseable bodies reach it,
  // and scoped to the scanner routes so every other endpoint keeps the error
  // shape the web client already parses.
  app.use(
    scannerBodyErrorHandler(
      logger,
      SCANNER_ROUTE_PATHS.map((p) => `/api${p}`)
    )
  );

  // Only trust X-Forwarded-For as far as the real proxy chain reaches, so a
  // direct client cannot spoof its IP past the per-user rate limit.
  app.set('trust proxy', foodScan.trustProxyHops);

  const configuredOrigins = (configService.get<string>('FRONTEND_URL') || 'http://localhost:3000')
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
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = configService.get('PORT') || 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend server running on http://0.0.0.0:${port}/api`);
}
await bootstrap();
