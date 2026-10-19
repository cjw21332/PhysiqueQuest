import { defineConfig } from '@playwright/test';
import onboarding from './playwright.coach-dark.config.mjs';

export default defineConfig({ ...onboarding, testMatch: ['onboarding-dark.spec.mjs', 'journey-dark.spec.mjs', 'coach-dark.spec.mjs', 'admin-dark.spec.mjs', 'theme-overlays.spec.mjs'] });
