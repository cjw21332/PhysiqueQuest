# Persistent User Features Implementation Plan

> **For agentic workers:** Use the selected plan-execution workflow task-by-task. Each step uses checkbox syntax for tracking.

**Goal:** Make nutrition, coach sessions, quests, progress, and notifications authoritative, user-scoped backend data.

**Architecture:** Reuse existing Nest modules and frontend APIs/hooks where contracts fit. Replace client-side sample state with server data, add user-scoped persistence for completed workouts and dated progress, and derive quests from saved app events rather than tappable self-attestation. Every write returns persisted state before the UI displays success.

**Tech Stack:** Next.js 16, React 19, TypeScript, NestJS 12, MongoDB/Mongoose, Vitest, Node built-in test runner.

**Spec:** [Expo Go End-to-End Reliability Design](../expo-go-reliability-design.md)

## Global Constraints

- Keep Expo Go as a WebView shell and keep API access on port 4000.
- Do not add dependencies without approval.
- Scope all user data by authenticated JWT `userId`; never accept an owner ID from a client payload.
- Do not report writes as successful before the API confirms them.
- Preserve and extend already-staged nutrition/food-scan/backend work; do not revert it.

## Review Focus

- Date boundaries use the user's local calendar date consistently for meals, water, and daily missions.
- Replaying completion cannot duplicate points, sessions, or badges.
- Empty users see empty states rather than fabricated history.
- A user cannot read or mutate another user's activity/session/notification data by changing an ID.
- Network failure during a write preserves current input and reports failure instead of optimistic success.

---

### Task 1: Audit and tighten existing nutrition, settings, notification, and activity contracts

**Files:**
- Read and modify only as needed: `backend/src/nutrition/**`, `backend/src/settings/**`, `backend/src/notifications/**`, `backend/src/activity/**`
- Read and modify only as needed: `frontend/lib/api.ts`, `frontend/hooks/useNutrition.ts`, `frontend/hooks/useSettings.ts`, `frontend/hooks/useNotifications.ts`, `frontend/hooks/useActivity.ts`, `frontend/sections/Scan/**`, `frontend/sections/Me Section/MeSection.tsx`, `frontend/sections/Home/Notifications.tsx`
- Test: `backend/test/**` and existing frontend behavior tests

**Interfaces:** Preserve existing route names for nutrition, settings, activity, and notifications unless a failing contract test demonstrates a defect. Define response types from current controller/service/schema output before changing UI mappings.

- [ ] Read DTOs, schemas, controllers, services, hooks, and screen callbacks; write an action-to-endpoint checklist in the task notes before edits.
- [ ] Add failing API/service tests for user scoping, validation, persistence/reload, water date handling, meal update/delete, and read-state persistence where coverage is absent.
- [ ] Run focused Vitest tests from `backend/` and `npm run test:ui-guard --workspace frontend`.
- [ ] Tighten DTO validation to reject unknown fields and invalid nested values while retaining currently valid UI request shapes.
- [ ] Update hooks to clear prior errors on retry, retain input on failed writes, and replace state only from confirmed server responses.
- [ ] Replace hard-coded safety content in `frontend/sections/Home/Notifications.tsx` with API items; render an empty state when none exist.
- [ ] Run focused service/API tests, the frontend UI guard, and backend build.

### Task 2: Persist workout session start, pause, completion, and report data

**Files:**
- Create: `backend/src/workouts/workouts.module.ts`
- Create: `backend/src/workouts/workouts.controller.ts`
- Create: `backend/src/workouts/workouts.service.ts`
- Create: `backend/src/workouts/dto/workout.dto.ts`
- Create: `backend/src/workouts/schemas/workout-session.schema.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/hooks/useWorkouts.ts`
- Modify: `frontend/sections/Coach/CoachSection.tsx`
- Modify: `frontend/sections/Coach/LiveSession.tsx`
- Modify: `frontend/sections/Coach/WorkoutReport.tsx`
- Test: `backend/test/workouts.spec.ts`, `frontend/tests/workout-flow.test.mjs`

**Interfaces:**
- `POST /api/workouts` accepts `{ exerciseIds: string[]; startedAt: string }` and creates an authenticated user's session with `status: 'active'`.
- `PATCH /api/workouts/:id/pause` accepts `{ paused: boolean; occurredAt: string }`.
- `POST /api/workouts/:id/complete` accepts `{ endedAt: string; durationSeconds: number; exerciseResults: { exerciseId: string; reps: number; loadKg?: number }[] }` and returns the persisted report.
- `GET /api/workouts?limit=20` returns only the authenticated user's newest sessions.

- [ ] Add tests for create, pause/resume, completion, validation, cross-user access, duplicate completion, and reload persistence.
- [ ] Run `npm test -- --run test/workouts.spec.ts` from `backend/` and confirm route tests fail before implementation.
- [ ] Implement the Mongoose model and JWT-guarded controller. Return 404 for a session not owned by the caller; make completion idempotent and derive duration from validated timestamps.
- [ ] Add typed API methods and `useWorkouts`; update the session timer to pause/resume and submit before navigating to the report.
- [ ] Remove fabricated reps, form percentage, calorie burn, volume, dates, and PR claims from the report; render persisted fields and mark form analysis unavailable until configured.
- [ ] Test pause duration, failed completion staying on session with error, confirmed completion opening saved report, and empty recent-workout state.
- [ ] Run workout tests, TypeScript check, frontend behavior tests, and backend build.

### Task 3: Persist progress measurements and derive progress/history views

**Files:**
- Create: `backend/src/progress/progress.module.ts`
- Create: `backend/src/progress/progress.controller.ts`
- Create: `backend/src/progress/progress.service.ts`
- Create: `backend/src/progress/dto/progress.dto.ts`
- Create: `backend/src/progress/schemas/progress-entry.schema.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/hooks/useProgress.ts`
- Modify: `frontend/sections/Home/Progress.tsx`
- Test: `backend/test/progress.spec.ts`, `frontend/tests/progress-flow.test.mjs`

**Interfaces:** `POST /api/progress` accepts `{ metric: 'weight'|'waist'|'benchPress'; value: number; unit: 'kg'|'lb'|'cm'|'in'; measuredAt: string }`; `GET /api/progress?metric=<metric>&limit=90` returns caller-owned entries ordered by `measuredAt` ascending; `DELETE /api/progress/:id` deletes only caller-owned entries.

- [ ] Add tests for supported units, positive bounds, metric/unit compatibility, chronological ordering, delete ownership, and empty history.
- [ ] Run `npm test -- --run test/progress.spec.ts` from `backend/` and confirm missing routes/contracts fail.
- [ ] Implement DTO/schema validation, per-user queries, and API routes; never accept user ID in the DTO.
- [ ] Implement typed API client and hook; replace sample series, records, sessions, and form-accuracy values with persisted data or honest empty/configuration states.
- [ ] Add a flow test proving a saved measurement appears after a fresh API read and network failure does not appear as saved.
- [ ] Run focused tests and both package type/build checks.

### Task 4: Make quests and rewards server-derived and idempotent

**Files:**
- Modify: `backend/src/activity/activity.controller.ts`
- Modify: `backend/src/activity/activity.service.ts`
- Modify: `backend/src/activity/dto/activity.dto.ts`
- Modify: `backend/src/activity/schemas/activity.schema.ts`
- Modify: `backend/src/nutrition/nutrition.service.ts`
- Modify: workout service from Task 2
- Modify: `frontend/hooks/useActivity.ts`
- Modify: `frontend/sections/Quests Section/QuestSection.tsx`
- Test: `backend/test/activity-quests.spec.ts`, `frontend/tests/quest-flow.test.mjs`

**Interfaces:** `GET /api/activity/state` returns `{ state, dailyMissions, badges }`. `PUT /api/activity/state` may update only whitelisted user preferences and may not write quest progress, points, streak, or badges. Nutrition/workout completion updates daily counters exactly once per source record.

- [ ] Add tests that clients cannot self-award points, duplicate events do not double-count, daily reset uses the configured timezone boundary, reward caps hold, and badges reflect earned criteria.
- [ ] Run the activity test and verify the current unrestricted nested-state write fails the new authorization assertion.
- [ ] Implement an allowlist DTO and server-side quest projection based on persisted meals, water, and workout records; remove manual mission increments and invented streak/calendar/penalty/badge values.
- [ ] Update quest screen with loading, retry, empty, earned, and API error states; leaderboard stays clearly unavailable until a ranking API exists.
- [ ] Run focused backend/frontend tests and confirm a reload keeps the same quest state.

### Task 5: Verify user feature persistence and ownership end-to-end

**Files:**
- Test: `backend/test/**`, `frontend/tests/**`
- Modify only for verified gaps: feature controllers/services/schemas/hooks; `README.md` and `RUNNING.md`

- [ ] Run nutrition, settings, notification, workout, progress, and quest focused tests.
- [ ] Run `npm run build --workspace frontend`, `npm run build` from `backend/`, `npx tsc --noEmit -p mobile/tsconfig.json`, and frontend behavior tests.
- [ ] With test MongoDB configured, create/read/update/delete representative nutrition, water, workout, and progress records; fresh reads must confirm persistence.
- [ ] Verify a second account cannot read or modify the first account's nutrition, activity, sessions, progress, or notifications.
- [ ] Record physical-device Expo Go outcomes separately from backend/build verification.

## Completion

Tasks 1–5 complete when displayed feature data comes from authenticated APIs, backend tests prove ownership and persistence, and all task verification commands pass.
