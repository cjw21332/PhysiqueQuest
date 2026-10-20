import { defineConfig } from '@playwright/test';
import onboarding from './playwright.onboarding.config.mjs';
export default defineConfig({ ...onboarding, testMatch: 'mobile-accessibility.spec.mjs', use: { ...onboarding.use, hasTouch: true, isMobile: true } });
