import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationReadDto } from './dto/notification.dto.js';
import { NotificationsService } from './notifications.service.js';
type AuthenticatedRequest = Request & { user: { userId: string } };
class ReminderDto { @IsBoolean() enabled: boolean; @IsInt() @Min(0) @Max(23) hour: number; @IsInt() @Min(0) @Max(59) minute: number; @IsString() @MaxLength(100) timezone: string; }
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() get(@Req() req: AuthenticatedRequest) { return this.service.get(req.user.userId); }
  @Put('reminder') reminder(@Req() req: AuthenticatedRequest, @Body() dto: ReminderDto) { return this.service.setReminder(req.user.userId, dto); }
  @Patch(':id/read') mark(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: NotificationReadDto) { return this.service.mark(req.user.userId, id, dto.unread); }
  @Post('read-all') markAll(@Req() req: AuthenticatedRequest) { return this.service.markAll(req.user.userId); }
}
