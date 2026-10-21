import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AnalysisJobsService } from './analysis-jobs.service.js';
import { AnalysisJobDto } from './dto/analysis-job.dto.js';
@Controller('jobs/nutrition') @UseGuards(JwtAuthGuard)
export class AnalysisJobsController {
  constructor(private readonly service: AnalysisJobsService) {}
  @Post() @HttpCode(202)
  create(@Req() req: { user: { userId: string } }, @Body() dto: AnalysisJobDto) { return this.service.enqueue(req.user.userId, dto.uploadId); }
  @Get(':id')
  status(@Req() req: { user: { userId: string } }, @Param('id') id: string) { return this.service.status(req.user.userId, id); }
}
