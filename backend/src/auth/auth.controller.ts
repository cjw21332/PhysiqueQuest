import { Controller, Post, Body, HttpCode, HttpStatus, Get, Req, UseGuards, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { PasswordChangeRequestDto, PasswordResetConfirmDto, PasswordResetRequestDto, PasswordResetVerifyDto } from './dto/password-recovery.dto.js';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly recovery: PasswordRecoveryService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: Request) { return this.recovery.request(dto.email, req.ip); }

  @Get('password-reset/status')
  passwordResetStatus() {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException();
    return this.recovery.diagnostics();
  }

  @Post('password-reset/verify')
  verifyPasswordResetCode(@Body() dto: PasswordResetVerifyDto, @Req() req: Request) { return this.recovery.verify(dto.requestId, dto.code, req.ip); }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto, @Req() req: Request) { return this.recovery.confirm(dto.resetToken, dto.password, req.ip); }

  @Post('password-change/request')
  @UseGuards(JwtAuthGuard)
  requestPasswordChange(@Body() _dto: PasswordChangeRequestDto, @Req() req: Request & { user: { userId: string } }) {
    return this.recovery.requestChange(req.user.userId, req.ip);
  }

  @Post('password-change/verify')
  @UseGuards(JwtAuthGuard)
  verifyPasswordChange(@Body() dto: PasswordResetVerifyDto, @Req() req: Request & { user: { userId: string } }) {
    return this.recovery.verifyChange(req.user.userId, dto.requestId, dto.code, req.ip);
  }

  @Post('password-change/confirm')
  @UseGuards(JwtAuthGuard)
  confirmPasswordChange(@Body() dto: PasswordResetConfirmDto, @Req() req: Request & { user: { userId: string } }) {
    return this.recovery.confirmChange(req.user.userId, dto.resetToken, dto.password, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: { userId: string; email: string; role: string } }) {
    return { id: req.user.userId, email: req.user.email, role: req.user.role };
  }
}
