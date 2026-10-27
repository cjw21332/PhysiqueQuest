import { Controller, Post, Body, HttpCode, HttpStatus, Get, Delete, Param, Req, Res, UseGuards, NotFoundException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { PasswordChangeRequestDto, PasswordResetConfirmDto, PasswordResetRequestDto, PasswordResetVerifyDto } from './dto/password-recovery.dto.js';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto, AuthResponseDto, RefreshDto } from './dto/auth.dto.js';
import { SessionService } from './session.service.js';
import { assertSessionRequest, readRefreshCookie, SESSION_COOKIE, sessionCookieOptions } from './session-cookie.js';
import { assertLegacyAuthEnabled } from './legacy-auth.js';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { SessionResponseDto } from './dto/auth.dto.js';
import { EmailVerificationService } from './email-verification.service.js';
import { ConfirmVerificationDto, ResendVerificationDto } from './dto/email-verification.dto.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private readonly authService: AuthService, private readonly recovery: PasswordRecoveryService, private readonly sessions: SessionService, private readonly verification: EmailVerificationService) {}

  @Post('session/login')
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ summary: 'Sign in and set the httpOnly rotating refresh cookie' })
  @HttpCode(HttpStatus.OK)
  async sessionLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    const result = await this.authService.login(dto);
    req.user = { userId: result.user.id };
    return this.deliver(await this.sessions.issue(await this.authService.validateUser(result.user.id)), res);
  }

  @Post('session/register')
  @ApiCreatedResponse({ type: SessionResponseDto })
  async sessionRegister(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    await this.verification.consumeRegistration(dto.email, dto.requestId, dto.code);
    const result = await this.authService.register(dto);
    req.user = { userId: result.user.id };
    return this.deliver(await this.sessions.issue(await this.authService.validateUser(result.user.id)), res);
  }

  private deliver(result: Awaited<ReturnType<SessionService['issue']>>, res: Response) {
    const { refresh_token, ...body } = result;
    res.cookie(SESSION_COOKIE, refresh_token, { ...sessionCookieOptions(), maxAge: 30 * 86400_000 });
    res.setHeader('Cache-Control', 'no-store');
    return body;
  }

  @Post('session/migrate')
  @ApiOkResponse({ type: SessionResponseDto })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async migrate(@Req() req: Request & { user: { userId: string; tokenVersion: number } }, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    if (req.user.tokenVersion !== 1) throw new ForbiddenException('Only legacy sessions can be migrated');
    return this.deliver(await this.sessions.issue(await this.authService.validateUser(req.user.userId)), res);
  }

  @Post('session/refresh')
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ summary: 'Rotate the refresh cookie and return a new access token', description: 'Send an empty JSON object with credentials included. Reusing a consumed refresh token revokes its session family. Refresh tokens are never returned in JSON.' })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() _dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    try {
      const result = await this.sessions.refresh(readRefreshCookie(req));
      req.user = { userId: result.user.id };
      return this.deliver(result, res);
    }
    catch (error) {
      if (error instanceof UnauthorizedException) res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request & { user: { userId: string; sessionId?: string } }, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    if (req.user.sessionId) await this.sessions.revoke(req.user.sessionId, req.user.userId);
    else await this.authService.revokeAll(req.user.userId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return { loggedOut: true };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: Request & { user: { userId: string } }, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    await this.authService.revokeAll(req.user.userId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return { loggedOut: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async activeSessions(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.authService.validateUser(req.user.userId);
    return this.sessions.list(req.user.userId, user.sessionVersion ?? 0);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@Param('id') id: string, @Req() req: Request & { user: { userId: string } }) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new NotFoundException();
    await this.sessions.revoke(id, req.user.userId);
    return { revoked: true };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req?: Request): Promise<AuthResponseDto> {
    assertLegacyAuthEnabled();
    await this.verification.consumeRegistration(registerDto.email, registerDto.requestId, registerDto.code);
    const result = await this.authService.register(registerDto);
    if (req) req.user = { userId: result.user.id };
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req?: Request): Promise<AuthResponseDto> {
    assertLegacyAuthEnabled();
    const result = await this.authService.login(loginDto);
    if (req) req.user = { userId: result.user.id };
    return result;
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: Request) { return this.recovery.request(dto.email, req.ip); }

  @Post('verification/request')
  requestVerification(@Body() dto: ResendVerificationDto) { return this.verification.request(dto.email); }

  @Post('registration-code/request')
  requestRegistrationCode(@Body() dto: ResendVerificationDto) { return this.verification.requestRegistration(dto.email); }

  @Post('verification-code/request')
  @UseGuards(JwtAuthGuard)
  requestAccountCode(@Req() req: Request & { user: { email: string } }) { return this.verification.requestRegistration(req.user.email); }

  @Post('verification-code/confirm')
  @UseGuards(JwtAuthGuard)
  confirmAccountCode(@Body() dto: PasswordResetVerifyDto, @Req() req: Request & { user: { userId: string; email: string } }) { return this.verification.confirmAccount(req.user.userId, req.user.email, dto.requestId, dto.code); }

  @Post('verification/confirm')
  confirmVerification(@Body() dto: ConfirmVerificationDto) { return this.verification.confirm(dto.token); }

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
  me(@Req() req: Request & { user: { userId: string; email: string; role: string; emailVerified: boolean; legacyEmailAccess: boolean } }) {
    return { id: req.user.userId, email: req.user.email, role: req.user.role, emailVerified: req.user.emailVerified, legacyEmailAccess: req.user.legacyEmailAccess };
  }
}
