import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LeaderboardService, type LeaderboardPeriod } from './leaderboard.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  @Get()
  get(@Req() req: AuthenticatedRequest, @Query('period') period: LeaderboardPeriod = 'week') {
    return this.service.get(req.user.userId, period);
  }
}
