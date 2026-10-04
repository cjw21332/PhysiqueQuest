import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateAlertDto } from './dto/create-alert.dto.js';
import { SafetyService } from './safety.service.js';
type AuthenticatedRequest = Request & { user: { userId: string } };
@Controller('safety/alerts')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private readonly service: SafetyService) {}
  @Post() send(@Req() req: AuthenticatedRequest, @Body() dto: CreateAlertDto) { return this.service.send(req.user.userId, dto); }
}
