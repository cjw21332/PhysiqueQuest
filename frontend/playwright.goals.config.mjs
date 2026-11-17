import base from './playwright.onboarding.config.mjs';
export default { ...base, testMatch: ['goals-page.spec.mjs'], use: { ...base.use, baseURL: 'http://127.0.0.1:3111' }, webServer: { command: 'npm run dev -- --port 3111', url: 'http://127.0.0.1:3111', reuseExistingServer: false, timeout: 90_000, env: { NEXT_DEV_DIST_DIR: '.next-goals-test' } } };
