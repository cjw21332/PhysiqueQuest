# PhysiqueQuest remaining-work checklist

> Latest implementation and verification: [October 18 remediation results](REMEDIATION_2026-10-18.md). Earlier audit findings below describe the baseline and are superseded where explicitly closed in that report.

Reviewed October 17, 2026, against the supplied v2.7.3 folder.

> Historical checklist: several workout and state-connection items below were implemented after this review. Use the [October 18 functionality audit](FUNCTIONAL_AUDIT_2026-10-18.md) for current verification results and unresolved gaps.

## Assessment

The project has substantial implementation across Next.js, the NestJS account API, the standalone exercise service, MongoDB persistence, and the Expo WebView shell. Authentication, profiles, saved Coach programs, nutrition, quests, progress, notifications, and protected administration already have backend code. The next milestone should be a secure, verified complete workout and account experience, followed by provider/device verification and deployment readiness.

This review distinguishes **confirmed code gaps**, **verification gaps**, and **product/release decisions**. An unchecked verification item does not mean the implementation is broken. Existing dated evidence in [checklist.md](checklist.md) remains historical; it is not replaced by this audit.

## Fresh local checks

| Check | October 17 result |
| --- | --- |
| Frontend and mobile Node tests | 120 passed |
| Backend Vitest suite | 309 passed across 41 files |
| Frontend production build | Passed, including TypeScript and route generation |
| Backend production build | Passed |
| Mobile TypeScript | Passed using root TypeScript with `--noEmit -p mobile/tsconfig.json` |
| Backend lint | Passed with four warnings: three unused declarations/parameters and one duplicate test-fixture key |
| Frontend lint | **Failed**: `next lint` is removed in the installed Next.js 16 version |
| Existing browser suite | **Inconclusive**: Edge runner reached test 10/10 but did not return a final summary after more than four minutes; uses local production frontend and mocked API responses |

No live database writes, provider deliveries, physical-device checks, native compilations, dependency vulnerability audit, or production deployment were performed. The supplied folder has no Git repository metadata, so branch, commit, and uncommitted-change status cannot be verified here. Application source was left unchanged; this document is the audit deliverable. Build and test tools generate their normal local output.

## P0 — Security work before public release

- [ ] **Bind password-reset codes to a recovery request/account and limit verification attempts.** `PasswordRecoveryService.verify()` and `confirm()` search globally by a six-digit code hash. The public controller accepts only code/password, and neither operation has an attempt limit. The resend cooldown does not protect code guessing. Introduce an opaque request identifier or a high-entropy recovery token, enforce expiry and per-request/account/IP limits, and test rejected guesses and cross-account requests. Evidence: [service](../backend/src/auth/password-recovery.service.ts), [controller](../backend/src/auth/auth.controller.ts).
- [ ] **Handle recovery-code collisions.** Six-digit code hashes have a global unique index, but code creation has no collision retry. Two accounts receiving the same random code can cause reset issuance to fail. Scope uniqueness to the recovery request or use high-entropy tokens. Evidence: [token schema](../backend/src/auth/recovery-token.schema.ts).
- [ ] **Revoke previously issued sessions after a password reset.** Reset currently changes `passwordHash`; JWT validation checks account existence/activity but no password/session version. Existing signed tokens therefore remain usable until expiry. Add and verify session invalidation. Evidence: [reset service](../backend/src/auth/password-recovery.service.ts), [JWT strategy](../backend/src/auth/jwt.strategy.ts), [auth service](../backend/src/auth/auth.service.ts).

## P1 — Finish the primary product flows

- [ ] **Guide users through every exercise in a selected workout.** Coach stores all selected exercise IDs but passes only `sessionExercises[0]` into `LiveSession`; there is no exercise advancement or set progression. Add an exercise queue, current-exercise position, and appropriate completion/skip controls. Evidence: [CoachSection](../frontend/sections/Coach/CoachSection.tsx), [LiveSession](../frontend/sections/Coach/LiveSession.tsx).
- [ ] **Add manual reps/load entry and save the results.** The visible session has no logging controls, and normal completion calls `completeWorkout(id, seconds)` with the default empty `exerciseResults`. Persist entered results and show readable exercise names in the report instead of raw provider IDs. Evidence: [workout hook](../frontend/hooks/useWorkouts.ts), [report](../frontend/sections/Coach/WorkoutReport.tsx).
- [ ] **Restore sessions and reports after navigation or reload.** The active workout and report live in component state. Add recovery of active/paused sessions and a history/detail route that loads a persisted workout. Verify that refreshing does not strand a saved active session. Evidence: [CoachSection](../frontend/sections/Coach/CoachSection.tsx), [workout service](../backend/src/workouts/workouts.service.ts).
- [ ] **Resolve inactivity-settings behavior.** Me exposes `settings.inactivity`, but Coach passes only the threshold and LiveSession always starts monitoring. Define whether monitoring is mandatory or optional, then align settings, labels, and the native command. Evidence: [MeSection](../frontend/sections/Me%20Section/MeSection.tsx), [CoachSection](../frontend/sections/Coach/CoachSection.tsx), [LiveSession](../frontend/sections/Coach/LiveSession.tsx).
- [ ] **Define and test safety behavior while a workout is paused.** Pause updates the API and UI timer, but sends no pause command to the native inactivity monitor. If pauses should suspend monitoring, implement that transition; otherwise make continued monitoring clear and verify rest periods do not cause unexpected alerts. Evidence: [LiveSession](../frontend/sections/Coach/LiveSession.tsx), [native monitor](../mobile/inactivity/nativeMonitor.ts).
- [ ] **Connect the alarm-volume preference to behavior or remove the switch.** `alarmVolume` is saved and displayed in settings, but no alarm path reads it. Define the supported behavior and test both switch states. Evidence: [settings](../frontend/hooks/useSettings.ts), [MeSection](../frontend/sections/Me%20Section/MeSection.tsx), [LiveSession](../frontend/sections/Coach/LiveSession.tsx).
- [ ] **Activate real admin analytics.** Me explicitly renders `<EngagementAnalytics preview ...>`, bypassing the existing API-backed path. Remove the forced preview for production administrators and verify date ranges, empty/error states, retention, and exports with real records. Evidence: [MeSection](../frontend/sections/Me%20Section/MeSection.tsx), [analytics](../frontend/sections/Me%20Section/EngagementAnalytics.tsx).
- [ ] **Clarify and finish exercise administration.** The UI supports listing and creation, while backend PATCH/DELETE operations have no corresponding UI. Its “Visible to all users in the library” text also conflicts with v2.7.3's independent ExerciseDB library, which does not consume these legacy records. Decide the catalog's purpose, correct labels, and add the required edit/unpublish/delete controls. Evidence: [admin UI](../frontend/sections/Me%20Section/AdminExerciseLibrary.tsx), [controller](../backend/src/exercises/exercises.controller.ts), [current architecture](AI_COACH.md).
- [ ] **Implement report sharing or remove the actionable Share control.** It currently only displays an unavailable toast, including in ordinary web sessions. Verify native sharing where available and a usable web fallback. Evidence: [CoachSection](../frontend/sections/Coach/CoachSection.tsx).
- [ ] **Align video upload and server body limits.** CameraCheck accepts videos up to 20 MB, but the global JSON parser uses the scanner budget, approximately 5.4 MiB with default settings. Larger accepted videos cannot reach pose validation. Use route-appropriate upload limits/transport and test near-limit requests through real application bootstrap. Also enforce the advertised two-minute duration; the UI does not supply duration metadata. Evidence: [CameraCheck](../frontend/sections/Coach/CameraCheck.tsx), [bootstrap](../backend/src/main.ts), [scanner config](../backend/src/common/foodscan/foodscan-config.ts), [pose DTO](../backend/src/pose/dto/pose-analysis.dto.ts).
- [ ] **Finish the provider-to-report data path if form analysis is a release requirement.** Configuring a pose URL/key alone will not complete this feature: LiveSession does not submit workout analysis, upload analysis is displayed as raw JSON, and WorkoutReport always renders a dash for form score and an unavailable message. Define a validated analysis contract, persist appropriate results, and render useful feedback. Calorie estimates and personal records need their own supported calculations/data paths. Evidence: [pose provider](../backend/src/providers/pose-analysis.provider.ts), [CameraCheck](../frontend/sections/Coach/CameraCheck.tsx), [report](../frontend/sections/Coach/WorkoutReport.tsx).
- [ ] **Fix frontend lint and standardize verification commands.** Replace `next lint` with a configured supported linter. Add discoverable scripts for all Node tests, browser tests, and mobile types, then clear the four backend warnings. Installed Next.js documentation explicitly confirms `next lint` was removed. Evidence: [frontend scripts](../frontend/package.json), [backend scripts](../backend/package.json).

## P2 — Verify integrations and saved user journeys

Use a dedicated staging account and controlled emergency test contact. Record deployment/version, date, observed database read-back, and device/provider versions. Existing mocked tests and prior dated checks do not close these items for a new deployment.

- [ ] **Authentication and onboarding:** register, log in, complete calibration, reload saved profile, expire a session, log out, switch accounts, and verify data isolation. Test interrupted onboarding and retry after account creation.
- [ ] **Email recovery:** verify configured email delivery, receipt, expiration, one-time use, password change, login, and old-session revocation after the P0 changes.
- [ ] **Home and profile/settings:** change meals, water, workouts, measurements, goals, units, equipment, and preferences; reload and confirm dashboard and profile agree with persisted values.
- [ ] **Coach and exercise library:** repeat saved-program reuse, changed-preference regeneration, search/filter/detail/GIF, and provider failure/rate-limit recovery against the intended deployment. October 15 local evidence already exists; preserve it as the baseline.
- [ ] **Workouts:** start, advance exercises, log results, pause/resume, finish, reload the report, and compare IDs, reps, loads, duration, and ownership with stored records after P1 implementation.
- [ ] **Food scanning/search:** submit real images/queries using configured Gemini/USDA, review portions and unmatched items, save results, and reload the meal log. Test slow, unavailable, and rate-limited providers. Credential presence/availability was not inspected in this audit.
- [ ] **Nutrition and water:** create/edit/delete meals, change water, reload history, and verify totals and date boundaries for the same account.
- [ ] **Quests, streaks, and leaderboard:** perform qualifying activity, reload derived progress/rankings, and test periods, privacy opt-out, and day/week boundaries with real records.
- [ ] **Progress:** save and delete measurements, reload history/charts, and verify units and ownership.
- [ ] **Notifications:** create genuine records, mark one/all read, reload, and verify persisted state rather than labeled sample previews.
- [ ] **Administration:** test a provisioned admin and ordinary account against actual APIs; verify allowed management, denied access, analytics, and alert logs.
- [ ] **Emergency delivery:** configure the alert provider, trigger/cancel/resolve events with a controlled contact, confirm delivery status, and test timeout/offline/duplicate-event behavior.
- [ ] **Pose readiness:** capture real frames and validate full-body, lighting, and distance UI against actual provider responses; test malformed responses and unavailable service.

## P2 — Physical-device and camera gates

- [ ] **Exercise the Expo Go shell on Android and iOS:** QR loading, LAN/public URLs, connection recovery, front/rear camera, denied permissions, location, accelerometer, audible alarm, app interruption/locking, and return to the session. JavaScript export is not native/device verification.
- [ ] **If automatic rep counting is in scope, explicitly reactivate it only after verification.** v2.7.3 deliberately hides its frontend entry points; shared counter, worker, native bridge, and backend result support remain in source. This is an optional product decision, not a regression to undo automatically. Evidence: [camera guide](CAMERA_TRACKING.md), [release notes](RELEASE-v2.7.3.md).
- [ ] **Before enabling native rep counting, compile/install Android and iOS development builds.** Verify permissions, bridge request/frame isolation, camera switching, pause/review/correct, and interruption recovery on physical devices.
- [ ] **Before claiming camera accuracy, benchmark real squat/curl sets.** Compare counts with manual observation across users, framing, lighting, occlusion, and orientation; measure a 15-minute session's timing, memory, heat, and battery.
- [ ] **Verify corrected camera reps through the real API/database.** Reload the same account and confirm saved `exerciseResults` and report output. Synthetic counter/browser tests do not prove this path.

## P3 — Make release and maintenance repeatable

- [ ] **Expand genuine integration coverage.** The backend e2e suite currently tests only `GET /` and can skip without database environment variables. Browser suites mock API responses, and several frontend tests inspect source text. Add isolated frontend-to-API-to-database journeys for auth, workout results, nutrition, permissions/ownership, and safety state.
- [ ] **Add a CI verification gate.** No CI workflow was found in this folder. Run builds, supported lint, meaningful tests, mobile types, and selected browser checks on changes; ensure required database tests cannot silently skip in the integration job.
- [ ] **Investigate the browser test runner hang.** This audit's Edge run reached all ten test entries without emitting a failure, but never produced a completion summary. Establish whether test completion, browser shutdown, or production-server teardown is blocked; require a clean exit before treating this suite as passing.
- [ ] **Document and reproduce deployment of all required services:** frontend, account API, standalone catalog service, MongoDB, and optional providers. Include HTTPS, explicit production origins, public service URLs, secrets setup, and restart behavior. Run the full smoke checklist after deploying.
- [ ] **Add operational health/readiness and recovery checks.** The basic account endpoint returns “Hello World!” and Coach status is not proof of upstream reachability. Define probes, provider failure visibility, alerting, database backup/restore verification, and rollback steps for the chosen hosting setup.
- [ ] **Review exposed provider usage limits.** The standalone catalog/preview API is unauthenticated and calls a rate-limited upstream. Define deployment throttling and request budgets so public usage cannot exhaust access needed by account program generation. Existing provider pacing/deduplication is useful but is not a deployment admission policy.
- [ ] **Decide account-data retention and deletion behavior.** Logout intentionally keeps the profile cache, and no complete account-deletion UI/API was found. For release, define cache clearing on shared devices, account deletion/export requirements, and removal/retention of health, meal, location, workout, and recovery records. These are product/release decisions, not verified compliance findings.
- [ ] **Audit dependencies and pin the supported runtime.** No fresh vulnerability audit was run. Installed Next.js requires Node >=20.9.0 and NestJS core requires Node >=20, contradicting RUNNING.md's “Node v18 or higher” guidance. Establish the full Node/Expo toolchain requirements, add a runtime pin, and update setup instructions; assess upgrades without forced incompatible Expo changes.
- [ ] **Reconcile documentation.** Current update: startup and Render configuration now use the shared main API on port 4000; the separate port-4050 service has been removed (see COMBINED_API.md). Correct older claims that the public library uses seeded records or automatic tracking is reachable. Keep current status distinct from historical release evidence and refresh checklist totals only when the corresponding criterion is demonstrated.
- [ ] **Resolve external-data release requirements.** The repository documents ExerciseDB's free access as non-commercial/personal/educational and requiring attribution. Confirm the intended release fits the provider arrangement, or secure suitable access before a commercial release. This audit did not independently verify current provider terms.

## Suggested execution order

1. Fix password recovery and session invalidation.
2. Finish multi-exercise manual workouts, persistence/recovery, and safety settings.
3. Fix lint, analytics, catalog administration labels, sharing, and upload limits.
4. Establish a staging integration suite and close the account-data verification items.
5. Verify provider delivery and physical-device behavior; enable optional tracking only when its gates pass.
6. Add CI, deployment/operations checks, and updated release documentation.
