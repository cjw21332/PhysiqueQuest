import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { DatasetService } from './dataset.service.js';
import { parseStatus } from './dataset.controller.js';
import { AnnotateDatasetClipDto } from './dto/dataset.dto.js';

type AuthedRequest = { user: { userId: string; role?: string } };

/** Reviewers see pseudonymous clips only; the queue projection drops userId. */
@Controller('dataset/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DatasetAdminController {
  constructor(private readonly dataset: DatasetService) {}

  @Get('queue')
  queue(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.dataset.queue(parseStatus(status) ?? 'pending_annotation', Number(limit) || 25);
  }

  @Patch('clips/:id/annotation')
  annotate(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: AnnotateDatasetClipDto) {
    return this.dataset.annotate(id, body, req.user.role ? `admin:${req.user.userId.slice(-6)}` : 'admin');
  }
}
