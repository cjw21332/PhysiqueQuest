# PoseTracker security audit and safeguards

## Previous claims, assessed before changes

| Claim | Verdict | Evidence |
|---|---|---|
| PoseTracker-specific limiter existed on both launch routes | FALSE | `rtk read backend/src/pose-tracker/pose-tracker.module.ts` showed only JWT/roles guards and no route limiter. `rtk read backend/src/auth/auth-throttle.guard.ts` showed its global path regex does not include PoseTracker launch routes. |
| Per-user and per-IP launch limits existed | FALSE | Same module and global guard inspection; no PoseTracker quota was present. |
| `POSETRACKER_ENABLED` existed | FALSE | `rtk rg -n -i 'POSETRACKER_ENABLED\|rateLimit\|rate.limit\|sanitiz' backend/src/pose-tracker frontend/sections/Coach/PoseTrackerSession.tsx` returned no matches before edits. |
| Errors were comprehensively sanitized | FALSE for the inspected frontend path; NOT VERIFIED globally | Before edits `rtk read frontend/sections/Coach/PoseTrackerSession.tsx` showed `setError(event.message)` and the caught error message being displayed; `mobile/PoseTrackerNative.tsx` used SDK error messages. No proof covers external proxies, provider logs or all runtime telemetry. |
| Claimed limiter/switch tests existed and passed | FALSE for those tests before edits; previous run claims NOT VERIFIED | `rtk read backend/test/pose-tracker.spec.ts` and `pose-tracker-access.spec.ts` showed configuration and access tests, not the claimed limiter/switch cases. Past test output was not supplied. |
| Token exposure was resolved by a limiter or scope | FALSE | `backend/src/pose-tracker/pose-tracker.module.ts` returns `{ config, token, ... }`; `frontend/services/poseTracker/bridge.ts` sets the token URL parameter. `canTrack()` in `exercise-registry.ts` checks application eligibility, not provider-enforced scope. |

## Implemented in this turn

`backend/src/pose-tracker/pose-tracker-rate-limit.guard.ts` uses the existing MongoDB `AuthRateLimit` model and hashed one-minute buckets: 10 requests per authenticated `req.user.userId` and 30 per `req.ip`, shared by both route guards and replicas sharing the database. It fails closed if identity/IP or storage is unavailable and returns 429 and `Retry-After` on limit. `backend/src/application.ts` configures Express `trust proxy` from `TRUST_PROXY` or the food scan proxy setting; correct deployment configuration is necessary for accurate client IPs. Limits apply to launch requests, including unsuccessful and generated-angle requests, not direct calls to PoseTracker.

`POSETRACKER_ENABLED=false` in the main API rejects new provider-backed launches, including admin tests. The default is enabled; generated-angle launches return a null provider token before the switch. Existing sessions and already exposed keys are unaffected. `backend/.env.example` and `docs/POSETRACKER_INTEGRATION.md` document this.

The frontend maps provider error codes to fixed safe messages and discards raw provider error text. Launch exceptions are shown as a fixed message. The native SDK error callback and initialization catch likewise show fixed messages. `mobile/App.tsx` WebView error callbacks log error code or status, not request URL. Frontend and backend Sentry allowlist scrubbers replace exception messages and omit query strings and breadcrumbs. This does not establish that reverse proxies, the provider, all other app paths, or browser tools never log a credential.

## Verification

- From `backend`: `rtk npm test -- --run test/pose-tracker.spec.ts test/pose-tracker-access.spec.ts test/pose-tracker-rate-limit.spec.ts` -> `Test Files 3 passed (3); Tests 13 passed (13)`. Exercises authorization, both route headers, shared route quota, independent user/IP limits, fail-closed storage, switch and generated-angle bypass.
- From `backend`: `rtk npm test` -> `Test Files 99 passed (99); Tests 2469 passed (2469)`.
- From `backend`: `rtk npm run build` -> exit 0, `> nest build`.
- From `frontend`: `rtk proxy node --test tests/pose-tracker.test.mjs tests/sentry-privacy.test.mjs tests/security-headers.test.mjs` -> `tests 12; pass 12; fail 0`; the new synthetic provider error test verifies that its marker and URL do not reach reduced UI state.
- From `frontend`: `rtk proxy node --test tests/*.test.mjs` -> `tests 169; pass 169; fail 0; skipped 0`.
- From `frontend`: `rtk npm run build` -> FAILED, `GenericTrackingSession.tsx:71:52: Expected ']', got '('`. This unrelated existing experimental tracking source was not modified in this turn. Browser end-to-end tests were not run; the frontend build is not certified.
- From `mobile`: `rtk npx tsc --noEmit` -> exit 0, `TypeScript: No errors found`. SDK error mapping was not tested on a physical device.

## Remaining security boundary

Authenticated users can inspect the provider credential sent to their browser and the native app also receives it. CSP, no-referrer and no-store do not hide it from the recipient or prevent all logging. Application limits and the switch cannot prevent direct provider use of an extracted credential. A JWT minted solely by PhysiqueQuest is not a substitute unless PoseTracker supports and validates it. Provider privileges, expiry, origin restrictions, quotas, spending caps and revocation are NOT VERIFIED. Do not claim the vulnerability is resolved or recommend general release on this evidence. The generated-angle path is experimental and not validated for a real-person pilot.
