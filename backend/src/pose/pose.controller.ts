import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PoseAnalysisDto } from './dto/pose-analysis.dto.js';
import { PoseService } from './pose.service.js';
@Controller('pose')
export class PoseController {
  constructor(private readonly service: PoseService) {}
  @Get('status') status() { return this.service.status(); }
  @Post('analyze') @UseGuards(JwtAuthGuard) analyze(@Body() dto: PoseAnalysisDto) { return this.service.analyze(dto); }
}
