> Current architecture update, October 18, 2026: library browsing and Coach preview routes now share the main API on port 4000. The separate port-4050 service has been removed. Older independent-service entries below are historical; see [combined API](COMBINED_API.md).

# PhysiqueQuest — Frontend, Backend, and End-to-End Checklist

> **Audit date:** October 15, 2026
>
> **Current release:** `PhysiqueQuest-v2.7.3`, prepared on October 15, 2026
>
> **Previous release:** `PhysiqueQuest-v2.7.2` (`574f4f9`)
>
> **Historical release baseline:** `PhysiqueQuest-v2.5.2` (`37c4309`)
> **Scope:** Frontend UI/API wiring, backend services, and proven frontend → API → persisted-user-data workflows.

This checklist separates what is implemented in the frontend, what is implemented and tested in the backend, and what has actually been demonstrated as a complete user journey using genuine account data.

### Current Coach / ExerciseDB V1 verification — October 15, 2026

Latest persistence update: the Coach screen now reads authenticated `GET /api/coach/plan` on the main backend. Per-user versions are stored in `coach_programs` with daily exercise IDs, order and prescriptions; unchanged preferences reuse them across reloads and process restarts without ExerciseDB calls. Goal, days, equipment, duration and health changes select a new version. Catalog/detail/GIF browsing remains independent on port 4050. This supersedes earlier descriptions of the screen calling the stateless provider planner directly.

- [✅] Actual existing account program saved in MongoDB; browser reload rendered identical daily exercises. A new service instance restored the same snapshot with its provider deliberately unavailable, making zero provider calls. The saved user program is retained as requested.
- [✅] Persistence tests cover user isolation, concurrent loads, changed preferences, equivalent legacy weekdays, provider outages and empty generations. Frontend/mobile tests: 120/120; browser tests: 10/10; both production builds pass.

This entry supersedes earlier Coach/catalog source and camera-entry descriptions. Coach and the exercise library now use the free live ExerciseDB V1 API, with no subscription/key and no seeded catalog fallback. V1 has approximately 1,500 exercises; the earlier V2 11,000-exercise/video proposal is not implemented. Demonstrations use real animated GIFs. The independent Coach service runs on port 4050 without MongoDB or other feature modules. Account profile and workout storage remain on the account API.

- [✅] Backend suite: 309/309 tests across 41 files; backend and frontend production builds pass.
- [✅] Saved legacy training days (`M, T, W, T, F` and indexed IDs) are accepted by the independent Coach service and normalized to full weekdays; invalid and duplicate canonical days remain rejected. Regression tests cover both legacy formats. Live browser verification against the existing saved profile returned HTTP 201, five weekday sessions and eight rendered Monday exercises, without changing profile or workout records.
- [✅] Frontend/mobile Node tests: 120/120, including independent service addressing and protection against stale program responses.
- [✅] Browser suite: 10/10 using Microsoft Edge, including library/detail errors, GIF controls, responsive layout, Coach rendering, hidden beta/deep links, and library access during account-service failure. Test fixtures cover error/interaction cases; live evidence is recorded separately below.
- [✅] Live provider browsing: all six body categories and all seven equipment categories return at least 12 exercises. Resistance bands has 78 selected matches, Kettlebell 46; larger categories use a bounded 100-record selection. Cardio returns 12 of 33. Counts describe the provider selection, not exhaustive category totals or measured popularity.
- [✅] Live specific search: “barbell bench press” returns three matching names with all query words, without unrelated suggestions.
- [✅] Live detail: six provider instruction steps and a real GIF load successfully; rendered frames change while playing and remain stable while paused. Fresh details and retry are supported.
- [✅] Genuine profile → independent provider program → account workout persistence: a dedicated temporary account loaded its saved profile, rendered ExerciseDB recommendations, and saved six matching provider exercise IDs in MongoDB. Temporary records were removed after verification. This does not certify physical camera counting or production deployment.
- [✅] Camera rep counting beta controls and automatic tracking deep links are removed from frontend entry points; backend, shared counter and native/worker capability files are retained.
- [✅] Library/list/detail follow the supplied reference layout, using actual metadata, descriptions and form cues. Manual tracking labels reflect the available capability; no fabricated AI assessments, difficulty, weights or MP4 durations.

Live screenshots: [library](../artifacts/exercisedb/library-390.png), [exercise detail](../artifacts/exercisedb/library-detail-390.png), [Coach](../artifacts/exercisedb/coach-390.png). Setup and provider restrictions: [AI Coach](AI_COACH.md). Free-provider rate limits remain visible as recoverable errors; commercial use requires appropriate provider access.

### Version 2.7.2 verification — October 15, 2026

The complete remote branch was fetched and checked out; the local release commit matches origin. Compared with v2.7.0, this release adds shared on-device rep counting for bodyweight squats and standing biceps curls, browser worker/model assets, a native pose-camera bridge, camera setup guidance, pause/resume, count review/correction, and workout completion with `exerciseResults`. Ordinary mobile launch commands explicitly target Expo Go; native tracking uses a development build. See [release notes](RELEASE-v2.7.2.md) and [camera tracking setup](CAMERA_TRACKING.md).

| Current-release check | Result | Evidence boundary |
|---|---|---|
| All frontend/mobile Node tests | Passed: 118/118 | Includes six synthetic rep-counter tests and two Expo-launch tests; no physical camera accuracy evidence. |
| Backend service suite | Passed: 35 files, 275/275 tests | Service/validation coverage, including mocked model/provider boundaries. |
| Backend application smoke suite | Passed: 1/1 | Boots AppModule and verifies `GET /`; does not exercise frontend account actions or saved workout reps. |
| Frontend production build | Passed | Compilation, TypeScript, and static route generation. |
| Backend production build | Passed | Backend compilation. |
| Mobile TypeScript check | Passed | Native wrapper source type correctness. |
| Expo Android/iOS export | Passed: Android 1,398 modules; iOS 1,397 modules | Both bundles include the pose model asset; bundling does not prove native compilation or physical-device behavior. |
| Browser tracking suite | Passed: 2/2 using installed Microsoft Edge | Real local model inference with synthetic camera, pause/resume, review/correct/save via mocked workout API, and simulated phone bridge rejecting stale request frames. The default Chrome executable was absent; the documented executable override was used. |

Current-release camera verification checklist (supplemental; excluded from the existing module/criterion totals):

- [✅] Synthetic squat/curl cycles, partial motion, jitter, missing/uncertain/offscreen/stale joints, out-of-order frames, resets, and aspect-ratio handling pass shared-counter tests.
- [✅] Browser worker loads the bundled model and processes synthetic camera frames; pause/review release capture, and corrected reps reach the workout completion request without camera-frame payloads.
- [✅] Simulated native bridge uses the shared counter, rejects old camera request frames, and preserves completed counts on pause.
- [✅] Expo Go launch resolves explicitly to Go and skips custom native pose-module loading during startup; development tracking has its own command.
- [✅] Android and iOS production JavaScript/assets export successfully with the bundled Lite pose model.
- [❌] Compile/install native Android and iOS development builds and validate real camera permissions, bridge behavior, interruption recovery, and front/rear cameras on physical devices.
- [❌] Compare prototype squat/curl counts with manually counted real sets across lighting, occlusion, orientations, and users; measure 15-minute timing, memory, heat, and battery against preview-only operation.
- [❌] Save corrected camera reps through the frontend to a running backend/database, reload the same account's workout, and confirm persisted `exerciseResults` and report values.

Camera rep counts are prototype motion counts, not provider-backed form scores or validated calorie estimates. No new genuine frontend-to-database workflow was demonstrated, so the existing module/criterion totals remain unchanged. Earlier dated verification records below are retained as historical evidence.

### Coach reference layout and program suggestions — October 15, 2026

- Coach uses the supplied reference's white layout, compact typography, weekday buttons, numbered exercise rows, quiet tracking pills, lightbulb tip, book library link and fixed green Start session action above bottom navigation. The operating-system status bar/phone frame are not duplicated. Reference example loads and tracking labels are not substituted for account data.
- Backend suggestions match the selected goal's push/lower/pull/full-body focus, use available equipment and existing health exclusions, prioritize varied movements, and return individual rep/hold prescriptions, equipment summaries and a catalog-sourced form tip. Keyword boundaries prevent “lat” from incorrectly selecting lateral raises for pull sessions. Core-focused programs retain distinct core exercises. Limited catalog coverage is stated rather than filled with unrelated items. Week labels derive from the saved profile's creation date when present.
- The saved product catalog now contains twenty exercises covering dumbbells, bodyweight and resistance bands. The explicit import preserves existing records and adds missing names. No placeholder media, example loads or invented tracking scores are supplied. The current Coach planner is a backend rule engine; this update does not claim language-model-generated programs or validated medical suitability.
- Start session now carries the selected day's real catalog IDs through camera setup into the saved workout, replacing the old `exercise-1` identifiers and fixed sample session exercise. The camera rep-counting beta remains reachable in the Exercise library, with its direct tracking link preserved.
- Live verification used a dedicated temporary account and persisted profile on the configured MongoDB. The running localhost:3000 frontend called localhost:4000 without intercepted/mocked responses, displayed the profile-specific program, and created a persisted workout containing the same six selected catalog IDs. Test account/profile/workout records were removed afterward. Screenshots reviewed at 320×568, 390×844, 768×1024 and 1440×900 confirm visible start/navigation controls and no horizontal overflow. See [phone view](../artifacts/coach/coach-390.png) and [scrolled view](../artifacts/coach/coach-scrolled.png).
- Verification passed: 118/118 frontend/mobile tests, 283/283 backend tests across 37 files, seven browser integration/tracking tests, and frontend/backend production builds. Browser suites use HTTP fixtures; the separate live run described above used genuine persisted test data. The Coach/catalog joint criterion is now verified locally; hosting/device/provider checks remain separate.

### Exercise library backend activation — October 15, 2026

- Coach and `/exercises` now share the API-backed catalog, with debounced search, muscle/equipment filters, pagination, loading, retry, genuine empty states, backend instructions, and configured picture/video rendering. Obsolete requests cannot replace the latest filter results. The six-row Coach sample is no longer used.
- Me's Exercise library uses protected admin APIs instead of preview mode. Create persists muscle/equipment along with publication state. Published manual exercises are visible without pose models; draft detail access is excluded. Searches escape regex characters, and singular/plural equipment names match consistently. Analytics preview is outside this change.
- The configured MongoDB catalog was initially empty. The explicit `npm run seed` command now targets the API's `admin_exercises` collection and imports eight product catalog entries using insert-only upserts. Existing records are preserved, no records are deleted, and unrelated demo videos/unsupported AI labels are omitted. This is saved product content, not a frontend fallback.
- Live check: a temporary database-backed test account served real authenticated catalog requests to the frontend browser. Eight persisted exercises loaded; instructions, muscle filtering, search, and reload passed. After the isolated-backend check, the same journey passed directly from the running frontend on localhost:3000 to the running API on localhost:4000 without mocked/intercepted requests, verifying local HTTP/CORS behavior. The temporary account was removed afterward. Production hosting, user-specific coach-plan verification and deployed administrator CRUD remain pending.
- Automated verification: 118/118 frontend/mobile tests, 279/279 backend tests, six browser integration/tracking tests, and frontend/backend builds passed. The browser admin create/denial checks use mocked HTTP responses; the separate catalog run used the running backend and MongoDB. Frontend criteria increase to 31/34; fully checked frontend modules remain 14/17 because analytics remains a preview. Backend and genuine user-data end-to-end totals are unchanged.

### Post-baseline implementation update — October 13, 2026

- **Notifications presentation:** The Home Notifications screen shows the screenshot-matched sample preview (pinned safety notice, Today and Earlier groups) only after the API successfully returns no records. It labels this data as a sample, keeps sample read actions local, and does not display it over loading or API errors. Non-empty API results remain authoritative.
- **Verification:** Frontend production build passed and all frontend tests passed (67/67). These checks cover the sample fallback and interactions but do not verify a live notification round trip. Earlier backend test/build results do not validate this frontend change.
- **Checklist impact:** Notifications frontend/API wiring stays marked implemented; the joint notification workflow remains unchecked until real notification records and persisted read-state changes are verified using a safe live test account. Sample preview behavior is not end-to-end evidence.
- **Sign-in event index:** Removed the duplicate `occurredAt` index declaration from the Mongoose property metadata while retaining the explicit query index. A schema regression test verifies that the single-field index is declared once.

### Exercise Library presentation update — October 14, 2026

- Coach Exercise Library now uses the explicitly requested local sample catalog: six reference exercises, working search/muscle/equipment filters, retained bottom navigation, and a white detail sheet with the supplied bench-press image, instructions, recommendations, and form cues. Video playback and AI tracking are explicitly unavailable; sample actions never save workout data.
- The public `/exercises` route and administrator library retain their API integrations. This Coach preview is intentionally independent of their requests, not an error fallback.
- Verification: 70/70 frontend tests passed, production build passed, and local browser checks covered search, empty/reset states, media notice, close/Escape/focus restoration, and responsive layouts at 320×568, 390×844, 768×1024, and 1440×900. A rendered regression test confirms the sample library link remains reachable while the weekly plan loads or fails. The temporary preview route was removed before delivery. No device/provider or live database workflow was verified; checklist status totals are unchanged.

### Scan presentation update — October 14, 2026

- Nutrition, Review Estimate, Today’s Log, Add Food, and Food History follow the supplied reference screens, including connected navigation, portion controls, confidence guidance, shared totals, water glasses, and history records. The existing API client, nutrition hook, and backend implementation remain the live-data path.
- The requested sample preview appears only after a successful response containing no meals and no recorded water. Its manual/scan saves and water updates stay in section memory; real uploaded photos still request backend analysis, and API failures never become sample scan results. The photo chooser offers a separate, explicit sample estimate.
- Verification: 74/74 frontend tests and the production build passed. A temporary local test service exercised the actual Scan controller, including food search/detail, manual save, water update, upload/analysis, selected scan-item save, sample isolation, and visible nutrition/scan failures. Responsive browser checks covered phone, short phone, tablet, desktop, and landscape widths. The temporary route/service were removed or stopped before delivery.
- These are frontend and simulated API-integration checks, not evidence of a deployed microservice, real provider, database persistence, or physical-device verification. Checklist completion marks and summary totals remain unchanged.

## How to interpret the marks

**v2.7.0 branch preparation — October 14, 2026:** Created the user-requested `PhysiqueQuest-v2.7.0` branch for the complete current project snapshot. Frontend and mobile tests passed together (110 tests), the backend suite passed, and frontend/backend production builds passed. Root Expo device-cache files are now ignored alongside the existing mobile cache, build outputs, dependencies, and environment files. Publishing this snapshot does not establish deployment, provider, database, or physical-device verification; checklist completion totals are unchanged.

**Me mock-link visibility fix — October 14, 2026:** Removed the frontend administrator-role condition from the two explicit mock links. Exercise Library and Engagement analytics now appear under Admin tools, directly after Change password and before Log out, for all signed-in users. No backend authorization was changed. All 88 frontend tests and the production build passed; regression assertions verify both links and their order. Checklist completion totals are unchanged.

**Me admin mock presentation — October 14, 2026:** Exercise Library, New exercise, and Engagement analytics now match the requested reference layouts and intentionally show labeled local fixtures from the Me entry points. Search/filter/create/cancel, analytics ranges, and CSV output work locally; mock actions never contact the admin API. Default API modes and existing backend contracts remain available, and denied API calls never become mock results. Account & Settings remains API-backed; sample-profile mode and the unrequested manual alert/alert-log controls were removed. All 88 frontend tests and the production build passed; fixture-based browser layout checks covered 320×568, 390×844, and 1440×900. Live provider/database and physical-device checks were not performed. The two admin frontend API-integration criteria are now pending activation because the Me entry points intentionally use mock mode; backend and end-to-end counts are unchanged.

**Me reference presentation — October 14, 2026:** Account & Settings, Personal Data, Goals, Training Preference, Health Profile, and Emergency Contact use the supplied reference layout and shared form theme. Summary labels derive from saved profile/settings values, account level reads the existing activity endpoint, and profile edits retain the existing update API/cache refresh flow. Editors return only after confirmed saves; error states stay visible. Measurement units/BMI, weekday labels, rounded switches/checks, reference artwork, footer positioning, and icon treatments were reviewed. All 85 frontend tests and the production build passed. Browser checks of rendered components at 320×568, 390×844, and 1440×900 found no horizontal overflow and visible save footers. These fixture-based checks do not prove live database or physical-device round trips; checklist totals remain unchanged.

**Scan calorie progress consistency — October 14, 2026:** The Scan overview now reuses the same CalorieProgress component and summary-column styling as Today's Log, matching Home Nutrition today's ring, colors, sizing, and compact calorie text. Existing nutrition totals and API paths are retained. All 82 frontend tests and the production build passed; completion totals remain unchanged.

**Meal food search and shared calorie progress — October 14, 2026:** Edit Meal searches matching USDA food names through the existing authenticated backend endpoint, keeping the provider key server-side. Suggestions are debounced, discard obsolete responses, and support loading/empty/error retry. Selection updates the food name and USDA reference while preserving editable nutrition values. Home Nutrition today and Today's Log now share the same calorie-progress component and styles. All 82 frontend tests and the production build passed; USDA provider availability and physical-device behavior were not verified. Checklist totals are unchanged.

**Today's Log editing update — October 14, 2026:** Logged rows display Scanned or Manual, edited status, and the original device-local logging time; empty categories show "No logged yet". Tapping a logged row opens a Scan-themed food editor, with individual selection for multi-food meals, validation, cancel, and save-error retry. Account edits use the existing nutrition update endpoint; the server persists the edited flag and retains the original source/time/date. Sample edits stay local. All 80 frontend tests and 275 backend tests passed; both production builds passed. No live database or physical-device workflow was verified, and checklist status totals remain unchanged.

**Nested-page navigation update — October 14, 2026:** Back icons precede page titles in markup and visual order throughout the nested Home, Coach, Scan, Quests, and Me screens. Exercise Library, Review Estimate, Food History, Add Food, and Today's Log headers were corrected; existing parent callbacks and trailing actions are retained. Header regression checks cover 15 page/shared-layout components. All 76 frontend tests and the production build passed. Checklist completion totals are unchanged; these checks do not establish physical-device or live-service behavior.

**Mobile entry verification — October 14, 2026:** Expo's Android resolver now selects `mobile/index.ts` from both the repository root and mobile workspace instead of the default entry that expected a root `App`. All 22 mobile tests passed, and an Android export from the root successfully bundled 651 modules. This verifies entry resolution and bundling; physical Expo/device and live backend checks remain unverified, so checklist totals are unchanged.

- **`[✅]` Verified for this layer:** the specific criterion below has supporting source and test/build evidence.
- **`[❌]` Incomplete or unverified:** the reason and next verification step are stated on that item. It does not always mean the feature is broken; it means the criterion has not been demonstrated.
- A check in the **Frontend** column means the UI/function is wired to the API client where it uses user data, and does not depend on hardcoded sample-user records. It does **not** by itself prove the server is running or the deployment is configured.
- A check in the **Backend** column means the corresponding service/API behavior exists and is covered by automated backend tests. Unit tests may use mocked models; that is not evidence of a live database transaction.
- **Only a check in the End-to-end section means complete frontend-to-backend behavior was demonstrated with genuine user data.** A checked frontend or backend item must not be described as a fully completed system flow by itself.
- Static product content such as exercise descriptions, nutrition targets, and UI copy is not user-record mock data. Test fixtures are allowed in tests; they do not establish that production user records are live.
- Dates appear only when a dated implementation or verification record exists. Pending live checks have no estimated completion date.

## Status at a glance

### Frontend implementation coverage

- **Modules with all frontend criteria checked:** 14 / 17 (**82.4%**, rounded **82%**)
- **Frontend criteria checked:** 31 / 34 (**91.2%**, rounded **91%**)

<progress value="14" max="17" aria-label="14 of 17 modules meet frontend implementation criteria">14 of 17 frontend modules (82%)</progress>
<progress value="31" max="34" aria-label="31 of 34 frontend criteria verified">31 of 34 frontend criteria (91%)</progress>

### Backend implementation and automated-test coverage

- **Applicable modules with all backend criteria checked:** 11 / 16 (**68.8%**, rounded **69%**); 1 system module is not applicable to the backend.
- **Backend criteria checked:** 27 / 32 (**84.4%**, rounded **84%**)

<progress value="11" max="16" aria-label="11 of 16 applicable backend modules meet backend implementation criteria">11 of 16 applicable backend modules (69%)</progress>
<progress value="27" max="32" aria-label="27 of 32 applicable backend criteria verified">27 of 32 applicable backend criteria (84%)</progress>

### Genuine end-to-end user-data verification

- **Modules with a documented real-user-data flow:** 3 / 17 (**17.6%**, rounded **18%**)
- **End-to-end workflows documented as verified:** 3 / 21 (**14.3%**, rounded **14%**)
- Authentication and profile checks retain the historical registration → login → profile creation/update/read evidence in Progress Report 13 (October 3, 2026). Coach/catalog has fresh local frontend → API → MongoDB evidence from October 15, 2026, including starting a workout with the returned program IDs. These dates do not imply production hosting was re-tested.
- These counts represent modules with a documented workflow. Coach/catalog's single joint criterion is verified locally; authentication and profile still have separate unchecked workflows. Other modules retain their outstanding criteria.
- Every other joint workflow is marked ❌ because this audit did not run it against a safe, live backend and database using a real test account.

<progress value="3" max="17" aria-label="3 of 17 modules have documented genuine end-to-end verification">3 of 17 end-to-end modules (18%)</progress>
<progress value="3" max="21" aria-label="3 of 21 genuine user-data workflows documented as verified">3 of 21 end-to-end workflows (14%)</progress>

The progress bars are native HTML progress indicators. They are audit snapshots; change their values, the text totals, and the relevant checklist marks together when new verification is performed.

## Quick navigation

| # | Module | Frontend | Backend | Genuine end-to-end |
|---:|---|---|---|---|
| 1 | [Authentication and session](#1-authentication-and-session) | Partial | Verified | Verified historically |
| 2 | [Password recovery](#2-password-recovery) | Verified | Partial | Not verified |
| 3 | [Onboarding and profile](#3-onboarding-and-profile) | Verified | Verified | Verified historically |
| 4 | [Home dashboard and navigation](#4-home-dashboard-and-navigation) | Verified | Verified | Not verified |
| 5 | [Coach plan and exercise library](#5-coach-plan-and-exercise-library) | Verified | Verified | Verified locally October 15 |
| 6 | [Camera Check and pose readiness](#6-camera-check-and-pose-readiness) | Verified | Partial | Not verified |
| 7 | [Workout session and report](#7-workout-session-and-report) | Partial | Partial | Not verified |
| 8 | [Inactivity and emergency safety](#8-inactivity-and-emergency-safety) | Verified | Partial | Not verified |
| 9 | [Meal scanning and food search](#9-meal-scanning-and-food-search) | Verified | Partial | Not verified |
| 10 | [Nutrition log, water, and history](#10-nutrition-log-water-and-history) | Verified | Verified | Not verified |
| 11 | [Quests, streaks, and leaderboard](#11-quests-streaks-and-leaderboard) | Verified | Verified | Not verified |
| 12 | [Progress measurements](#12-progress-measurements) | Verified | Verified | Not verified |
| 13 | [Me, settings, and preferences](#13-me-settings-and-preferences) | Verified | Verified | Not verified |
| 14 | [Notifications](#14-notifications) | Verified | Verified | Not verified |
| 15 | [Administrator tools](#15-administrator-tools) | Partial: catalog API, analytics preview | Verified | Not verified |
| 16 | [Expo Go mobile shell](#16-expo-go-mobile-shell) | Verified | Not applicable | Not verified |
| 17 | [API and data-service reliability](#17-api-and-data-service-reliability) | Verified | Verified | Not verified |

---

## A. Frontend checklist

**Frontend verification rule:** a capability is checked when the UI flow is present, user-specific data is loaded/saved through the API client rather than filled with sample user records, and the frontend test/build evidence covers the relevant behavior. Provider execution and hardware behavior are tracked separately.

### 1. Authentication and session

- [✅] Registration form, password checks, consent, duplicate-account result, and account-creation request are implemented.
- [❌] Login/session end-to-end behavior is not re-tested against a live backend in this audit; the API client and source tests exist, but require a safe-account runtime check.

### 2. Password recovery

- [✅] Forgot-password UI requests, verifies, and confirms reset through backend API calls and visibly handles unavailable email delivery.
- [✅] Code entry, paste/navigation, password confirmation, resend state, and error paths have frontend coverage; actual email delivery belongs to provider/live verification.

### 3. Onboarding and profile

- [✅] Calibration captures and validates the profile fields, preferences, health notes, and emergency contact.
- [✅] Profile loading and updates use the authenticated profile API; failed loads/saves are surfaced rather than replaced with sample profile values.

### 4. Home dashboard and navigation

- [✅] Dashboard cards read profile, activity, meal, and progress data from app hooks backed by the API.
- [✅] Main tab navigation and dashboard actions open the implemented feature routes.

### 5. Coach plan and exercise library

- [✅] Coach and `/exercises` share the backend catalog: search, filters, pagination, instructions and configured media come from authenticated exercise API responses. Backend failures offer retry and never become sample records. A live browser/backend/MongoDB catalog read and reload passed on October 15, 2026.
- [✅] The authenticated coach-plan API builds a weekly plan from the user's saved profile, equipment, duration, goal, schedule and health conditions; the reference UI renders server exercises, individual prescriptions, form tips and equipment summaries. Starting a session saves the returned day's real exercise IDs.

### 6. Camera Check and pose readiness

- [✅] Camera preview, front/rear switching, capture, and readiness submission are wired through browser or Expo camera paths and the pose API.
- [✅] Readiness values are rendered only when the API response contains recognized values; absent values display “Not assessed,” not a fabricated pass.

### 7. Workout session and report

- [✅] Start, pause, resume, and completion controls use workout API operations; the report opens only after backend completion succeeds. The v2.7.2 squat/curl prototype adds local camera counting and manual review/correction, sending reviewed reps through the existing completion API's `exerciseResults`; browser integration tests use a mocked API.
- [❌] Report sharing is unavailable in the current Expo Go flow; provider-backed form scores, calorie estimates, and personal-record analysis remain unverified. Prototype rep counting does not establish these metrics or physical-device accuracy.

### 8. Inactivity and emergency safety

- [✅] Countdown, “I'm okay,” alarm, hold-to-stop, and resolution feedback are implemented with explicit phase handling.
- [✅] Safety events and delivery status are requested from backend APIs; the Expo native sensor/camera bridge is present in source.

### 9. Meal scanning and food search

- [✅] Camera capture and photo upload enter the same API-backed scan/review flow, with loading, retry, and provider-error handling.
- [✅] Live food search, scan review, and save actions use API data. The separate, explicitly labeled sample estimate stays local and is never represented as a user's saved meal.

### 10. Nutrition log, water, and history

- [✅] Meal create/update/delete, scan-to-meal save, daily water, and history are wired through nutrition APIs.
- [✅] Live loading/errors, history, and daily totals use returned account data. The explicitly requested reference preview is limited to a successful empty meals/water response; its local changes are labeled and never persisted as account data.

### 11. Quests, streaks, and leaderboard

- [✅] Activity, mission, badge, and streak views consume activity/settings API state.
- [✅] Leaderboard selection and completion views are wired to the feature's account/activity data path.

### 12. Progress measurements

- [✅] Measurement creation, list/history, metric selection, and deletion use the progress API.
- [✅] The UI shows a real empty state when no saved measurement exists.

### 13. Me, settings, and preferences

- [✅] Me/profile data is loaded from the API; personal data, goals, contact, and training preferences save through backend calls.
- [✅] Settings and profile failures are surfaced; profile localStorage is a cache of API data, not the authoritative source.

### 14. Notifications

- [✅] Notification list, individual read-state updates, and mark-all-read use notifications API operations.
- [✅] Non-empty API results render as authoritative data; when the API successfully returns no records, the requested screenshot-matched preview is shown with an explicit sample label and local-only read actions. API failures remain visible and do not trigger the sample fallback.

### 15. Administrator tools

- [✅] Me's admin catalog/New entry uses protected backend APIs; create includes muscle/equipment and refreshes returned records. Browser tests cover returned catalog rows, create/refresh and denied access without samples. Deployment-specific admin CRUD remains in the joint checklist; analytics retains its separate preview.
- [❌] Me's analytics currently displays the requested mock figures. Backend sign-in collection and real active-user/retention analytics remain implemented; activate the API-backed screen and verify returned data before marking this frontend criterion complete.

### 16. Expo Go mobile shell

- [✅] Expo shell loads the web app and reports backend/frontend connectivity with recovery paths.
- [✅] Web-to-native camera and inactivity bridges are implemented. On October 15, 2026, the combined frontend/mobile suite passed (118/118), mobile types passed, and Android/iOS exports succeeded. Expo Go explicitly supports preview/manual counting and skips the custom pose module; automatic native rep tracking requires a development build. Native compilation and physical-device camera, sensor, accuracy, and backend behavior remain unverified.

### 17. API and data-service reliability

- [✅] Frontend API client resolves runtime/LAN base URLs, sends available auth, handles failures, and clears expired sessions.
- [✅] User-facing components expose loading/error/unavailable states for service-backed data instead of silently substituting sample user records.

---

## B. Backend checklist

**Backend verification rule:** checked items have backend implementation and automated test evidence. Unit tests that mock Mongo models verify service logic and ownership rules; they do not prove that a deployed MongoDB, provider, or email service is reachable.
Backend criteria that do not apply to a frontend/native-shell module are labeled **N/A** and excluded from the backend progress denominator.

### 1. Authentication and session

- [✅] Registration/login routes, password handling, JWT issuance, and protected current-user endpoint are implemented and covered by backend tests.
- [✅] Authenticated endpoints identify the user from the verified JWT rather than trusting a client-supplied owner ID.

### 2. Password recovery

- [✅] Recovery codes are hashed, expiring, single-use, account-neutral, and rate-limited by service logic.
- [❌] Production email delivery is not confirmed; configure `EMAIL_DELIVERY_URL` and `EMAIL_DELIVERY_API_KEY`, then verify receipt and reset on a real test account.

### 3. Onboarding and profile

- [✅] Profile create/read/update/delete and validation routes are implemented with user ownership checks.
- [✅] Partial profile updates preserve untouched fields; Progress Report 13 records a prior live database verification of profile round-trips.

### 4. Home dashboard and navigation

- [✅] Profile, activity, nutrition, progress, and notification endpoints needed by dashboard views are registered in the backend.
- [✅] User data endpoints derive ownership from the authenticated account and have service/API test coverage.

### 5. Coach plan and exercise library

- [✅] Authenticated exercise-catalog queries and role-protected exercise administration routes are implemented and tested. Published manual entries are included, drafts are excluded from catalog/details, literal searches are escaped, and equipment filters support singular/plural names. The explicit catalog import preserves existing records.
- [✅] Authenticated coach-plan service builds a scheduled plan from profile/settings and the published exercise library, filters by equipment and health conditions, and has service tests.

### 6. Camera Check and pose readiness

- [✅] Pose status and authenticated analysis endpoints validate request types, including readiness-check metadata.
- [❌] Actual analysis depends on `POSE_ANALYSIS_URL` and `POSE_ANALYSIS_API_KEY`; provider readiness response shape/availability is not verified against deployment.

### 7. Workout session and report

- [✅] Workout session create/list/pause/complete operations persist through the workout service and enforce user ownership.
- [❌] Actual form scoring, calorie estimation, and personal-record analysis require a configured pose-analysis provider and are not verified.

### 8. Inactivity and emergency safety

- [✅] Safety-event create/resolve and admin listing endpoints enforce owner/admin access; event state has automated tests.
- [❌] Contact notification delivery is not confirmed; configure `ALERT_DELIVERY_URL` and `ALERT_DELIVERY_API_KEY` and test provider-confirmed delivery.

### 9. Meal scanning and food search

- [✅] Scan/search APIs validate input, return structured errors, enforce limits/deadlines, and save matched items without zero-calorie fabricated entries.
- [❌] Live recognition/food-data execution is not verified; `GEMINI_API_KEY` and USDA service configuration must be supplied and tested with real images/queries.

### 10. Nutrition log, water, and history

- [✅] User-owned meal and water reads/writes, edit/delete behavior, and scan-import ownership are implemented and tested.
- [✅] Empty nutrition state is returned without seeding sample meals.

### 11. Quests, streaks, and leaderboard

- [✅] User activity/quest state and notification-related activity routes are implemented and tested; the authenticated leaderboard ranks users from workout, meal, and water activity.
- [✅] Mission progress is derived from saved activity rather than trusting client-submitted completion claims; leaderboard period selection, privacy opt-out, and rank movement have service tests.

### 12. Progress measurements

- [✅] Measurement create/list/delete operations validate bounds/units and scope records to the authenticated user.
- [✅] Automated tests cover ownership, empty histories, and invalid measurements.

### 13. Me, settings, and preferences

- [✅] Profile and settings APIs persist updates and return merged user-owned state.
- [✅] Validation and partial-update handling have automated coverage; the profile live test is separately identified in the joint section.

### 14. Notifications

- [✅] Notification list, mark-one, and mark-all operations are implemented as authenticated API routes.
- [✅] Backend test coverage checks the activity/notification service paths.

### 15. Administrator tools

- [✅] Admin alert, analytics, and exercise-management APIs are protected by the administrator role and have test coverage.
- [✅] Successful login and registration events are recorded for analytics; the analytics service derives active users and weekly retention and has test coverage.

### 16. Expo Go mobile shell

*N/A — the Expo shell is a frontend/native wrapper; it has no dedicated backend module. Its physical-device behavior is tracked in the frontend and joint checklists.*

### 17. API and data-service reliability

- [✅] DTO validation, JWT guards, request context, structured scanner errors, limits, and timeout paths have backend implementation/test coverage.
- [✅] Backend production build and automated backend suite pass; a passing build is not a production database/provider connectivity test.
- [✅] Backend production startup uses the compiled `dist/main.js` entrypoint; run `npm run build` then `npm run start:prod` from `backend/` (not extensionless `node dist/main`).
- [✅] Sign-in event analytics retain one `occurredAt` index declaration for time-range queries; schema tests guard against duplicate index metadata.

---

## C. Joint frontend-to-backend checklist

**Strict end-to-end rule:** check an item only with evidence that a real user action traversed the frontend, reached the running API, wrote or retrieved that user's real persisted data, and displayed the returned result. Source inspection, frontend tests with mocked responses, backend unit tests with mocked models, and a production build are not end-to-end evidence.

### 1. Authentication and session

- [✅] **Verified historically (October 3, 2026):** register → login → authenticated profile creation/update → reload and confirm the returned account data, as documented in [Progress Report 13](../ProgressReports/PROGRESS-13.md).
- [❌] Re-run the complete signup/login/session/logout path against the current safe test deployment; no fresh live run was performed for this checklist.

### 2. Password recovery

- [❌] Request an email, receive its code, verify it, change the password, and log in with the new password against a configured email provider.

### 3. Onboarding and profile

- [✅] **Verified historically (October 3, 2026):** create profile, save partial profile updates, then GET and confirm saved and untouched fields through the running backend/database; see [Progress Report 13](../ProgressReports/PROGRESS-13.md).
- [❌] Re-run calibration/profile CRUD against the current safe test deployment and verify the signed-in account sees its persisted values.

### 4. Home dashboard and navigation

- [❌] Change user-owned activity/nutrition/progress data through the API and confirm the dashboard reload reflects that same user's current persisted records.

### 5. Coach plan and exercise library

- [✅] **Verified locally (October 15, 2026):** a dedicated persisted test profile with four saved training weekdays and dumbbell equipment received the backend-generated push/lower/pull/full-body program through the running frontend/API/MongoDB path. Catalog reads, filtering/search and reload passed; selecting Monday and starting a session persisted the same six returned exercise IDs. The temporary account/profile/workout were removed. This is local deployment evidence, not production hosting or physical-device certification.

### 6. Camera Check and pose readiness

- [❌] Capture a real camera frame, receive structured readiness results from the deployed pose provider, and verify full-body, lighting, and distance values in the UI.

### 7. Workout session and report

- [❌] Start, pause/resume, complete, then reload a workout report and confirm its session values from the same user's database record.
- [❌] Verify report sharing and provider-backed form analysis; report sharing is currently unavailable and analysis is unconfigured/unverified.

### 8. Inactivity and emergency safety

- [❌] On a real phone, trigger/cancel/resolve an inactivity event and verify matching persisted event state.
- [❌] Verify actual emergency-contact delivery and delivery status using a configured provider and test contact.

### 9. Meal scanning and food search

- [❌] Submit a real meal image to configured vision/USDA providers, review returned results, save matched items, and reload the resulting user's meal log.

### 10. Nutrition log, water, and history

- [❌] Add/edit/delete real account meals, change water, and reload history from the running backend/database; automated tests alone do not prove this full deployed round-trip.

### 11. Quests, streaks, and leaderboard

- [❌] Perform qualifying account activity, persist it, reload quest/streak state, and verify the resulting leaderboard against real user records.

### 12. Progress measurements

- [❌] Create a real account measurement, reload it in history, delete it, and verify it is absent from the backend response.

### 13. Me, settings, and preferences

- [❌] Update account settings/profile in the frontend, reload the application, and verify the current user's persisted values on the running service.

### 14. Notifications

- [❌] Verify real notification records load and read-state changes persist for the same authenticated account.

### 15. Administrator tools

- [❌] Verify an actual admin account can retrieve/manage allowed records and a non-admin is denied; source/unit tests are not a deployed role-authorization check.

### 16. Expo Go mobile shell

- [❌] Exercise frontend↔API connectivity, camera switching, permissions, accelerometer, location, and alarm behavior on physical Android and iOS devices.

### 17. API and data-service reliability

- [❌] Run a safe deployment smoke test covering authentication, database connection, authorized user data, and provider configuration. Local builds/tests do not certify live deployment.

**Joint status:** 2 modules retain historical real-user-data evidence and Coach/catalog has fresh local evidence; 14 modules have no documented joint workflow verification. Unchecked means **not demonstrated here**, not necessarily a confirmed defect.

---

## Version 2.5.2 changes

Version 2.5.2 (`37c4309`) adds three API-backed capabilities:

- **Coach plans:** the authenticated coach API assembles a weekly workout schedule from the user's goal, training days, duration, equipment, health conditions, and published exercise library. The frontend loads and renders the backend response rather than creating a local sample plan.
- **Leaderboard:** a new authenticated endpoint provides weekly, monthly, and all-time rankings based on completed workouts, meal activity, and water goals. It includes rank movement/context and respects each user's leaderboard visibility setting.
- **Sign-in analytics:** successful login and registration events are recorded for the admin analytics service, which calculates active users and week-over-week retention.

Automated tests cover these code paths. These checks do not demonstrate a live deployment, provider integration, or real-user-data round trip; the corresponding end-to-end criteria below remain unchecked.

## Automated verification run for version 2.5.2

| Check | Result | What it proves (and does not prove) |
|---|---|---|
| Frontend test suite (all `frontend/tests/*.test.mjs` files) | Passed: 55/55 | Frontend source/behavior guards; some tests inspect source or use mocked responses. Not a live service run. |
| Backend Vitest suite (`npm test`, from `backend/`) | Passed: 34 files, 270/270 tests | Backend validation and service behavior; many tests mock provider/model boundaries. Not proof of production credentials or a live MongoDB round-trip. |
| Frontend production build (`npm run build`, from `frontend/`) | Passed | Compilation, types, and static route generation only. |
| Backend production build (`npm run build`, from `backend/`) | Passed | Backend compilation only. |
| Expo state/connectivity tests (`mobile/connection.test.mjs` and `mobile/inactivity/inactivity.test.mjs`) | Passed: 20/20 | Pure native state/connectivity behavior; not device hardware. |
| Expo TypeScript check (`npx tsc --noEmit --project tsconfig.json`, from `mobile/`) | Passed | Type correctness only. |
| Expo Android/iOS export | Not rerun for this v2.5.2 checklist update | Earlier export evidence is not counted as verification of this release. |

## Remaining live verification plan

Run the joint section against a **safe staging/test deployment**, not an unapproved production database. Use a dedicated test account and test emergency contact. For each unchecked item, record the run date, frontend build/deployment, API environment, test-account identifier (non-sensitive), observed persisted result, and any provider/device versions. Only then change `[❌]` to `[✅]`, update dates and all six progress elements, and revise the README summary if needed.
