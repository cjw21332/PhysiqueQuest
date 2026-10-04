# Expo Go End-to-End Reliability Design

**Status:** Approved for specification review  
**Scope:** Existing PhysiqueQuest Expo Go app and its frontend/backend services

## Goal

Make the app already present in this system usable through Expo Go from initial connection through authenticated, persistent feature flows. Expo Go remains a native WebView shell for the Next.js frontend. The NestJS API and MongoDB remain responsible for authenticated data and persistence. A visible action must complete, report a recoverable error, or clearly identify a missing external service; it must not silently claim success for an in-memory or sample operation.

## Existing system and constraints

- `mobile/` hosts the Next.js app in `react-native-webview` and currently infers the frontend address from Expo's host URI or accepts a manually entered address.
- `frontend/lib/api.ts` derives the API URL from the loaded page hostname on port 4000 unless `NEXT_PUBLIC_API_URL` is supplied.
- `backend/` serves the API on port 4000 and allows the configured frontend origin plus private LAN development origins on port 3000.
- Authentication and profile data use the backend. Nutrition, settings, activity, and notifications already have a mix of APIs and client hooks in the current checkout; these must be audited and completed rather than duplicated.
- Workout, quest, progress, sample notification, password-recovery, admin, and camera/pose flows have local, sample, or incomplete behavior. Their exact current implementation must be verified before changing it.
- The working tree already contains extensive staged changes across backend, scanner, and frontend files. Implementation must preserve and build on these changes; it must not reset or replace them.
- Do not add dependencies without approval, do not change the monorepo structure or required ports, and retain compatibility with the current Expo Go runtime. Do not introduce native UI screens.

## Architecture

### Expo connection and diagnostics

Keep Expo Go as a WebView wrapper. Make the frontend URL and corresponding API URL explicit and consistent for LAN use, remove reliance on stale private-IP assumptions, and keep the current manual connection recovery path. Provide actionable connection diagnostics for frontend reachability, backend reachability, and required device permissions. A tunnel URL for the Expo JavaScript bundle must not be mistaken for the computer's API host. Preserve safe-area injection and WebView navigation behavior.

### Frontend API boundary

Use a shared typed API client for all server-backed data. Authenticated requests attach the existing session token. Screens and hooks own loading, empty, success, and error states; server data is authoritative after writes. Local storage may cache session/profile data for startup continuity, but must not be the authoritative store for user activity. Failed writes must not be presented as saved.

### Backend services and persistence

Keep NestJS validation, authentication, and user scoping on every private endpoint. Use MongoDB records associated with the authenticated user. Reuse existing services and schemas where their contracts fit. Add or revise narrowly scoped APIs for durable workout sessions, quest state/rewards, progress measurements/history, notification records, and any missing settings or nutrition operations. Admin operations require an explicit backend role guard and must not be exposed based on frontend-only checks.

### Feature ownership

| Feature | Authoritative source | Required behavior |
| --- | --- | --- |
| Registration, login, profile | Existing auth/profile API | Persist and reload the account/profile; show backend/network errors |
| Nutrition, meal log, water, scan | Existing nutrition/food-scan APIs where contracts fit | Search/add/edit/delete meals, persist water by date, save scan results, and reload history |
| Preferences and safety settings | Existing settings API | Load and persist every setting; distinguish unavailable delivery/monitoring services from saved preferences |
| Workouts and coach sessions | User-scoped activity/session API | Persist start, pause/resume state as appropriate, completion duration, and report data; no sample-only successful completion |
| Quests, streaks, points, badges | User-scoped activity/quest data | Persist progress and rewards; derive displayed state from server responses |
| Progress and goals | Profile plus dated progress history API | Persist measurements and render history from real records; label empty history honestly |
| Notifications | User-scoped notification API | Load real records and persist individual and bulk read state; remove hard-coded safety events |
| Admin exercise/analytics tools | Admin-only backend APIs | Enforce roles server-side; ordinary users cannot view or mutate admin data |
| Password recovery | Backend recovery API plus email delivery provider | Implement verification/reset contracts; return a clear configuration/service error if delivery is not configured |
| Emergency alert delivery | Backend alert orchestration plus a configured delivery provider | Do not claim an alert was sent until the provider confirms it |
| Camera pose analysis | Expo Go-compatible capture/upload plus configured analysis service | Request camera access through the current wrapper and report unavailable analysis accurately; do not fake live tracking |

### External service boundary

Email, SMS/push alert delivery, and pose analysis require provider credentials or services not evident in the current repo. Build explicit provider interfaces and truthful UI/error handling. Do not hard-code secrets in Expo or frontend builds. Until credentials are available, affected actions must identify setup requirements and must not report a successful send or analysis. Provider-backed end-to-end success cannot be verified without configured test credentials.

## User-visible behavior

- Every visible button and navigation action has an implemented response or a clear disabled/unavailable state.
- API-backed controls show progress while requests run, prevent duplicate submissions where appropriate, and present retryable errors without losing user input.
- Empty collections have intentional empty states, not fabricated sample records.
- Back navigation and Expo/system back behavior keep users in a valid screen; camera permission denial and disconnected frontend/backend each have a recovery path.
- No feature reports persistence until the backend confirms the write.

## Verification and acceptance

1. Expo config validation, TypeScript checking, and Android/iOS JavaScript bundle export succeed using installed workspace dependencies.
2. Frontend and backend production builds succeed; backend and frontend API-contract tests pass.
3. Backend integration checks cover authentication, authorization, validation, ownership isolation, persistence/reload, and configured/unconfigured provider behavior for every added or changed service.
4. A physical device on the current Expo Go-compatible workflow can load the frontend from the computer, reach the API on port 4000, complete registration/login, and complete representative create/read/update/delete flows with data surviving a reload.
5. Every existing visible control is inventoried and checked for response, persistence where applicable, and loading/error/empty states. Admin controls reject non-admin users at the API.
6. Device-only checks must be reported separately from bundle/API verification if the current connected device cannot be exercised in this environment.

## Delivery sequence

1. Audit and stabilize Expo URL selection, API host derivation, CORS, reachability feedback, and current device permissions.
2. Map every visible screen action to an existing API contract or a required backend operation; document contract mismatches before altering them.
3. Complete persistence and typed frontend hooks feature by feature, beginning with existing nutrition/settings/activity/notification APIs, then workouts/quests/progress.
4. Add backend authorization and truthful configuration states for admin, password recovery, alert delivery, and camera analysis.
5. Verify builds, contracts, app flows, and Expo Go device reachability; update run/setup documentation with exact required server addresses and provider configuration.

## Out of scope

- Replacing the WebView shell with native screens or requiring a custom Expo development build.
- Claiming physical device or third-party provider verification when those systems are unavailable.
- Adding unapproved dependencies, changing required ports, or rewriting unrelated visual design.
