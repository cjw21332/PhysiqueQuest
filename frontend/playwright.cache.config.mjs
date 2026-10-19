import { defineConfig } from '@playwright/test';
import base from './playwright.onboarding.config.mjs';

export default defineConfig({ ...base, testMatch: ['app-cache.spec.mjs', 'coach-plan.spec.mjs'] });
