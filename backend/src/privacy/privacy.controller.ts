import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrivacyService } from './privacy.service.js';
import { DeleteAccountDto, RecoverAccountDto } from './dto/account.dto.js';

@Controller('account')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}
  @Get('export') @UseGuards(JwtAuthGuard)
  export(@Req() req: { user: { userId: string } }) { return this.privacy.exportData(req.user.userId); }
  @Post('delete') @UseGuards(JwtAuthGuard)
  delete(@Req() req: { user: { userId: string } }, @Body() body: DeleteAccountDto) { return this.privacy.requestDeletion(req.user.userId, body.password); }
  @Post('recover')
  recover(@Body() body: RecoverAccountDto) { return this.privacy.recover(body.email, body.password); }
}
