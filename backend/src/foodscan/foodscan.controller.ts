import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AppExceptionFilter } from '../common/foodscan/app-exception.filter.js';
import { DeadlineInterceptor } from '../common/foodscan/deadline.interceptor.js';
import { RequestContextInterceptor } from '../common/foodscan/request-context.interceptor.js';
import { ScanContentTypeGuard } from '../common/foodscan/scan-content-type.guard.js';
import { ScanRateLimitGuard } from '../common/foodscan/scan-rate-limit.guard.js';
import type { ScanRequest } from '../common/foodscan/scan-request.js';
import { FoodScanService } from './foodscan.service.js';
import type { AnalyzeResponse } from './foodscan.schemas.js';

/**
 * Food image analysis.
 *
 * Bound to `nutrition/scan` so it sits with the rest of the nutrition surface
 * and inherits the global `/api` prefix, giving POST /api/nutrition/scan.
 *
 * Guards run outside-in: JWT first, then the shared envelope/observability
 * decorators, then the content-type and rate-limit checks, so an
 * unauthenticated caller is rejected before it can consume anyone's provider
 * quota and a malformed request never reaches the providers.
 */
@Controller('nutrition/scan')
@UseGuards(JwtAuthGuard)
@UseFilters(AppExceptionFilter)
@UseInterceptors(RequestContextInterceptor, DeadlineInterceptor)
@UseGuards(ScanContentTypeGuard, ScanRateLimitGuard)
export class FoodScanController {
  constructor(private readonly service: FoodScanService) {}

  /**
   * `unknown` is deliberate: the body is a multi-megabyte base64 image, and the
   * global ValidationPipe skips native/`Object` metatypes. Zod validates it in
   * the service, which keeps the strict request contract in one place.
   *
   * 200 rather than Nest's default 201: nothing is created here, and clients
   * already treat this as a plain successful read of the analysis.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  analyze(@Req() req: ScanRequest, @Body() body: unknown): Promise<AnalyzeResponse> {
    return this.service.analyze(body, req.requestId ?? 'unknown');
  }
}