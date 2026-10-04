import { ConfigModule } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { scannerBodyErrorHandler } from '../src/common/foodscan/app-exception.filter.js';
import { FoodScanConfigService } from '../src/common/foodscan/foodscan-config.js';
import { PinoLogger } from '../src/common/foodscan/pino-logger.js';
import { FoodScanModule, SCANNER_ROUTE_PATHS } from '../src/foodscan/foodscan.module.js';

export const TEST_USER_ID = '64b7f1c2a1b2c3d4e5f60718';

/**
 * Boots the scanner module on its own.
 *
 * Deliberately does NOT import AppModule: that would pull in Mongoose and turn
 * every assertion here into an integration test needing a live database. These
 * tests are about the scanner's own wiring, so the module is assembled directly.
 *
 * `auth: false` keeps the real JwtAuthGuard so 401 behaviour can be asserted;
 * otherwise a stub guard injects a fixed user id and lets the pipeline run.
 */
export async function buildScannerApp(
  env: Record<string, string> = {},
  opts: { auth?: boolean } = {}
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }),
      FoodScanModule,
    ],
  });

  if (opts.auth === false) {
    builder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
        context.switchToHttp().getRequest().user = { userId: TEST_USER_ID };
        return true;
      },
    });
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });

  // Mirror main.ts: the default 100 KB JSON cap would reject every real scan,
  // and body-parser failures must reach the scanner envelope on these paths.
  const config = app.get(FoodScanConfigService);
  app.useBodyParser('json', { limit: config.value.maxBodyBytes });
  app.use(scannerBodyErrorHandler(app.get(PinoLogger), SCANNER_ROUTE_PATHS as unknown as string[]));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.init();
  return app;
}

/** Convenience wrapper so specs read as one line. */
export function server(app: INestApplication) {
  return request(app.getHttpServer());
}
