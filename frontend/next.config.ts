import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { withSentryConfig } from '@sentry/nextjs/config';
import { securityHeaders } from './lib/securityHeaders.mjs';
// Keep a running dev server's output isolated from `next build` artifacts.
const nextConfig = (phase: string): NextConfig => ({
  allowedDevOrigins: ['localhost', '*.*.*.*', ...(process.env.DEV_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)],
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  devIndicators: false,
  async headers() { return [{ source: '/((?!api/).*)', headers: securityHeaders(phase === PHASE_DEVELOPMENT_SERVER) }]; },
  async rewrites() {
    const backend = (process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }, ...['health', 'ready'].map(path => ({ source: `/${path}`, destination: `${backend}/${path}` }))];
  },
});
export default process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true'
  ? withSentryConfig(nextConfig, { authToken: process.env.SENTRY_AUTH_TOKEN, org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, silent: true })
  : nextConfig;
