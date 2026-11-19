import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DatasetService } from './dataset.service.js';
import { AcceptDatasetConsentDto, SubmitDatasetClipDto } from './dto/dataset.dto.js';
import type { ClipStatus } from './schemas/dataset-clip.schema.js';

const STATUSES: ClipStatus[] = ['pending_annotation', 'accepted', 'rejected'];
export function parseStatus(value?: string): ClipStatus | undefined {
  return STATUSES.find(status => status === value);
}

type AuthedRequest = { user: { userId: string } };

/**
 * Contribution is opt-in per account and per recording. Nothing here is called
 * by ordinary PoseTracker sessions; the client must show the consent text and
 * the user must accept it before a clip can be submitted.
 */
@Controller('dataset')
@UseGuards(JwtAuthGuard)
export class DatasetController {
  constructor(private readonly dataset: DatasetService) {}

  @Get('consent')
  async consentState(@Req() req: AuthedRequest) {
    return { ...this.dataset.consentDocument(), state: await this.dataset.state(req.user.userId) };
  }

  @Post('consent')
  accept(@Req() req: AuthedRequest, @Body() body: AcceptDatasetConsentDto) {
    return this.dataset.acceptConsent(req.user.userId, body);
  }

  @Delete('consent')
  withdraw(@Req() req: AuthedRequest) {
    return this.dataset.withdrawConsent(req.user.userId);
  }

  @Post('clips')
  submit(@Req() req: AuthedRequest, @Body() body: SubmitDatasetClipDto) {
    return this.dataset.submit(req.user.userId, body);
  }

  @Get('clips')
  list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    return this.dataset.list(req.user.userId, parseStatus(status));
  }

  @Get('clips/:id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.dataset.get(req.user.userId, id);
  }

  @Delete('clips/:id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.dataset.removeClip(req.user.userId, id);
  }
}
