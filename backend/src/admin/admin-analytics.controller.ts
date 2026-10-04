import { Controller, Get, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}
  @Get('analytics') get(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) { return this.service.get(days); }
}
