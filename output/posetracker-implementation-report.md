# PoseTracker implementation report

6 November 2026 — local workspace implementation. **No live PoseTracker success is claimed: the required provider token is absent.**

## Delivered

- Catalog-wide configuration resolution and audit over the existing MongoDB ExerciseDB catalog.
- Documented built-in and custom-reference URL modes; strict mutually exclusive identifiers; no fabricated reference UUIDs.
- JWT-protected launch/configuration API, admin role enforcement, validated persistent overrides and a unique exercise-ID index.
- Reusable iframe session with validated origin/source bridge, current documented event parsing, actual-event-driven readiness, counters, progression, feedback, similarity metrics, sampled joint angles, elapsed duration, errors, stop and unsaved summary.
- Explicit entry points in library rows/details, AI Coach recommendations and active workout cards. Pending configurations leave manual logging available.
- Admin reference workflow at `/admin/pose-tracker/references`, full-catalog search, pending/test/verified/disabled stages, and human-recorded provider evidence.
- Camera/CSP permissions, iframe cleanup, stale-frame isolation, account-session cleanup, Android iframe flag and constrained native-wrapper subframe navigation.
- Replaced the old user-facing squat preview. Retained reusable MediaPipe/readiness source without silently falling back to it.

## Coverage results

| Measure | Result |
|---|---:|
| Catalog records | 1,500 |
| Unique ExerciseDB IDs | 1,500 |
| Registry records | 1,500 |
| Documentation-based built-in mappings | 15 |
| Configured verified custom references | 0 |
| References awaiting verification | 0 |
| Reference/configuration review required | 1,485 |
| Explicitly disabled/unsupported configurations | 0 |
| Currently unavailable tracking configurations | 1,485 |
| Additional camera/occlusion/multiple-observation review | 552 |
| Live-validated configurations | 0 |
| Missing/duplicate/orphan mappings | 0 |

Pending is not supported. Zero explicitly disabled entries does not imply that all pending movements can be measured. The 15 built-in mappings cover nine provider identifiers, with equipment, target and instructional checks; they have not passed real-person validation. The JSON and Markdown coverage reports enumerate every catalog ID.

## Source and architecture inspection

Inspected the requested Movelytics README, realtime/reference/upload prompts, examples, capabilities, when-to-use and llms-full. The requested templates/web and schemas directories are absent from that repository. The provided GitBook is explicitly deprecated. Current official query, message, exercise, reference, embed, key, events and plan documentation informed implementation. Privacy policy and terms were reviewed. Full links and differences from older examples are in `docs/POSETRACKER_INTEGRATION.md`.

Existing camera hooks, MediaPipe worker, shared rep counter and POC report were inspected, along with exercise catalog synchronization/querying, library details, Coach plans, routine/LiveSession, API session management, admin guards and the native WebView wrapper. Existing React hooks, NestJS, Mongoose and API persistence patterns remain in use.

## Files and database

New central code: `backend/src/pose-tracker/exercise-registry.ts`, `pose-tracker.module.ts`; `frontend/services/poseTracker/bridge.ts`; `PoseTrackerSession.tsx`, `PoseTrackerEntry.tsx`, `posetracker.css`; admin reference page; audit script; unit, authorization and browser tests.

Modified integration points: main AppModule; catalog read methods; API client; ExerciseLibrary; CoachPlan; RoutineSession; LiveSession camera ownership; security headers; mobile wrapper/navigation; admin-route chat knowledge; backend environment example; historical POC documentation. Existing stale regression fixtures were corrected for the current auth/session route, title casing, reload behavior and layout rounding without removing their assertions.

MongoDB addition: `exerciseposetrackerconfigs` for sparse overrides keyed by unique exercise ID, with updater/timestamps and validation evidence. The catalog itself is neither replaced nor copied into a new collection. No actual reference or verification record was fabricated. No camera media, keypoint history or unsaved session is persisted. Manual workout values are unchanged.

## Verification

- Frontend production build and TypeScript passed.
- Backend production build passed.
- Frontend Node tests: 168 passed.
- Backend full Vitest suite: 2,463 passed across 98 files.
- Mobile Node tests: 50 passed; mobile TypeScript passed.
- Full-catalog read-only MongoDB audit passed: exact ID coverage.
- Offline reopening browser test passed against the real 1,500-record catalog, including cached demonstration and reconnection.
- Final combined browser regressions: **62 passed, 0 failed**, including all eight PoseTracker migration/integration scenarios. Run duration: 66.4 seconds on local desktop Chromium.

Provider browser tests use an intercepted HTTPS iframe and synthetic documented events. A real Chromium fake-camera stream exercises cross-origin camera permission delegation. Provider errors are simulated; they are not observations from a live PoseTracker account. Tests cover initialization, malformed/source/origin messages, stale sessions, permission/disconnection messages, missing tokens, reference mode, timeout, visibility cleanup, navigation cleanup, mobile layout, Coach/workout entry points, admin pending configuration and manual draft preservation. Existing library, auth, nutrition and workout regression tests are included.

The final mocked-browser timing sample is in `output/posetracker-browser-performance.json`; initialization includes iframe load, fake camera and Playwright assertions, and counter-to-UI timing includes assertion overhead. Neither measures actual provider inference or network performance. No sustained CPU/GPU/battery or physical mobile measurements were taken.

## Remaining external configuration and validation

Set a genuine `POSETRACKER_API_TOKEN` on the main API and restart it. Enable developer outputs only if entitled. Create actual reference movements in the provider dashboard, record their UUIDs, then test/verify each specific exercise and camera setup using the admin workflow. Live token acceptance, actual initialization and errors, account plan availability, genuine reference ownership and movement accuracy are all pending.

The iframe token is necessarily visible to authenticated browser users; no documented ephemeral token API was invented. Provider processing is described as on-device, but authentication/metering and technical metadata are transmitted. Commercial use is prohibited on the reviewed free-plan terms; paid account terms and quota wording must be confirmed before commercial rollout. Session reopening consumes another provider tracking call. The system does not claim pain/injury assessment, perfect technique, or validated form checking for all catalog exercises.
