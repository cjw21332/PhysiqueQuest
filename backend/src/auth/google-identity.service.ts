import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export type GoogleIdentity = { uid: string; email: string; name: string };

const DEFAULT_GOOGLE_WEB_CLIENT_ID = '390685281626-3g9bucvvl5t3sfjg3e6tj0gvaupsdcl5.apps.googleusercontent.com';
const TRANSIENT_GOOGLE_ERRORS = new Set(['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT']);

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID);

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (typeof idToken !== 'string' || !idToken.length || idToken.length > 10000) {
      throw new UnauthorizedException('Choose your Google account again.');
    }
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (typeof code === 'string' && TRANSIENT_GOOGLE_ERRORS.has(code)) {
        throw new ServiceUnavailableException('Google sign-in is temporarily unavailable. Please try again.');
      }
      throw new UnauthorizedException('Google sign-in expired or could not be verified. Choose your Google account again.');
    }

    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true ||
      (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com')) {
      throw new UnauthorizedException('Google sign-in expired or could not be verified. Choose your Google account again.');
    }

    return {
      uid: payload.sub,
      email: payload.email.trim().toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name.slice(0, 100) : '',
    };
  }
}
