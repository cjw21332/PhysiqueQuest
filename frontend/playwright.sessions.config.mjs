import { defineConfig } from '@playwright/test';
import base from './playwright.onboarding.config.mjs';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'rotating-auth.spec.mjs', workers: 1,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4310', browserName: 'chromium' },
  webServer: [
    { command: 'node scripts/browser-fixture.mjs', cwd: '../backend', url: 'http://127.0.0.1:4311/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'npm run dev -- --port 4310', url: 'http://127.0.0.1:4310/launch', env: { BACKEND_URL: 'http://127.0.0.1:4311', NEXT_PUBLIC_API_URL: '', NEXT_PUBLIC_COACH_API_URL: '' }, reuseExistingServer: false, timeout: 60_000 },
  ],
});
