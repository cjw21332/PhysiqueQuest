import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SyncService } from './sync.service.js';
type Request = { user: { userId: string } };
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly service: SyncService) {}
  @Get() page(@Req() req: Request, @Query() query: Record<string, unknown>) { return this.service.page(req.user.userId, query); }
  @Get('snapshots') snapshots(@Req() req: Request) { return this.service.snapshots(req.user.userId); }
  @Get('dashboard') dashboard(@Req() req: Request) { return this.service.dashboard(req.user.userId); }
}
