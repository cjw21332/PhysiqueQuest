import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LeaderboardService, type LeaderboardPeriod } from './leaderboard.service.js';
import { StrengthService } from './strength.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService, private readonly strength: StrengthService) {}

  @Get('strength')
  getStrength(@Req() req: AuthenticatedRequest, @Query('exerciseId') exerciseId?: string, @Query('metric') metric?: string) {
    return this.strength.get(req.user.userId, exerciseId, metric);
  }

  @Get()
  get(@Req() req: AuthenticatedRequest, @Query('period') period: LeaderboardPeriod = 'week') {
    return this.service.get(req.user.userId, period);
  }
}
