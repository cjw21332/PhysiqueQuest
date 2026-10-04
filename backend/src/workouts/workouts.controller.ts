import { Body, Controller, Get, Patch, Post, Query, Param, Req, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CompleteWorkoutDto, CreateWorkoutDto, PauseWorkoutDto } from './dto/workout.dto.js';
import { WorkoutsService } from './workouts.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };
@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly service: WorkoutsService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreateWorkoutDto) { return this.service.create(req.user.userId, dto); }
  @Get() list(@Req() req: AuthenticatedRequest, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) { return this.service.list(req.user.userId, limit); }
  @Patch(':id/pause') pause(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: PauseWorkoutDto) { return this.service.setPaused(req.user.userId, id, dto); }
  @Post(':id/complete') complete(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CompleteWorkoutDto) { return this.service.complete(req.user.userId, id, dto); }
}
