import { Controller, Post, Body, HttpCode, HttpStatus, Get, Delete, Param, Req, Res, UseGuards, NotFoundException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { PasswordChangeRequestDto, PasswordResetConfirmDto, PasswordResetRequestDto, PasswordResetVerifyDto } from './dto/password-recovery.dto.js';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto, AdminLoginDto, AuthResponseDto, RefreshDto } from './dto/auth.dto.js';
import { SessionService } from './session.service.js';
import { assertDeviceRequest, assertSessionRequest, DEVICE_TOKEN, readRefreshCookie, SESSION_COOKIE, sessionCookieOptions } from './session-cookie.js';
import { assertLegacyAuthEnabled } from './legacy-auth.js';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { SessionResponseDto } from './dto/auth.dto.js';
import { EmailVerificationService } from './email-verification.service.js';
import { ConfirmVerificationDto, ResendVerificationDto } from './dto/email-verification.dto.js';
import { GoogleAuthService } from './google-auth.service.js';
import { GoogleCheckDto, GoogleLoginDto, GoogleRegisterDto } from './dto/google-auth.dto.js';
import { validateProfileMeasurements } from '../profile/profile.service.js';

export function localAdminLoginAllowed(origin: string | undefined, peer: string | undefined, environment: string | undefined) {
  let localOrigin = false;
  try { const parsed = new URL(origin ?? ''); localOrigin = ['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname); } catch { /* Reject missing or invalid origins. */ }
  return environment === 'development' && localOrigin && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer ?? '');
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly authService: AuthService,
    private readonly recovery: PasswordRecoveryService,
    private readonly sessions: SessionService,
    private readonly verification: EmailVerificationService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Post('session/login')
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ summary: 'Sign in and set the httpOnly rotating refresh cookie' })
  @HttpCode(HttpStatus.OK)
  async sessionLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    if (dto.email === 'admin@localhost.invalid') {
      if (!localAdminLoginAllowed(req.get('origin'), req.socket.remoteAddress, process.env.NODE_ENV)) throw new ForbiddenException('Local development account is only available on this computer.');
    }
    const result = await this.authService.login(dto);
    req.user = { userId: result.user.id };
    return this.deliver(await this.sessions.issue(await this.authService.validateUser(result.user.id)), res);
  }

  @Post('session/admin-login')
  @HttpCode(HttpStatus.OK)
  async sessionAdminLogin(@Body() dto: AdminLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    if (dto.username !== 'admin') throw new UnauthorizedException('Invalid username or password');
    const configured = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase();
    const local = !configured && localAdminLoginAllowed(req.get('origin'), req.socket.remoteAddress, process.env.NODE_ENV);
    const email = configured || (local ? 'admin@localhost.invalid' : '');
    if (!email || (email === 'admin@localhost.invalid' && !localAdminLoginAllowed(req.get('origin'), req.socket.remoteAddress, process.env.NODE_ENV))) throw new UnauthorizedException('Invalid username or password');
    const result = await this.authService.login({ email, password: dto.password });
    const user = await this.authService.validateUser(result.user.id);
    if (user.role !== 'admin' || user.emailVerified !== true) throw new UnauthorizedException('Invalid username or password');
    req.user = { userId: result.user.id };
    return this.deliver(await this.sessions.issue(user), res);
  }

  @Post('session/register')
  @ApiCreatedResponse({ type: SessionResponseDto })
  async sessionRegister(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    validateProfileMeasurements(dto.profile);
    await this.verification.consumeRegistration(dto.email, dto.requestId, dto.code);
    const result = await this.authService.register(dto);
    req.user = { userId: result.user.id };
    return this.deliver(await this.sessions.issue(await this.authService.validateUser(result.user.id)), res);
  }

  @Post('google/check')
  @HttpCode(HttpStatus.OK)
  googleCheck(@Body() dto: GoogleCheckDto) {
    return this.googleAuth.check(dto.idToken, dto.intent);
  }

  @Post('session/google/login')
  @ApiOkResponse({ type: SessionResponseDto })
  @HttpCode(HttpStatus.OK)
  async sessionGoogleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    const user = await this.googleAuth.login(dto);
    req.user = { userId: String(user._id) };
    return this.deliver(await this.sessions.issue(user), res);
  }

  @Post('session/google/register')
  @ApiCreatedResponse({ type: SessionResponseDto })
  async sessionGoogleRegister(@Body() dto: GoogleRegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    const user = await this.googleAuth.register(dto);
    req.user = { userId: String(user._id) };
    return this.deliver(await this.sessions.issue(user), res);
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

  @Post('session/device')
  @ApiOperation({ summary: 'Link the native app to the signed-in account', description: 'Native app shell only (X-PQ-Device: 1, no Origin). Issues a separate device session and returns its refresh token for the device secure store.' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deviceSession(@Req() req: Request & { user: { userId: string; tokenVersion: number } }, @Res({ passthrough: true }) res: Response) {
    assertDeviceRequest(req);
    if (req.user.tokenVersion !== 2) throw new ForbiddenException('Sign in again to link this device.');
    const { refresh_token, user } = await this.sessions.issue(await this.authService.validateUser(req.user.userId));
    res.setHeader('Cache-Control', 'no-store');
    return { device_token: refresh_token, user_id: user.id };
  }

  @Post('session/device/refresh')
  @ApiOperation({ summary: 'Rotate a device refresh token', description: 'Native app shell only. Body: { token }. Returns a new access token and the rotated device token; reuse of a consumed token revokes the session.' })
  @HttpCode(HttpStatus.OK)
  async deviceRefresh(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertDeviceRequest(req);
    const token = (body as { token?: unknown } | null)?.token;
    if (typeof token !== 'string' || !DEVICE_TOKEN.test(token)) throw new UnauthorizedException('Session expired. Sign in again.');
    const { refresh_token, ...result } = await this.sessions.refresh(token);
    res.setHeader('Cache-Control', 'no-store');
    return { ...result, device_token: refresh_token };
  }

  @Post('session/device/logout')
  @ApiOperation({ summary: 'Revoke a device session', description: 'Native app shell only. Body: { token }. Always succeeds so a device can forget its credential offline.' })
  @HttpCode(HttpStatus.OK)
  async deviceLogout(@Body() body: unknown, @Req() req: Request) {
    assertDeviceRequest(req);
    const token = (body as { token?: unknown } | null)?.token;
    if (typeof token === 'string' && DEVICE_TOKEN.test(token)) await this.sessions.revokeToken(token);
    return { loggedOut: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request & { user: { userId: string; sessionId?: string } }, @Res({ passthrough: true }) res: Response) {
    assertSessionRequest(req);
    if (req.user.sessionId) await this.sessions.revoke(req.user.sessionId, req.user.userId);
    else await this.authService.revokeAll(req.user.userId);
    // In the app the access token belongs to the device session, so also end the cookie's own session.
    const cookie = readRefreshCookie(req);
    if (DEVICE_TOKEN.test(cookie)) await this.sessions.revokeToken(cookie);
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
    validateProfileMeasurements(registerDto.profile);
    await this.verification.consumeRegistration(registerDto.email, registerDto.requestId, registerDto.code);
    const result = await this.authService.register(registerDto);
    if (req) req.user = { userId: result.user.id };
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req?: Request): Promise<AuthResponseDto> {
    assertLegacyAuthEnabled();
    if (loginDto.email === 'admin@localhost.invalid') throw new ForbiddenException('Use the local administrator sign-in.');
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
  me(@Req() req: Request & { user: { userId: string; email: string; role: string; emailVerified: boolean; legacyEmailAccess: boolean; mustChangePassword: boolean } }) {
    return { id: req.user.userId, email: req.user.email, role: req.user.role, emailVerified: req.user.emailVerified, legacyEmailAccess: req.user.legacyEmailAccess, mustChangePassword: req.user.mustChangePassword };
  }

  @Post('admin-initial-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changeInitialAdminPassword(@Req() req: Request & { user: { userId: string } }, @Body() body: { currentPassword?: unknown; newPassword?: unknown }) {
    return this.authService.changeInitialAdminPassword(req.user.userId, body?.currentPassword, body?.newPassword);
  }
}
