import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateSettingsDto } from './dto/settings.dto.js';
import { SettingsService } from './settings.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}
  @Get() get(@Req() req: AuthenticatedRequest) { return this.service.get(req.user.userId); }
  @Put() update(@Req() req: AuthenticatedRequest, @Body() dto: UpdateSettingsDto) { return this.service.update(req.user.userId, dto); }
}
