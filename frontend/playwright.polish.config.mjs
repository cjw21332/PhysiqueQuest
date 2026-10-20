import { defineConfig } from '@playwright/test';
import theme from './playwright.theme.config.mjs';
export default defineConfig({ ...theme, testMatch: [...theme.testMatch, 'frontend-polish.spec.mjs', 'workout-routine.spec.mjs', 'calibration-resume.spec.mjs', 'auth-nutrition-harden.spec.mjs', 'app-cache.spec.mjs'] });
