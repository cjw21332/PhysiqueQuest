import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FoodScanConfigService } from '../common/foodscan/foodscan-config.js';
import { HttpService } from '../common/foodscan/http.service.js';
import { PinoLogger } from '../common/foodscan/pino-logger.js';
import { AppExceptionFilter } from '../common/foodscan/app-exception.filter.js';
import { DeadlineInterceptor } from '../common/foodscan/deadline.interceptor.js';
import { RequestContextInterceptor } from '../common/foodscan/request-context.interceptor.js';
import { ScanContentTypeGuard } from '../common/foodscan/scan-content-type.guard.js';
import { ScanRateLimitGuard } from '../common/foodscan/scan-rate-limit.guard.js';
import { FoodScanController } from './foodscan.controller.js';
import { FoodScanSchemasService } from './foodscan.schemas.js';
import { FoodScanService } from './foodscan.service.js';
import { FoodSearchController } from './foodsearch.controller.js';
import { GeminiService } from './services/gemini.service.js';
import { UsdaService } from './services/usda.service.js';

/**
 * Route paths owned by the scanner, relative to the global prefix.
 *
 * main.ts turns these into the concrete paths the body-parser error handler
 * matches on, so the list of routes that may answer with the scanner error
 * envelope has exactly one source of truth.
 */
export const SCANNER_ROUTE_PATHS = [
  '/nutrition/scan',
  '/nutrition/foods/search',
  '/nutrition/foods',
] as const;

/**
 * Food scanning: Gemini vision for detection, USDA FoodData Central for
 * nutrition pricing.
 *
 * The config service is built during dependency resolution, so an invalid
 * `FOODSCAN_*` value or an unparseable integer aborts the boot rather than
 * surfacing as a failed scan later.
 *
 * PinoLogger is exported so main.ts can install it as the Nest logger before
 * the first request is served, and so it can build the body-parser error
 * handler via `scannerBodyErrorHandler`.
 */
@Module({
  imports: [ConfigModule],
  controllers: [FoodScanController, FoodSearchController],
  providers: [
    FoodScanConfigService,
    PinoLogger,
    HttpService,
    FoodScanSchemasService,
    GeminiService,
    UsdaService,
    FoodScanService,
    AppExceptionFilter,
    RequestContextInterceptor,
    DeadlineInterceptor,
    ScanContentTypeGuard,
    ScanRateLimitGuard,
  ],
  exports: [PinoLogger, FoodScanConfigService, FoodScanService],
})
export class FoodScanModule {}
