import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateProgressDto } from './dto/progress.dto.js';
import { ProgressService } from './progress.service.js';
type AuthenticatedRequest = Request & { user: { userId: string } };
@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly service: ProgressService) {}
  @Post() add(@Req() req: AuthenticatedRequest, @Body() dto: CreateProgressDto) { return this.service.add(req.user.userId, dto); }
  @Get() list(@Req() req: AuthenticatedRequest, @Query('metric') metric = '', @Query('limit', new DefaultValuePipe(90), ParseIntPipe) limit: number) { return this.service.list(req.user.userId, metric, limit); }
  @Delete(':id') remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.remove(req.user.userId, id); }
}
