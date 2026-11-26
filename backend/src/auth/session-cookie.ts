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
/**
 * Device sessions are for the native app shell, which keeps the refresh token in the device's
 * secure storage because WebViews drop cross-site cookies. Browsers always send Origin on POST,
 * so page scripts cannot use these endpoints to obtain a refresh token.
 */
export function assertDeviceRequest(req: Request) {
  if (!req.is('application/json')) throw new UnsupportedMediaTypeException('Use application/json');
  if (req.get('origin') || req.get('x-pq-device') !== '1') throw new ForbiddenException('Device sessions are only available in the PhysiqueQuest app.');
}
export const DEVICE_TOKEN = /^[a-f0-9]{64}\.[a-f0-9]{64}$/;
export function readRefreshCookie(req: Request): string {
  return (req.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) ?? '';
}
