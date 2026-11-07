import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', testMatch: ['exercise-offline-pwa.spec.mjs', 'exercise-library.spec.mjs'], timeout: 120000, workers: 1, use: { baseURL: 'http://127.0.0.1:14310' } });
