import { Controller, Post, Body, HttpCode, HttpStatus, Get, Req, UseGuards, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { PasswordResetConfirmDto, PasswordResetRequestDto, PasswordResetVerifyDto } from './dto/password-recovery.dto.js';
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
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) { return this.recovery.request(dto.email); }

  @Get('password-reset/status')
  passwordResetStatus() {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException();
    return this.recovery.diagnostics();
  }

  @Post('password-reset/verify')
  verifyPasswordResetCode(@Body() dto: PasswordResetVerifyDto) { return this.recovery.verify(dto.code); }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) { return this.recovery.confirm(dto.code, dto.password); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: { userId: string; email: string; role: string } }) {
    return { id: req.user.userId, email: req.user.email, role: req.user.role };
  }
}
