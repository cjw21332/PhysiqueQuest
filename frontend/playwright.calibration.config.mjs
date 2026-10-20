import { defineConfig } from '@playwright/test';
import onboarding from './playwright.onboarding.config.mjs';
export default defineConfig({ ...onboarding, testMatch: 'calibration-resume.spec.mjs' });
