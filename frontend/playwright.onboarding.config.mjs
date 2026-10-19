import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const windowsBrowser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
].find(existsSync);

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'onboarding-dark.spec.mjs',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },
    colorScheme: 'light', // The app's default stays dark even on a light OS.
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'win32' ? windowsBrowser : undefined),
    },
  },
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
