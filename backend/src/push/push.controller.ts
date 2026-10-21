import { Body, Controller, Delete, Param, Put, Req, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PushService } from './push.service.js';

export class RegisterPushDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{16,128}$/) deviceId: string;
  @IsString() @MaxLength(240) token: string;
}
@Controller('push/devices')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly service: PushService) {}
  @Put() register(@Req() req: { user: { userId: string } }, @Body() dto: RegisterPushDto) {
    return this.service.register(req.user.userId, dto.deviceId, dto.token);
  }
  @Delete(':deviceId') revoke(@Req() req: { user: { userId: string } }, @Param('deviceId') deviceId: string) {
    return this.service.revoke(req.user.userId, deviceId);
  }
}
