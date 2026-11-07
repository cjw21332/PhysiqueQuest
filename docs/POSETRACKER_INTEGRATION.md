# PoseTracker integration

Implementation date: 6 November 2026. **Implemented integration infrastructure; live provider verification is pending credentials.** No exercise is claimed to have validated AI form assessment.

## Catalog coverage

The read-only MongoDB audit found 1,500 catalog records, 1,500 unique IDs and 1,500 registry records. There are 15 documentation-based built-in mappings, zero configured custom references, zero references awaiting verification, and 1,485 exercises requiring reference/configuration review. Zero configurations have passed live validation. There are no missing IDs, duplicate IDs or orphan overrides. 552 records require additional camera/occlusion/multiple-observation review. All 1,485 pending records are currently unavailable for tracking; the count of explicitly disabled/unsupported configurations is zero, not a claim that these pending movements are feasible.

See `output/posetracker-exercise-coverage.json` and `output/posetracker-exercise-coverage-report.md` for every exercise, identifier, capabilities, validation state and limitation. Configuration coverage must never be reported as validated movement-analysis coverage.

The registry is a pure shared module in `backend/src/pose-tracker/exercise-registry.ts`, imported by the API, frontend and audit. It materializes one configuration for every supplied catalog record without copying the catalog into a second collection. It uses exact normalized movement names plus equipment, target muscles and instructional evidence. Weighted, unilateral, machine, cable and combined variants do not inherit support merely because their names contain a supported movement. Categories include repetition, isometric, mobility, machine occlusion, additional camera setup and multiple observations. These are configuration triage, not biomechanical assessment.

Built-in mappings currently cover:

| Provider ID | ExerciseDB IDs |
|---|---|
| squat | 6YUfHPL, MDFxU4b |
| push_up | I4hDWkc |
| lunge | iqH55N8, kMzUs9Y, Ql4g5s8 |
| calf_raise | bJYHBIN |
| glute_bridge | u0cNiij |
| bicep_curl | 3s4NnTh, NbVPDMW |
| hammer_curl | 2NpxjC1, 79AmJsI, slDvUAU |
| lateral_raise | DsgkuIt |
| mountain_climber | RJgzwny |

The canonical provider identifier allowlist also supports admin configuration of its documented strength, hold, mobility and physical-test identifiers. An allowlisted identifier is not evidence that a particular ExerciseDB variant or account plan supports it. Unmapped variants need separate review. Jump-height analysis is deliberately not exposed because it requires user-height calibration beyond this interface.

## Sources inspected

The requested [Movelytics repository](https://github.com/Movelytics/posetracker-llm-prompts) was cloned for inspection. Read: README, realtime/reference/upload prompts, capabilities, when-to-use, llms-full, and reference-comparison and form-correction examples. `templates/web/` and `schemas/` are absent from the inspected repository. Its older examples differ from the current event contract.

The supplied [GitBook](https://posetracker.gitbook.io/posetracker-api) explicitly marks itself unmaintained and directs readers to the current docs. Implementation uses these current primary sources:

- [Query parameters](https://docs.posetracker.com/webview/query-params)
- [Iframe messages](https://docs.posetracker.com/webview/messages)
- [Canonical exercise IDs](https://docs.posetracker.com/reference/exercises)
- [Reference movement workflow](https://docs.posetracker.com/webview/reference-movement)
- [Embedding](https://docs.posetracker.com/webview/embed)
- [API key](https://docs.posetracker.com/api-key)
- [Features and plans](https://docs.posetracker.com/reference/features-plans)
- [Events](https://docs.posetracker.com/reference/events)
- [Privacy policy](https://www.posetracker.com/privacy-policy)
- [Terms of use](https://www.posetracker.com/terms-of-use)

Current PoseTracker also offers SDKs; this implementation uses the specifically requested hosted iframe. Reference UUID support remains documented for the iframe, not the SDK.

## Architecture and setup

1. Run the existing main NestJS API and the Coach catalog service with their existing MongoDB configuration. The main API's `EXERCISE_CATALOG_MONGODB_URI` must point to the same catalog as Coach (otherwise it falls back to `MONGODB_URI`).
2. Obtain a genuine dashboard key from [PoseTracker](https://www.posetracker.com). Configure `POSETRACKER_API_TOKEN` in the **main backend** environment, never in `NEXT_PUBLIC_*`, source control or a user-entered URL.
3. Leave `POSETRACKER_DEVELOPER_OUTPUTS=false` for basic/free-plan testing. Enable it only when the account permits angles, recommendations, progression and exercise-time keypoints. Missing or unavailable streams never become fabricated measurements.
4. Restart the main API. Open an exercise's **PoseTracker options**, then explicitly start the session. Missing configuration produces a clear error and no iframe.
5. Run real-person validation on the actual account, devices, camera positions and movements before asserting accuracy or approving references.

`POSETRACKER_ENABLED` defaults to disabled; set it to `true` on the main API only when a provider-backed pilot is authorized. This controls new iframe, native SDK and administrator test launches. Local generated-angle launches are unaffected. Disabling the switch does not stop an existing session or revoke an already disclosed provider key. Both launch routes share MongoDB-backed fixed one-minute limits of 10 requests per authenticated user and 30 per client IP, including failed launch attempts. The guard fails closed if its store is unavailable. Configure the existing `TRUST_PROXY` value to match the actual trusted proxy hops: an incorrect setting can make IP identities inaccurate or spoofable. These limits cannot prevent direct use of an extracted key against the provider.

The documented iframe requires its key in a browser-visible URL. The authenticated POST launch endpoint returns it with `Cache-Control: private, no-store`; it is held only in component memory and removed with the iframe. It cannot be made secret from an authenticated browser user. No documented short-lived iframe-token issuance or origin restriction was identified; none is invented here. Use a dedicated provider key/account, monitor usage and rotate it if exposed. Never use an administrative dashboard password as this key. Native WebView error logging no longer dumps full request URLs, which could contain the key.

`frontend/services/poseTracker/bridge.ts` is the sole URL constructor and event parser. It sets exactly one of `exercise` and `reference`, verifies the official identifier/UUID syntax, enables documented streams only when configured, and adds `isAndroid=true` only inside an Android React Native WebView. The URL is fixed to `https://app.posetracker.com/pose_tracker/tracking`.

`PoseTrackerSession.tsx` manages the iframe, explicit start/stop, configuration, duration, provider observations, errors and unsaved summary. Library detail and rows, Coach recommendation cards and active workout cards all reach the same experience through `PoseTrackerEntry.tsx` or the library detail action. Rows fetch authoritative admin overrides in a bounded batch; offline catalog metadata can still show default pending status. Launch always re-resolves server configuration.

The prior `SquatFormPreview` entry was removed. Its source, rep counter and MediaPipe worker remain because camera-readiness/native code still uses reusable components. There is no automatic or silent MediaPipe fallback. The routine view releases its old hidden preview camera so the iframe can acquire the device. Existing accelerometer-based safety behavior is preserved.

## API and persistence

Main API routes, protected by the existing JWT guard:

- `GET /api/pose-tracker/exercises/:id`: configuration only.
- `POST /api/pose-tracker/configurations`: bounded `{ ids: string[] }` batch, maximum 100 IDs.
- `POST /api/pose-tracker/exercises/:id/launch`: checks eligibility and returns launch configuration and browser token.

Admin routes additionally require the existing `RolesGuard` and `admin` role:

- `GET /api/admin/pose-tracker/coverage`
- `PUT /api/admin/pose-tracker/exercises/:id`
- `POST /api/admin/pose-tracker/exercises/:id/test`

Mongoose collection `exerciseposetrackerconfigs` stores configuration overrides, unique exercise ID, updater identity and timestamps. Strict request validation rejects unknown fields, invented IDs, mixed modes, invalid UUID syntax and evidence-free verification. Pending reference configurations can only launch via the admin test route. No catalog records are modified by mapping or audit. No raw frames, video, keypoint histories or tracking session summaries are persisted. Existing workout values are never overwritten: users review the unsaved summary and enter values through normal workout logging.

## Administrator workflow

Open `/admin/pose-tracker/references` with an administrator account. The backend enforces access even if a user opens the public route shell directly.

1. Search all catalog records and select the exact movement and equipment.
2. For built-ins, select an official identifier only after checking movement equivalence and camera requirements.
3. For references, prepare one representative repetition and create it in the actual [provider dashboard](https://app.posetracker.com/reference-movements/list). This application does not invent UUIDs or assume an undocumented reference-creation API.
4. Enter the genuine UUID, orientation, limitations, equipment notes and validation status. Save as pending.
5. Test the **saved** configuration. The provider must initialize and report a completed event. The interface can copy observed event evidence into the notes; an administrator must also assess the actual movement and suitability. UUID syntax alone never marks a reference verified.
6. Record test evidence, choose verified and save. External provider tests can also be recorded manually by the trusted administrator. This is an administrator attestation, not cryptographic proof of provider ownership or clinical validation.
7. Disable a configuration to remove its tracking eligibility while preserving manual exercise use. Changing mode/identifier resets the UI to pending; verify changed camera/reference conditions again.

## Message contract and lifecycle

Both JSON-string and object transport are supported. Messages require the exact provider origin **and** `event.source === currentIframe.contentWindow`. Unknown, malformed, excessive or invalid messages are ignored. Old iframe events cannot alter a new session. No provider message can write a workout or change admin configuration.

Current iframe fields (do not confuse SDK callback names):

| Event | Accepted payload |
|---|---|
| initialization | message and optional boolean ready; only ready=true establishes initialization |
| counter | integer current_count; optional form_score and reference_score |
| form_score | score, avg_score, grade |
| progression | value in 0–100 |
| recommendations | data: string[] |
| posture | message and boolean ready |
| keypoints | data: bounded normalized joint array; validated and discarded, never stored |
| angles | data with bounded left_side/right_side numeric angle maps; UI sampled at 4 Hz |
| error | error code and message; documented CPU/WASM fallback notices are nonfatal |
| exercise_summary | integer counter |

Current reference fields are `overallScore`, `nccScore`, `dtwScore`, `timingScore`, optional `distScore`, and grade. Older prompt `poseScore`/`movementScore` fields are not fabricated. The UI labels these as similarity to a configured reference. Provider scores are not general medical/technique validation.

Iframe `load` does not imply readiness. The screen waits for provider initialization, times out after 45 seconds without readiness, and reports missing recent updates without inventing a disconnection diagnosis. The cross-origin parent cannot independently inspect provider camera permissions/tracks; provider errors and timeout are used. Stop, navigation, unmount, offline events and page hiding remove the iframe and listeners. A new start resets metrics/counts. Progression is capped at 10 UI updates/second; keypoints do not rerender React. Holds expose elapsed session duration, never fabricated repetitions or verified hold duration.

CSP allows only the provider origin as an additional frame source. Permissions Policy delegates camera to that origin, not microphone/geolocation. The iframe explicitly allows camera and suppresses referrer. Mobile navigation permits the provider tracking path only as a subframe; the existing native message bridge still trusts only the app origin. Physical iOS/Android device behavior remains unverified.

## Privacy, subscriptions and commercial use

The provider describes on-device inference but also documents authentication, metering and technical logs. No network-capture verification was possible without an account key. Do not describe the whole provider session as offline or as transmitting no data. PhysiqueQuest stores no camera media for this feature. Provider account/custom-movement retention follows its policy and account lifecycle.

The reviewed terms prohibit commercial use on the free plan and permit it on paid plans; the provider's documented developer streams are plan-gated. Current docs and terms differ on some quota/overage wording, so confirm actual account terms before a commercial rollout rather than assuming limits or prices. Each iframe opening/reload is a billed tracking call. This implementation closes between exercise sessions for isolation; it does not chain exercises using `set_exercise`. Repeated starts therefore consume additional calls. Provider availability, entitlement, quotas and revocations are surfaced as errors.

## Tests and remaining validation

Run from the repository root or indicated package using RTK:

```text
cd backend
rtk npm run build
rtk npm test
rtk proxy node scripts/audit-posetracker.mjs
cd ../frontend
rtk npm run build
rtk proxy node --test tests/*.test.mjs
rtk playwright test --config=playwright.tracking.config.mjs tests/browser/squat-preview.spec.mjs tests/browser/pose-tracking.spec.mjs tests/browser/exercise-library.spec.mjs tests/browser/workout-routine.spec.mjs tests/browser/auth-nutrition-harden.spec.mjs
cd ../mobile
rtk npx tsc --noEmit
rtk proxy node --test *.test.mjs inactivity/*.test.mjs
```

The legacy-named `squat-preview.spec.mjs` now tests the intentional migration to PoseTracker, rather than looking for the removed MediaPipe entry. Browser fixtures intercept the provider URL and send synthetic messages; a fake camera tests actual iframe permissions. This is not real PoseTracker initialization or accuracy validation. Tests cover source/origin rejection, pending references, invalid configurations, missing token, API authorization, event state transitions, counts/feedback, navigation and stop cleanup, mobile viewport and manual workout preservation.

Live provider readiness/inference latency, account entitlements, real reference ownership, exercise accuracy, sustained sessions, CPU/GPU/battery, real camera denial/disconnection and physical mobile behavior remain pending. `output/posetracker-browser-performance.json`, when generated by the browser test, measures only the mocked iframe plus Playwright assertion overhead. It must not be cited as provider performance.

Final local verification: 168 frontend Node tests, 2,463 backend tests across 98 files, 50 mobile tests, 62 combined browser tests and one real-catalog offline reopening test passed. Frontend/backend production builds and mobile TypeScript passed. See `output/posetracker-implementation-report.md` for the final scope and limitations.
