import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { LoggerService } from '@nestjs/common';
import { recordHttpRequest } from './http-metrics.js';

export function securityMiddleware(env: Record<string, string | undefined>, logger?: LoggerService, audit?: (event: { actorId?: string; action: string; requestId: string; status: number; ip?: string }) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    (req as Request & { requestId: string }).requestId = requestId;
    if (logger) res.once('finish', () => {
      const durationMs = performance.now() - started;
      const route = `${req.method} ${typeof req.route?.path === 'string' ? req.route.path : 'unmatched'}`;
      recordHttpRequest(route, res.statusCode, durationMs);
      logger.log({ event: req.method === 'GET' ? 'http_completed' : 'audit_action', request_id: requestId, route, status: res.statusCode, duration_ms: Number(durationMs.toFixed(2)) });
      if (audit && req.method !== 'GET' && req.method !== 'OPTIONS') void audit({ actorId: (req.user as { userId?: string } | undefined)?.userId, action: route, requestId, status: res.statusCode, ip: req.ip }).catch(() => logger.warn({ event: 'audit_persistence_failed', request_id: requestId }));
    });
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    const path = req.path.replace(/^\/api\/v1(?=\/|$)/i, '/api').replace(/\/+$/, '').toLowerCase();
    if (env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      if (!req.secure && !['/health', '/ready', '/api/health', '/api/ready'].includes(path)) {
        res.redirect(308, `${env.API_PUBLIC_URL}${req.originalUrl}`); return;
      }
    }
    const version = req.headers['x-app-version'];
    if (env.MIN_APP_VERSION && (version !== undefined || env.REQUIRE_APP_VERSION === 'true') && !['/api/config', '/health', '/ready', '/api/health', '/api/ready'].includes(path)) {
      const valid = typeof version === 'string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(version);
      const parts = valid ? version.split('.').map(Number) : [];
      const minimum = env.MIN_APP_VERSION.split('.').map(Number);
      const comparison = valid ? parts.reduce((result, part, i) => result || Math.sign(part - minimum[i]), 0) : -1;
      if (comparison < 0) { res.status(426).json({ statusCode: 426, code: 'APP_UPDATE_REQUIRED', message: 'Update the app to continue.', minimumVersion: env.MIN_APP_VERSION, request_id: requestId }); return; }
    }
    next();
  };
}
