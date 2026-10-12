import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminAlertsService } from './admin-alerts.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAlertsController {
  constructor(private readonly service: AdminAlertsService) {}

  @Get('alerts')
  list(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('status') status?: string,
  ) {
    return this.service.list(days, status);
  }
}
