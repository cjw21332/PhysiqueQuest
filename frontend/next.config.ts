import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
// Keep a running dev server's output isolated from `next build` artifacts.
const nextConfig = (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  devIndicators: {
    position: 'bottom-right',
  },
});
export default nextConfig;
