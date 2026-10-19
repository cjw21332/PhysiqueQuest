import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import onboarding from './playwright.onboarding.config.mjs';

export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 60_000,
  use: { baseURL: 'http://localhost:3221', launchOptions: {
    ...onboarding.use.launchOptions,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  } },
  webServer: process.env.PQ_TRACKING_EXTERNAL_SERVER ? undefined : { command: 'npm run start -- --port 3221', cwd: fileURLToPath(new URL('.', import.meta.url)), url: 'http://localhost:3221', reuseExistingServer: false, timeout: 30_000 },
});
