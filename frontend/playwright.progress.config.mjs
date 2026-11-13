import base from './playwright.onboarding.config.mjs';
export default { ...base, testMatch: ['progress-picker.spec.mjs', 'personal-records.spec.mjs'], use: { ...base.use, baseURL: 'http://127.0.0.1:3107' }, webServer: { command: 'npm run dev -- --port 3107', url: 'http://127.0.0.1:3107', reuseExistingServer: false, timeout: 90_000, env: { NEXT_DEV_DIST_DIR: '.next-progress-test' } } };
