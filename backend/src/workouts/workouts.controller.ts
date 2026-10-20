import { Body, Controller, Get, Header, Patch, Post, Query, Param, Req, Res, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApplyRecordingDto, CompleteWorkoutDto, CreateWorkoutDto, PauseWorkoutDto, RecordedWorkoutDto, SaveSetDto } from './dto/workout.dto.js';
import { WorkoutsService } from './workouts.service.js';

type AuthenticatedRequest = Request & { user: { userId: string } };
@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly service: WorkoutsService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreateWorkoutDto) { return this.service.create(req.user.userId, dto); }
  @Get() list(@Req() req: AuthenticatedRequest, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number, @Query('before') before?: string, @Query('date') date?: string, @Query('timezone') timezone?: string) { return date !== undefined ? this.service.forDay(req.user.userId, date, timezone) : this.service.list(req.user.userId, limit, before); }
  @Get('active') async active(@Req() req: AuthenticatedRequest, @Res() response: Response) {
    // Explicit JSON keeps the no-session case as the literal `null`, rather
    // than an empty HTTP body produced by the default response adapter.
    return response.set('Cache-Control', 'no-store').json(await this.service.active(req.user.userId));
  }
  @Get('summary') summary(@Req() req: AuthenticatedRequest, @Query('timezone') timezone?: string) { return this.service.summary(req.user.userId, timezone); }
  @Get(':id') @Header('Cache-Control', 'no-store') detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.detail(req.user.userId, id); }
  @Post('recorded') record(@Req() req: AuthenticatedRequest, @Body() dto: RecordedWorkoutDto) { return this.service.record(req.user.userId, dto); }
  @Post('recorded/:id/apply') applyRecording(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ApplyRecordingDto) { return this.service.applyRecording(req.user.userId, id, dto); }
  @Patch(':id/sets') saveSet(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SaveSetDto) { return this.service.saveSet(req.user.userId, id, dto); }
  @Patch(':id/pause') pause(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: PauseWorkoutDto) { return this.service.setPaused(req.user.userId, id, dto); }
  @Post(':id/complete') complete(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CompleteWorkoutDto) { return this.service.complete(req.user.userId, id, dto); }
}
