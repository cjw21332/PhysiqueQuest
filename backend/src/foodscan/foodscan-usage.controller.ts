import { Controller, Get, Req, UseGuards, UseFilters } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { ScanRequest } from '../common/foodscan/scan-request.js';
import { FoodScanUsageService } from './foodscan-usage.service.js';
import { AppExceptionFilter } from '../common/foodscan/app-exception.filter.js';

@Controller('nutrition/scan-usage')
@UseGuards(JwtAuthGuard)
@UseFilters(AppExceptionFilter)
export class FoodScanUsageController {
  constructor(private readonly usage: FoodScanUsageService) {}
  @Get() summary(@Req() req: ScanRequest) { return this.usage.summary(req.user!.userId); }
}
