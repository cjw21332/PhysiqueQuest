# Expo Go End-to-End Data Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Expo Go application use reliable LAN/API connectivity and persist all user-facing feature data through the NestJS/MongoDB backend, with honest unavailable states for capabilities that are not implemented.

**Architecture:** Keep Expo as a WebView wrapper around Next.js. The frontend derives the API origin from the page's LAN origin, while authenticated resource hooks call user-owned NestJS endpoints backed by MongoDB. Local storage remains only for session recovery and transient UI state; server responses are the source of truth for profile, nutrition, workouts, quests, notifications, and settings.

**Tech Stack:** Expo SDK 57, React Native WebView, Next.js 16 App Router, React 19, NestJS 12, Mongoose 9, class-validator, JWT, MongoDB Atlas, Vitest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-04-expo-go-end-to-end-data-flow-design.md`

## Global Constraints

- The Expo app remains a thin WebView wrapper; do not replace it with a separate native UI.
- MongoDB Atlas remains the persistence provider.
- Local storage must not silently substitute for missing server data.
- Empty server collections render intentional empty states, never sample records.
- A 401 clears auth state and routes to launch; other failures remain visible with retry controls.
- Camera/AI capabilities without a real service must be shown as unavailable, not as successful demo output.
- Every task must add or update a focused regression test before implementation.

## Review Focus

- A phone-facing page on `http://LAN_HOST:3000` must call `http://LAN_HOST:4000/api`, never phone-localhost; test API URL derivation.
- A missing/expired token must not leave a blank authenticated screen; test 401 clearing and launch routing.
- A valid token with an empty collection must not reintroduce sample records; test empty-state data loading.
- A second request or reload must not duplicate records; test idempotent create/update behavior and client refresh.
- A backend outage must be visible and retryable without losing the current session; test resource error states.

### Task 1: API connectivity and auth/session contract

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/auth.ts`
- Modify: `frontend/hooks/useCurrentProfile.ts`
- Modify: `frontend/app/(app)/layout.tsx`
- Modify: `backend/src/main.ts`
- Modify: `backend/src/auth/jwt-auth.guard.ts`
- Create: `frontend/tests/api-auth.test.mjs`
- Create: `backend/test/auth-session.e2e-spec.ts`

**Interfaces:**
- Produce `getApiBaseUrl()` behavior that uses `NEXT_PUBLIC_API_URL` when provided and otherwise derives `protocol//hostname:4000/api` in the browser.
- Produce `ApiClient.request<T>()` behavior that throws `ApiError` with `statusCode`, clears auth on 401, and preserves retryable errors.
- Produce `getCurrentUser()`, `clearAuthSession()`, and `isAuthenticated()` session behavior safe during SSR and WebView reloads.

- [ ] **Step 1: Write failing tests** for LAN URL derivation, malformed session storage, 401 session clearing, and non-401 retryable errors.
- [ ] **Step 2: Run `node --test frontend/tests/api-auth.test.mjs` and confirm the new assertions fail against the current implementation.**
- [ ] **Step 3: Implement the typed API/session contract and backend CORS origin handling for LAN port 3000 plus configured frontend origins.**
- [ ] **Step 4: Run the focused frontend tests and `npm run test --workspace backend -- auth-session` to verify the contract.**
- [ ] **Step 5: Commit with `git add frontend/lib frontend/hooks frontend/app backend/src frontend/tests backend/test && git commit -m "fix: harden Expo Go API and auth session flow"`.

### Task 2: Shared backend persistence patterns

**Files:**
- Create: `backend/src/common/user-owned-resource.ts`
- Create: `backend/src/nutrition/schemas/nutrition.schema.ts`
- Create: `backend/src/nutrition/dto/nutrition.dto.ts`
- Create: `backend/src/nutrition/nutrition.service.ts`
- Create: `backend/src/nutrition/nutrition.controller.ts`
- Create: `backend/src/nutrition/nutrition.module.ts`
- Create: `backend/src/settings/schemas/settings.schema.ts`
- Create: `backend/src/settings/dto/settings.dto.ts`
- Create: `backend/src/settings/settings.service.ts`
- Create: `backend/src/settings/settings.controller.ts`
- Create: `backend/src/settings/settings.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/nutrition-settings.e2e-spec.ts`

**Interfaces:**
- `NutritionController`: `GET /api/nutrition`, `POST /api/nutrition/meals`, `PUT /api/nutrition/meals/:id`, `DELETE /api/nutrition/meals/:id`, `GET /api/nutrition/water`, `PUT /api/nutrition/water/:date`.
- `SettingsController`: `GET /api/settings`, `PUT /api/settings`.
- Every service receives the authenticated `userId` and filters by ownership.

- [ ] **Step 1: Write failing API tests for empty nutrition/settings state, meal CRUD ownership, water replacement by date, and settings patch persistence.**
- [ ] **Step 2: Run `npm run test:e2e --workspace backend -- nutrition-settings.e2e-spec.ts` and confirm the endpoints/models are absent.**
- [ ] **Step 3: Implement schemas, DTOs, services, controllers, modules, and AppModule registration using the existing JWT guard and validation pipe.**
- [ ] **Step 4: Run backend unit/e2e tests and verify a user cannot read or mutate another user's records.**
- [ ] **Step 5: Commit with `git add backend/src backend/test && git commit -m "feat: add persisted nutrition and settings resources"`.

### Task 3: Migrate nutrition and settings screens off mock/local data

**Files:**
- Modify: `frontend/sections/Scan/ScanSection.tsx`
- Modify: `frontend/sections/Scan/FoodHistory.tsx`
- Modify: `frontend/sections/Me Section/MeSection.tsx`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/hooks/useNutrition.ts`
- Create: `frontend/hooks/useSettings.ts`
- Modify: `frontend/tests/mobile-redesign.test.mjs`

**Interfaces:**
- `useNutrition()` exposes `{ meals, water, loading, error, refresh, addMeal, updateMeal, deleteMeal, setWater }`.
- `useSettings()` exposes `{ settings, loading, error, updateSettings, retry }`.
- Empty server arrays render empty-state copy; no `sampleMeals` initialization remains in live screen state.

- [ ] **Step 1: Add failing source/behavior tests asserting nutrition/settings hooks are used and sample/localStorage initialization is absent from live feature state.**
- [ ] **Step 2: Run `npm run test:ui-guard --workspace frontend` and confirm the migration assertions fail.**
- [ ] **Step 3: Implement the hooks and replace direct sample/local state with server-backed state, preserving optimistic UI only when the API confirms the saved result.**
- [ ] **Step 4: Add loading, empty, error, retry, and save-failure states to the existing screens without changing their visual contract.**
- [ ] **Step 5: Run frontend tests and build; commit with `git add frontend && git commit -m "feat: persist nutrition and settings from mobile"`.

### Task 4: Persist quests, workouts, progress, notifications, and coach state

**Files:**
- Create: `backend/src/activity/schemas/activity.schema.ts`
- Create: `backend/src/activity/dto/activity.dto.ts`
- Create: `backend/src/activity/activity.service.ts`
- Create: `backend/src/activity/activity.controller.ts`
- Create: `backend/src/activity/activity.module.ts`
- Create: `backend/src/notifications/schemas/notification.schema.ts`
- Create: `backend/src/notifications/dto/notification.dto.ts`
- Create: `backend/src/notifications/notifications.service.ts`
- Create: `backend/src/notifications/notifications.controller.ts`
- Create: `backend/src/notifications/notifications.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/activity-notifications.e2e-spec.ts`
- Create: `frontend/hooks/useActivity.ts`
- Create: `frontend/hooks/useNotifications.ts`
- Modify: `frontend/sections/Quests Section/QuestSection.tsx`
- Modify: `frontend/sections/Home/Progress.tsx`
- Modify: `frontend/sections/Home/Notifications.tsx`
- Modify: `frontend/sections/Coach/CoachSection.tsx`
- Modify: `frontend/sections/Coach/CoachPlan.tsx`
- Modify: `frontend/tests/mobile-redesign.test.mjs`

**Interfaces:**
- `GET/PUT /api/activity/state` stores user-owned quest XP, milestones, workout plan, sessions, and progress values.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, and `POST /api/notifications/read-all` store/read user-owned notifications.
- Hooks expose loading/error/retry and mutation methods returning saved server state.

- [ ] **Step 1: Write failing backend ownership/empty-state tests and frontend migration assertions for quests, progress, and notifications.**
- [ ] **Step 2: Run the focused backend and frontend tests to verify they fail for the current mock implementations.**
- [ ] **Step 3: Implement the activity/notification persistence resources and register them with AppModule.**
- [ ] **Step 4: Migrate screens to hooks and remove sample/localStorage initialization from their authoritative state.**
- [ ] **Step 5: Run all backend tests, frontend tests, and the production build; commit with `git add backend frontend && git commit -m "feat: persist activity and notifications"`.

### Task 5: Honest camera/AI capability states and mobile connection UX

**Files:**
- Modify: `frontend/sections/Coach/CameraCheck.tsx`
- Modify: `frontend/sections/Scan/ReviewEstimate.tsx`
- Modify: `mobile/App.tsx`
- Modify: `frontend/components/ProfileLoadState.tsx`
- Modify: `RUNNING.md`
- Modify: `frontend/tests/mobile-redesign.test.mjs`

**Interfaces:**
- Camera/scan UI must distinguish `unavailable`, `manual`, `processing`, and `complete`; unavailable mode must never claim a real detection.
- The Expo connection screen shows the active URL, backend status where available, and a retry action.

- [ ] **Step 1: Write failing tests for unavailable camera/AI copy, no fabricated scan success, and retryable mobile connection state.**
- [ ] **Step 2: Run focused tests and confirm current demo behavior fails those assertions.**
- [ ] **Step 3: Implement explicit capability states and preserve manual workout/food entry paths.**
- [ ] **Step 4: Add connection/API diagnostics to the WebView wrapper and update startup documentation with exact three-process commands.**
- [ ] **Step 5: Run Expo TypeScript and start checks; commit with `git add mobile frontend RUNNING.md && git commit -m "fix: make unsupported mobile capabilities explicit"`.

### Task 6: Full verification and UAT

**Files:**
- Modify: `RUNNING.md`
- Create: `frontend/tests/expo-data-flow.test.mjs`
- Create or modify: `backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Add a contract test covering launch, auth storage, API URL derivation, profile load, empty collection rendering, and 401 behavior.**
- [ ] **Step 2: Run `npm run test --workspace backend`, `npm run test:ui-guard --workspace frontend`, and `node --test frontend/tests/expo-data-flow.test.mjs`; record failures.**
- [ ] **Step 3: Run `npm run build --workspace frontend` and `npx tsc --noEmit -p mobile/tsconfig.json`.**
- [ ] **Step 4: Start backend, frontend, and Expo on LAN; exercise register/login/calibration, persisted feature writes, reload, logout, and login restoration against MongoDB Atlas.**
- [ ] **Step 5: Verify `git diff --check`, inspect changed files, and commit the final verification/documentation update with `git add RUNNING.md frontend/tests backend/test && git commit -m "test: verify Expo Go end-to-end data flow"`.
