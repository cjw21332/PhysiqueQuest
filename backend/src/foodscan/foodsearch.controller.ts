import { Controller, Get, Param, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AppExceptionFilter } from '../common/foodscan/app-exception.filter.js';
import { DeadlineInterceptor } from '../common/foodscan/deadline.interceptor.js';
import { RequestContextInterceptor } from '../common/foodscan/request-context.interceptor.js';
import { ScanRateLimitGuard } from '../common/foodscan/scan-rate-limit.guard.js';
import type { ScanRequest } from '../common/foodscan/scan-request.js';
import { FoodScanSchemasService, fdcIdParamSchema } from './foodscan.schemas.js';
import { FoodScanService } from './foodscan.service.js';
import type { FoodDetailResponse, FoodSearchResponse } from './foodscan.schemas.js';

/**
 * USDA food search and nutrient lookup.
 *
 * Gives GET /api/nutrition/foods/search and GET /api/nutrition/foods/:fdcId.
 * `search` is declared before `:fdcId` so it is not captured as an identifier.
 */
@Controller('nutrition/foods')
@UseGuards(JwtAuthGuard)
@UseFilters(AppExceptionFilter)
@UseInterceptors(RequestContextInterceptor, DeadlineInterceptor)
@UseGuards(ScanRateLimitGuard)
export class FoodSearchController {
  constructor(
    private readonly service: FoodScanService,
    private readonly schemas: FoodScanSchemasService,
  ) {}

  @Get('search')
  search(@Req() req: ScanRequest, @Query() query: unknown): Promise<FoodSearchResponse> {
    const { q } = this.schemas.parseFoodSearchQuery(query);
    return this.service.searchFoods(q, req.requestId ?? 'unknown');
  }

  @Get(':fdcId')
  getFood(@Req() req: ScanRequest, @Param() params: unknown): Promise<FoodDetailResponse> {
    const { fdcId } = fdcIdParamSchema.parse(params);
    return this.service.getFood(fdcId, req.requestId ?? 'unknown');
  }
}