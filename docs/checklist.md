# PhysiqueQuest — Frontend, Backend, and End-to-End Checklist

> **Audit date:** October 13, 2026  
> **Release baseline:** `PhysiqueQuest-v2.5.2` (`37c4309`)
> **Scope:** Frontend UI/API wiring, backend services, and proven frontend → API → persisted-user-data workflows.

This checklist separates what is implemented in the frontend, what is implemented and tested in the backend, and what has actually been demonstrated as a complete user journey using genuine account data.

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
- **Frontend criteria checked:** 30 / 34 (**88.2%**, rounded **88%**)

<progress value="14" max="17" aria-label="14 of 17 modules meet frontend implementation criteria">14 of 17 frontend modules (82%)</progress>
<progress value="30" max="34" aria-label="30 of 34 frontend criteria verified">30 of 34 frontend criteria (88%)</progress>

### Backend implementation and automated-test coverage

- **Applicable modules with all backend criteria checked:** 11 / 16 (**68.8%**, rounded **69%**); 1 system module is not applicable to the backend.
- **Backend criteria checked:** 27 / 32 (**84.4%**, rounded **84%**)

<progress value="11" max="16" aria-label="11 of 16 applicable backend modules meet backend implementation criteria">11 of 16 applicable backend modules (69%)</progress>
<progress value="27" max="32" aria-label="27 of 32 applicable backend criteria verified">27 of 32 applicable backend criteria (84%)</progress>

### Genuine end-to-end user-data verification

- **Modules with a documented real-user-data flow:** 2 / 17 (**11.8%**, rounded **12%**)
- **End-to-end workflows documented as verified:** 2 / 21 (**9.5%**, rounded **10%**)
- The two checked items are backed by the live registration → login → profile creation/update/read verification recorded in Progress Report 13 (October 3, 2026). This is dated historical evidence, not a claim that a production system was re-tested on this audit date.
- These are modules with at least one documented historical workflow, **not fully completed end-to-end modules**. Each still has an unchecked workflow, so none of the 17 modules meets the strict fully verified end-to-end completion definition yet.
- Every other joint workflow is marked ❌ because this audit did not run it against a safe, live backend and database using a real test account.

<progress value="2" max="17" aria-label="2 of 17 modules have documented genuine end-to-end verification">2 of 17 end-to-end modules (12%)</progress>
<progress value="2" max="21" aria-label="2 of 21 genuine user-data workflows documented as verified">2 of 21 end-to-end workflows (10%)</progress>

The progress bars are native HTML progress indicators. They are audit snapshots; change their values, the text totals, and the relevant checklist marks together when new verification is performed.

## Quick navigation

| # | Module | Frontend | Backend | Genuine end-to-end |
|---:|---|---|---|---|
| 1 | [Authentication and session](#1-authentication-and-session) | Partial | Verified | Verified historically |
| 2 | [Password recovery](#2-password-recovery) | Verified | Partial | Not verified |
| 3 | [Onboarding and profile](#3-onboarding-and-profile) | Verified | Verified | Verified historically |
| 4 | [Home dashboard and navigation](#4-home-dashboard-and-navigation) | Verified | Verified | Not verified |
| 5 | [Coach plan and exercise library](#5-coach-plan-and-exercise-library) | Verified | Verified | Not verified |
| 6 | [Camera Check and pose readiness](#6-camera-check-and-pose-readiness) | Verified | Partial | Not verified |
| 7 | [Workout session and report](#7-workout-session-and-report) | Partial | Partial | Not verified |
| 8 | [Inactivity and emergency safety](#8-inactivity-and-emergency-safety) | Verified | Partial | Not verified |
| 9 | [Meal scanning and food search](#9-meal-scanning-and-food-search) | Verified | Partial | Not verified |
| 10 | [Nutrition log, water, and history](#10-nutrition-log-water-and-history) | Verified | Verified | Not verified |
| 11 | [Quests, streaks, and leaderboard](#11-quests-streaks-and-leaderboard) | Verified | Verified | Not verified |
| 12 | [Progress measurements](#12-progress-measurements) | Verified | Verified | Not verified |
| 13 | [Me, settings, and preferences](#13-me-settings-and-preferences) | Verified | Verified | Not verified |
| 14 | [Notifications](#14-notifications) | Verified | Verified | Not verified |
| 15 | [Administrator tools](#15-administrator-tools) | Mock preview | Verified | Not verified |
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

- [✅] Public exercise-library search and details load through the exercise API at `/exercises`. The Coach library intentionally uses the separate, labeled local sample preview requested on October 14, 2026; connecting that preview to the future exercise service remains pending.
- [✅] The authenticated coach-plan API builds a weekly plan from the user's profile, equipment, duration, goal, schedule, and health conditions; the UI renders the returned plan.

### 6. Camera Check and pose readiness

- [✅] Camera preview, front/rear switching, capture, and readiness submission are wired through browser or Expo camera paths and the pose API.
- [✅] Readiness values are rendered only when the API response contains recognized values; absent values display “Not assessed,” not a fabricated pass.

### 7. Workout session and report

- [✅] Start, pause, resume, and completion controls use workout API operations; the report opens only after backend completion succeeds.
- [❌] Report sharing is unavailable in the current Expo Go flow; form-analysis and workout metrics remain unavailable without provider results.

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

- [❌] Me's admin catalog/New/analytics entry points intentionally use local mock data. Default component API modes and protected backend endpoints are preserved and error handling is tested, but activation and real-data UI checks are pending. The unrequested alert-log menu row was removed.
- [❌] Me's analytics currently displays the requested mock figures. Backend sign-in collection and real active-user/retention analytics remain implemented; activate the API-backed screen and verify returned data before marking this frontend criterion complete.

### 16. Expo Go mobile shell

- [✅] Expo shell loads the web app and reports backend/frontend connectivity with recovery paths.
- [✅] Web-to-native camera and inactivity bridges are implemented. Entry/state/connectivity tests passed (22/22) and Android export succeeded on October 14, 2026. These automated checks do not establish physical-device camera, sensor, or backend behavior.

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

- [✅] Public exercise-catalog queries and role-protected exercise administration routes are implemented and tested.
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

- [❌] Verify the exercise catalog and profile-specific coach plan against the current safe deployment, then confirm the returned plan reflects that user's persisted profile/settings and published library.

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

**Joint status:** 2 modules have documented historical real-user-data evidence; 15 modules do not have such evidence in this audit. Unchecked means **not demonstrated here**, not necessarily a confirmed defect.

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
