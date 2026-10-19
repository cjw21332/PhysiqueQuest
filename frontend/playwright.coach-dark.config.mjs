import { defineConfig } from '@playwright/test';
import onboarding from './playwright.onboarding.config.mjs';

export default defineConfig({
  ...onboarding,
  testMatch: ['coach-dark.spec.mjs', 'coach-plan.spec.mjs', 'exercise-library.spec.mjs', 'pose-tracking.spec.mjs'],
  use: {
    ...onboarding.use,
    launchOptions: { ...onboarding.use.launchOptions, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
});
