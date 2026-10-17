import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
// Keep a running dev server's output isolated from `next build` artifacts.
const nextConfig = (phase: string): NextConfig => ({
  allowedDevOrigins: ['192.168.100.5', 'localhost:3000'],
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  devIndicators: {
    position: 'bottom-right',
  },
  async headers() {
    return [{
      source: '/pose/v1/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
});
export default nextConfig;
