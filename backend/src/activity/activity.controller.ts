import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateActivityDto } from './dto/activity.dto.js';
import { ActivityService } from './activity.service.js';
type AuthenticatedRequest = Request & { user: { userId: string } };
@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly service: ActivityService) {}
  @Get('state') get(@Req() req: AuthenticatedRequest) { return this.service.get(req.user.userId); }
  @Put('state') update(@Req() req: AuthenticatedRequest, @Body() dto: UpdateActivityDto) { return this.service.update(req.user.userId, dto); }
}
