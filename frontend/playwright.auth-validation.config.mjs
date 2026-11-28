import onboarding from './playwright.onboarding.config.mjs';
export default { ...onboarding, testMatch: 'auth-validation.spec.mjs' };
