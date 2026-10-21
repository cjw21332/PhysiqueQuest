import { ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
import type { CookieOptions, Request } from 'express';
import { isAllowedFrontendOrigin } from '../common/cors-policy.js';

export const SESSION_COOKIE = 'pq_refresh';
export function sessionCookieOptions(env = process.env): CookieOptions {
  return { httpOnly: true, secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production', sameSite: (env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
    path: '/api', ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}) };
}
export function assertSessionRequest(req: Request, env = process.env) {
  if (!req.is('application/json')) throw new UnsupportedMediaTypeException('Use application/json');
  const origins = (env.CORS_ALLOWED_ORIGINS || env.FRONTEND_URL || 'http://localhost:3000').split(',').map(value => value.trim());
  if (!isAllowedFrontendOrigin(req.get('origin'), origins, env.NODE_ENV)) throw new ForbiddenException('Origin is not allowed');
}
export function readRefreshCookie(req: Request): string {
  return (req.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) ?? '';
}
