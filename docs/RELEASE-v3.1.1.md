# PhysiqueQuest v3.1.1

**Prepared:** October 21, 2026 (Asia/Singapore)

## Changes

- Hardened authentication/recovery and first-time nutrition logging; added clearly marked policy draft routes without invented legal text.
- Added local calibration drafts and optional-step skipping, clearer launch/calibration copy, larger touch targets, text scaling and accessible navigation.
- Added ordered workout routines with per-set reps/kg, bodyweight confirmation, skip/revisit, active-session corrections, early-end saving and recovery. Fixed abandoned-session duration rejection and stale workout-in-progress banners.
- Improved exercise-library layout, removed duplicated/legacy CSS, polished frontend behavior and fixed startup IDs on devices without crypto.randomUUID.
- Switched USDA food searches to the supported JSON POST transport after reproducing intermittent GET 400 responses.
- Added local browser/native camera readiness, independent frame freshness, validated session-scoped observations, lifecycle teardown, accessible manual fallback and no readiness image upload. Explicit uploaded-video/provider analysis remains separate.
- Added Metro visibility for the plain shared source folder, fixing Android cameraReadiness module resolution. Updated the Expo Go test harness to load the shared production TypeScript module.
- Included non-ignored project source, assets, tests, planning/design records, reports and verification artifacts in the release snapshot. Ignored secrets, dependencies and caches are excluded.

## Verification

Fresh release checks: 159 frontend/mobile Node tests and 382 backend tests passed; frontend production build and mobile TypeScript passed. The preceding cache-cleared Android export bundled 1,400 modules and the pose model. Camera readiness's preceding browser run passed 30/30 tests; this release task did not repeat those browser tests.

## Known Limits

Camera readiness Phase 1 remains human_needed: all 45 physical trials and six calibration decisions are pending. Body/brightness/framing flags stay false until supported by actual-device evidence. Native pose tracking requires an appropriate development build; Expo Go provides fallback behavior. Policy routes remain drafts pending team review. Provider/deployment and live database behavior are not newly certified by automated tests.

See [checklist](./checklist.md), [device verification steps](../.planning/phases/01-camera-readiness/01-UAT.md) and [release preparation report](../ProgressReports/PROGRESS-56.md).
