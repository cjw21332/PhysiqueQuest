# PhysiqueQuest v4.1.0 progress report

Date: 29 October 2026 (Asia/Singapore)

This report describes the working tree being prepared from v4.0.0. It is a test and implementation snapshot, not a statement that the complete system is production-ready or error-free.

## Changes and improvements

- **Dietary plan:** Added Scan views for an active plan, custom energy and macro targets, and a meal schedule. The backend stores dietary targets with nutrition data and can request an AI recommendation for user review. Estimates and recommendations are not medical advice.
- **Nutrition and progress:** Updated meal, water, food history, goals, and progress views to use saved records and report unavailable or empty data honestly.
- **Notifications:** Added account-backed read state, mark-all-read and configurable daily reminders, with push-device integration and mobile notification handling. See `docs/PUSH_NOTIFICATIONS.md` for setup and limitations.
- **Caching:** Expanded the account-scoped device cache for selected nutrition, notification, workout, progress and exercise-library data. Recent library queries and exercise details are cached with bounded retention and background refresh. This does not cover every page or guarantee offline writes.
- **Coach and Prepare:** Improved the exercise library and recorded-video selection, validation, preview and report. The backend validates supported video sizes, formats and duration and forwards video to a configured pose provider. The new self-hosted MediaPipe service extracts pose landmarks and approximate joint angles, and can return an experimental cycle count for a user-selected chest press or squat when signal checks pass. Optional Gemini review can return exercise and form observations; AI errors fall back to the pose report. Form scores, injury risk, and correct-form repetitions are not validated.
- **Mobile and documentation:** Updated the Expo notification integration and added system flowchart and feature inventory documents under `output/system-documentation/`.

## Validation performed

- Backend production build: passed (`npm run build`).
- Frontend production build: passed (`npm run build`), including static page generation.
- Backend full unit/integration suite: **535 tests passed across 80 files**, after updating the notification test mock for the atomic update and allowing more startup time for the local pose service under load.
- Frontend and mobile TypeScript checks: passed (`npx tsc --noEmit` in each workspace).
- Focused browser checks for recorded-video upload/retry and exercise-library caching/responsive layout: 4 passed. These use mocked API responses.
- Local pose cycle unit test passed. The real local pose-provider integration also passed in the backend suite. Earlier testing of the supplied 11-second recording produced valid pose observations, but insufficient evidence for a local repetition count.
- The broad frontend Node test collection **failed**. Failures include test harnesses that cannot load component CSS or a newer `titleCase` import, and assertions that no longer match current views; the full set requires investigation rather than being assumed harmless.
- The browser notification test passed in isolation after timing out during a heavily concurrent run. The cache browser suite had seven failures around restoring the mocked session; its separate Coach plan test passed. These failures do not establish whether the production workflows work correctly.

## Remaining risks and follow-up

1. Investigate and repair the failing frontend unit and cache browser suites, and rerun end-to-end journeys in isolation.
2. Verify production push registration, delivery, background behavior and permission flows on physical Android and iOS devices.
3. Verify Gemini and other configured providers in the intended deployment; Gemini previously returned 503 errors for exercise review. Do not infer that two API keys guarantee availability.
4. Validate pose-based repetition counting and exercise-specific form feedback against labeled videos, camera angles, people and exercises before making accuracy or safety claims.
5. Perform an end-to-end review across all modules and supported devices. The checks above are not proof that every page, external integration, or failure path works perfectly.
