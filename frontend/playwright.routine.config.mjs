import { defineConfig } from '@playwright/test';
import onboarding from './playwright.onboarding.config.mjs';
export default defineConfig({ ...onboarding, testMatch: 'workout-routine.spec.mjs' });
