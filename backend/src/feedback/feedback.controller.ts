import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateFeedbackDto } from './dto/feedback.dto.js';
import { FeedbackService } from './feedback.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFeedbackDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.service.list(req.user.userId, Number(limit));
  }
}
