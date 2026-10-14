import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CoachService } from './coach.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('coach')
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private readonly service: CoachService) {}

  @Get('status')
  status() { return { status: 'ready', source: 'ExerciseDB V1', media: 'GIF', attribution: 'ExerciseDB by AscendAPI — https://oss.exercisedb.dev' }; }

  @Get('plan')
  getPlan(@Req() req: AuthenticatedRequest) {
    return this.service.getPlan(req.user.userId);
  }
}
