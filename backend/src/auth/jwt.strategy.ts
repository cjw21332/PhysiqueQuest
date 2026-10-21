import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { Types } from 'mongoose';
import { assertLegacyAuthEnabled } from './legacy-auth.js';
import { emailStatus } from './email-verification.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private sessions: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: any) {
    if (typeof payload.sub !== 'string' || !Types.ObjectId.isValid(payload.sub)) throw new UnauthorizedException();
    if (payload.tokenVersion === 2) {
      if (typeof payload.sid !== 'string' || !Number.isInteger(payload.sessionVersion)) throw new UnauthorizedException();
    }
    const [user] = await Promise.all([
      this.authService.validateUser(payload.sub),
      payload.tokenVersion === 2 ? this.sessions.validate(payload.sid, payload.sub, payload.sessionVersion) : Promise.resolve(),
    ]);
    if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) throw new UnauthorizedException('Session expired. Sign in again.');
    if (payload.tokenVersion !== 2) {
      assertLegacyAuthEnabled();
      this.logger.log({ event: 'legacy_token_used' });
    }
    return { userId: payload.sub, email: user.email, ...emailStatus(user), role: user.role ?? 'user', sessionId: payload.tokenVersion === 2 ? payload.sid : undefined, tokenVersion: payload.tokenVersion === 2 ? 2 : 1 };
  }
}
