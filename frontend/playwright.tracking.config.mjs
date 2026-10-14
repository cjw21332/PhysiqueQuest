import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 60_000,
  use: { baseURL: 'http://localhost:3221', launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  } },
  webServer: process.env.PQ_TRACKING_EXTERNAL_SERVER ? undefined : { command: 'npm run start -- --port 3221', cwd: fileURLToPath(new URL('.', import.meta.url)), url: 'http://localhost:3221', reuseExistingServer: false, timeout: 30_000 },
});
