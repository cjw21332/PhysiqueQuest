import { defineConfig } from '@playwright/test';
import base from './playwright.onboarding.config.mjs';

export default defineConfig({ ...base, testMatch: ['input-focus.spec.mjs', 'verification-alert.spec.mjs'] });
