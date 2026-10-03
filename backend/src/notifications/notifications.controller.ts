import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationReadDto } from './dto/notification.dto.js';
import { NotificationsService } from './notifications.service.js';
type AuthenticatedRequest = Request & { user: { userId: string } };
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() get(@Req() req: AuthenticatedRequest) { return this.service.get(req.user.userId); }
  @Patch(':id/read') mark(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: NotificationReadDto) { return this.service.mark(req.user.userId, id, dto.unread); }
  @Post('read-all') markAll(@Req() req: AuthenticatedRequest) { return this.service.markAll(req.user.userId); }
}
