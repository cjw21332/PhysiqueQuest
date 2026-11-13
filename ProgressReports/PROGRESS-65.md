# PROGRESS-65 — Google Authentication and Registration

## Implemented

- Added backend verification of signed Google ID tokens and Google login/account-check endpoints.
- Added Google login and registration actions to both authentication screens. Unknown Google accounts are directed to registration; existing accounts attempting registration are directed to login.
- Google registration collects a password, requires email OTP verification, and then starts the existing profile setup with the Google name/email. Registration messaging makes clear that setup remains incomplete until the profile is saved.
- Added a native Android Google Sign-In bridge for the mobile WebView and browser Google Identity Services support.
- Preserved resumable profile setup for accounts without a completed profile.
- Documented configuration and platform requirements in `docs/GOOGLE_AUTH.md`.

## Validation

- Backend Google-auth tests: 12 passed.
- Backend build and frontend production build: passed.
- Mobile TypeScript check: passed.
- Browser test for OTP verification followed by profile completion: passed.
- Incomplete-account login/resume and CSP regression checks: passed.

Some older browser scenarios still fail because their fixtures simulate account changes by editing localStorage, which does not replace the current in-memory session. The onboarding suite also has a stale launch-screen text assertion. These failures are not part of the Google registration flow.

## Remaining device checks

- Android Gradle build and physical-device Google sign-in were not verified in this environment; Java/JAVA_HOME is unavailable.
- iOS requires a separate OAuth client and native Firebase configuration.
- Expo push delivery remains unverified on a physical device; it requires a rebuilt native app and backend configured for Expo delivery.
- Keep the service-account JSON in Expo/EAS credentials only; never add it to the repository or share it.
