# PhysiqueQuest — Plan to resolve remaining issues

Prepared October 18, 2026 (Asia/Taipei). Planning only: this document does not deploy, upgrade packages, change account records, or enable external delivery.

## Objective and baseline

Resolve the seven remaining issue areas from the [functionality audit](FUNCTIONAL_AUDIT_2026-10-18.md): password recovery, dependencies, Android deployment, physical-device evidence, live providers, incomplete product actions, and on-device form feedback. Preserve existing workout/date/account isolation and reviewed local repetition counting.

Baseline: 350 backend tests, 125 frontend/mobile Node checks, 40 browser scenarios, one database-backed startup smoke test, both builds, lint/type checks, and Android Hermes export passed. Those counts are a regression baseline, not a requirement to keep a fixed number of tests or evidence of real-device accuracy.

## Delivery order and completion gates

| Phase | Deliverable | Depends on | Completion gate |
|---|---|---|---|
| 0 | Reproducible baseline and staging test data plan | None | Save current versions, lockfiles, test results and rollback point; identify temporary test accounts and contacts. |
| 1 | Secure account recovery and session invalidation | 0 | Cross-account reset, guessing, expired/reused codes, concurrent reset and old-session tests pass. |
| 2 | Compatible dependency remediation | 0; verify 1 on updated versions | Every advisory has a fix or a specific exposure/mitigation decision; supported dependency set builds, tests and exports. |
| 3 | Finish sharing and administrator tools | Stable API/runtime from 1–2 | Every displayed action succeeds or provides a truthful recoverable result; ordinary users remain denied admin access. |
| 4 | Implement the local form-feedback-to-report path | Stable runtime; validated local checks | Validated analysis is saved against the owned workout and survives reload; failures retain manual logging. |
| 5 | Hosted staging and signed Android candidate | 1–4 | Public HTTPS services and release configuration work on a phone away from the developer LAN. |
| 6 | Verify live providers and persisted journeys | 5; real provider configuration | Controlled email, food and safety tests pass; confirmed data is read back from the staging database. |
| 7 | Physical Android, accuracy and performance testing | 5–6 | Supported-device matrix meets predeclared acceptance criteria; background/permission limitations are accurately presented. |
| 8 | Production rollout and release evidence | All previous gates | Migration rehearsed, release signed, health checks pass, rollback available and documentation updated. |

Phases are reviewable changes, not one large rewrite. A failed gate keeps its issue open. Provider procurement and device access affect completion dates, so no fixed release date is promised here.

## Phase 0 — Preserve a reproducible starting point

- Record current branch/revision and all uncommitted work. Keep documentation changes and prior audit changes visible; do not reset or discard them.
- Save exact lockfiles, current configuration names, declared indexes, test output, and an Android export/build identifier.
- Establish a separate staging database and at least two ordinary test accounts plus one administrator. Use synthetic workout/meal data and a designated consenting test contact.
- Define the rollback point before each API/schema/dependency change. Take a restorable database backup before migrations; rehearse restoration on staging.
- Add a repeatable check sequence covering tests, lint, types, builds, browser scenarios and Android export. Production signing remains a separate check.

## Phase 1 — Fix password recovery as one coordinated flow

### Proposed flow

1. Request recovery with an email. Return a high-entropy opaque request ID with an account-neutral response. Unknown emails must not reveal registration status through a different response contract.
2. Deliver the six-digit code through the configured email provider. The request ID identifies the recovery attempt; the code is checked only within that attempt/account.
3. Verify the request ID and code. Successful verification produces a short-lived, high-entropy reset authorization token, restricted to changing that account's password.
4. Confirm the new password with that authorization token. Consume the authorization once, change the password, invalidate the user's other recovery requests, and increment the user's session version atomically.
5. Require normal login again. Previously issued sessions fail validation after the reset; the reset flow itself does not become a general login token.

### Backend and client changes

- Replace global code-hash lookup with request/account-bound verification. Store a keyed code digest or an appropriate slow hash; do not store plaintext codes. Separate request and reset-authorization identifiers from the displayed code.
- Add expiry, attempt counters, used/verified state, and request identifiers to recovery records. New random identifiers have their own uniqueness/retry handling; equal six-digit codes for different requests must be safe.
- Validate expiry in application logic; do not rely on asynchronous TTL deletion.
- Proposed starting policy: code valid 10 minutes, at most 5 incorrect verification attempts per request, resend no sooner than 60 seconds, reset authorization valid 5 minutes. These values are product/security defaults to verify, not values mandated by OWASP.
- Rate-limit request, verification and confirmation paths across requests and deployed instances. Combine atomic per-request attempt checks with per-account and per-IP limits through a shared store or the trusted hosting gateway. An in-memory counter alone is insufficient for a multi-instance deployment.
- Use compare-and-update/transactions to prevent two requests from both consuming the same authorization. Rehearse transaction behavior on the selected MongoDB deployment.
- Add `sessionVersion` to users and JWT issuance/validation. Treat a missing version as 0 during migration; a reset increments the stored version, so older tokens are rejected without immediately logging out every unaffected user.
- Update request DTOs, reset screens, API types, navigation state and tests together. Disable the vulnerable legacy confirmation path; accepting the old global-code-only route would preserve the bypass.
- Remove existing live reset codes during the coordinated rollout and ask affected users to request a new code. Replace the old global tokenHash uniqueness/index design only after staging migration checks.
- Keep errors neutral about account existence and avoid logging codes/tokens. Backend-only secret configuration and any reset-notification email are part of the rollout.

### Acceptance tests

Unknown email neutrality; correct and incorrect request/code pairing; equal codes in different requests; resend/expiry; denied guesses after attempt cap; limits across instances; repeated/concurrent confirmation; database failure during reset; reset-token scope; password login; old JWT rejection and new JWT success. Existing accounts without sessionVersion must follow the migration policy.

This design follows the principles in [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): account-neutral responses, rate limits, user-bound expiring single-use identifiers, and session invalidation. The exact request/grant API is a project design choice.

## Phase 2 — Remediate dependencies without breaking Expo

- Re-run root/workspace and independent backend audits. Trace each underlying advisory with `npm explain`; distinguish runtime, build-time, development-only and unused vulnerable paths.
- Start with supported patch updates such as a patched source-map-js where available. For transitive packages, prefer an upstream parent update that explicitly supports the patched dependency.
- Evaluate braces, node-forge, uuid and backend tmp using the actual installed path and affected operation. Re-check available fixes at implementation time; the audit snapshot is not a permanent version prescription.
- Change one dependency family at a time, retain lockfile diffs and compare build/native-module behavior. Do not run forced audit upgrades or override incompatible majors to silence a report.
- If an Expo SDK change is necessary, use Expo's compatibility checks, align the supported React/React Native/native modules, regenerate a development/release build, and repeat camera, WebView, motion, location and sharing tests.
- If an upstream fix is unavailable, document the exact affected path, whether it is reachable, the mitigation, an owner and a recheck date. An exposed unresolved high-risk path blocks release; audit counts alone do not establish runtime exposure or safety.

Gate: regression suites, lint/types/builds, Android export and a native Android build pass; each underlying advisory has a reviewed disposition. Follow [Expo's upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) and [CLI compatibility checks](https://docs.expo.dev/more/expo-cli/).

## Phase 3 — Complete visible product actions

### Workout sharing

Generate share text from the confirmed saved workout: exercise names, reviewed sets/reps/load and duration. Use an Android native share-sheet bridge; use browser sharing when supported, with copy/download fallback. Treat cancellation as cancellation, not failure. Never share login tokens, emergency-contact information or local-only workout URLs. Private report URLs must not be made public automatically. A public share-link feature would require separate scoped/revocable access and is not needed for basic sharing.

Gate: share-sheet success/cancel, unavailable browser API, safe exported content, and report refresh tests on a signed Android build.

### Administrator analytics

Remove the forced preview flag from the normal verified-admin entry and call the existing analytics API. Keep any sample view explicitly separated and labeled. Verify date boundaries, empty/error/loading states, 7/30/90-day ranges and CSV output against known staging records. Sanitize exported spreadsheet cells and retain role checks.

Gate: ordinary accounts receive no admin data, and known test activity produces the expected real analytics/exports.

### Exercise administration

Expose edit and publish/unpublish controls using existing protected APIs. Treat this as the administrator catalog, distinct from external ExerciseDB. Prefer unpublishing over deletion; add explicit deletion confirmation and preserve names/results in historical workout snapshots. Validate fields and handle stale/missing records gracefully.

Gate: create/edit/status/delete behavior persists after reload; unauthorized requests fail; history remains readable after a catalog change. Resolve any misleading public-library wording.

## Phase 4 — On-device form feedback (revised scope)

The user clarified on October 18 that pose processing should remain local. The separate Render pose-service draft was removed before deployment. Render will host only the frontend and account/library APIs.

- Reuse the existing local pose worker and model. Do not upload workout videos or landmark frames for form feedback.
- Start with observable, exercise-specific checks supported by the visible landmarks and camera view. Keep confidence/coverage and algorithm version alongside any feedback.
- Display insufficient visibility, unsupported movements and inconclusive results honestly. Do not invent a form score, medical assessment, calorie estimate or certified safety claim.
- Let the user review results, then persist only reviewed summary/check metadata against their owned workout or set. Keep manual logging and local repetition counting usable if feedback is unavailable.
- Verify supported exercises on labeled human clips and actual Android devices before enabling new checks. Measure memory, frame processing, battery and heat; avoid adding a second inference pass for the same frame.
- Add ownership, schema, correction/retry and report-reload tests for any new stored metadata.

Gate: reliable local checks retain their limits, confirmed results survive reload, videos remain local, and physical-device accuracy/performance evidence meets the agreed criteria.

## Phase 5 — Create hosted staging and the Android candidate

- Use the selected Render host; configure public domain(s), managed database/network access and provider accounts. Use the documented [Android deployment layout](NETWORK_LAYOUT.md).
- Host the frontend, account API and independent catalog API behind public HTTPS addresses, with explicit CORS origins and backend-only secrets. Verify both APIs independently.
- Separate development/staging/production configuration. Override/remove private-LAN defaults in the release profile. Set frontend and native-shell API URLs explicitly, including the catalog URL.
- Add health checks, error reporting, provider timing metrics and database backups without logging user media or credentials. Check proxy/body/time limits against phase 4.
- Set Android package identity/versionCode, signing credentials, required native modules and permissions. Keep signing keys outside Git.
- Produce a signed release APK for staging testers and an AAB for intended Play distribution. Check installation, cold start, data persistence after restart and update from the previous candidate. Hermes export alone does not close this phase.
- Test on mobile data or a different Wi-Fi network so a developer LAN dependency cannot be mistaken for deployment readiness.

Gate: the signed app opens the hosted interface and completes a staging workout with fresh database read-back, without Expo Go, Metro or a developer computer.

## Phase 6 — Verify real providers and stored journeys

Use dedicated staging accounts and a controlled consenting contact. Paid calls and external messages should be limited to the agreed test cases.

| Integration | Required evidence |
|---|---|
| Reset email | Receipt at the intended inbox, usable request-bound code, expiry/single-use, failure handling and old-session revocation. |
| Food scan | Known meals through real identification/nutrient providers; review/correction; saved meal values match staging read-back. |
| Safety delivery | One controlled real delivery; correct contact/context; cancelled countdown produces no delivery; retries do not duplicate delivery; no-location path works. |
| Exercise library | Real search/filter/details/GIF, rate-limit/unavailable recovery, and saved-program reuse. |
| Local form feedback | Labeled supported/unsupported clips on actual Android devices, honest visibility/confidence handling and reviewed metadata persistence; videos remain local. |
| Account/data isolation | Two users cannot read or modify one another's workout, recording, nutrition, measurement, alert or analysis records. |

A provider's accepted request is not automatically proof of end-user delivery. Record the provider's actual confirmation semantics and observe receipt where practical. Do not send emergency-test messages to an unsuspecting contact.

## Phase 7 — Physical Android and performance evidence

Use a signed candidate on at least one lower-resource and one typical supported Android device. Record OS/device/WebView versions, app revision and test clips; broaden coverage if failures are device-specific.

- Test camera/location permission approval, denial, permanent denial and later restoration; handle limited/no location without blocking session recovery.
- Test video selection, orientation, device codecs, realistic lighting/angles/occlusion, interrupted analysis and corrupt/unsupported media.
- Build a reviewed clip set for each supported exercise. Report exercise identification precision/recall, rep-count error, unknown-clip behavior, and inference failure rates. Agree on acceptance thresholds before evaluating the held-out test clips.
- Exercise start/done, next exercise, skips, edits, pause/continue, termination, app restart, network loss/recovery and concurrent-device saves. Confirm no duplicate sets/credits.
- Test inactivity monitoring during exercise, rest, pause, disabled settings, screen lock and backgrounding. Initial recommendation: clearly defined foreground monitoring; do not promise locked/background protection without implementing and validating the required native behavior.
- If background protection is a product requirement, design it as a separate native work item with the appropriate service/lifecycle/permissions and Android policy review, then include it in this gate. A failed background test cannot be closed by changing a label alone when background protection is required.
- Measure cold/warm start, API and analysis latency, dropped frames, memory, long-session battery/temperature, and representative database query costs. Add optimizations only where measurements identify a bottleneck; preserve accuracy and privacy.
- Re-test sharing, audio preferences, Android navigation, text sizing and narrow-screen layouts.

Android requires permission/lifecycle handling appropriate to the operation; consult [Android runtime-permission guidance](https://developer.android.com/training/permissions/requesting). Emulator success is useful but does not substitute for these checks.

## Phase 8 — Release and rollback

- Re-run the full regression suite and all new security/analysis tests on the release candidate. Compare with phase 0; document any intentional changes.
- Rehearse recovery-record/index/session-version migration and rollback. Coordinate frontend/backend rollout so no vulnerable old reset route remains enabled.
- Preserve backups and ensure old clients either receive a supported flow or an explicit update-required response. Do not restore an insecure password-reset endpoint as the rollback strategy.
- Verify public URLs, certificates, database access, provider readiness and signed package metadata. Test a real install/update on mobile data.
- Publish through the selected distribution channel only after the release gates pass; monitor authentication failures, provider errors, API latency, startup failures and crashes. Keep a documented rollback path for each deployed component.
- Update the ERD/data dictionary for schema changes, release notes, Android network diagram, environment examples, privacy/retention documentation and the evidence matrix.

## Decisions/input required before dependent phases

| Decision or resource | Needed by | Recommended starting position |
|---|---|---|
| Production host, domain and budget | Phase 5 | Render selected; public URLs, account access and deployment budget remain to be configured. |
| Real email and safety delivery accounts / test recipient | Phases 1 and 6 | Backend-only credentials and controlled staging recipients. |
| Supported local form-feedback checks / exercises | Phase 4 | Validate a small supported exercise set on-device; keep manual logging and local counting available. |
| Foreground versus required background safety behavior | Before phase 7 implementation is finalized | User selected foreground-only, with a visible paused-monitoring notice and explicit resume. |
| Android device access and signing/distribution ownership | Phases 5–8 | Signed staging APK, then intended distribution artifact. |
| Accuracy and performance targets | Before held-out tests in phase 7 | Set measurable targets together; do not invent statistics or claim accuracy from synthetic clips. |

These are dependencies to resolve while independent work progresses, not reasons to stop phase 0 or phase 1 planning. Application code work can begin with recovery hardening once this plan is accepted.
