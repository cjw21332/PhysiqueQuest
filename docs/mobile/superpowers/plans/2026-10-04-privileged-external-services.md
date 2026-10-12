# Privileged and External Services Implementation Plan

> **For agentic workers:** Use the selected plan-execution workflow task-by-task. Each step uses checkbox syntax for tracking.

**Goal:** Replace fake admin, recovery, emergency-delivery, and pose-analysis behavior with protected backend contracts and truthful provider states.

**Architecture:** Enforce authorization at API boundaries, keep provider secrets server-side, and expose typed availability/errors to the WebView. Provider interfaces are implemented independently of provider credentials; no external action is reported successful until a configured provider confirms it.

**Tech Stack:** NestJS 12, MongoDB/Mongoose, JWT/passport, Next.js 16, TypeScript, Vitest, and the existing Expo WebView camera bridge.

**Spec:** [Expo Go End-to-End Reliability Design](../expo-go-reliability-design.md)

## Global Constraints

- Keep provider keys and signing secrets exclusively in `backend/.env`.
- Keep Expo Go compatibility; do not require custom native modules or a development build.
- Do not add dependencies without approval.
- Every admin endpoint enforces role server-side and scopes returned data.
- An unavailable external provider returns a clear service error and never a success-shaped response.

## Review Focus

- Ordinary users calling admin endpoints directly receive 403 even when the frontend hides admin screens.
- Password-reset requests do not disclose account existence and tokens expire and are one-time use.
- Alert delivery reports success only after provider confirmation; retry cannot duplicate alerts for one event.
- Missing provider credentials are detected without exposing secrets or failing unrelated API startup.
- Camera denial, upload failure, and unavailable pose provider each produce distinct recovery states.

---

### Task 1: Add server-enforced roles and persistent admin exercise APIs

**Files:**
- Modify: `backend/src/auth/schemas/user.schema.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/jwt.strategy.ts`
- Create: `backend/src/auth/roles.decorator.ts`, `backend/src/auth/roles.guard.ts`
- Create: `backend/src/exercises/exercises.module.ts`, `exercises.controller.ts`, `exercises.service.ts`, `dto/exercise.dto.ts`, `schemas/exercise.schema.ts`
- Modify: `backend/src/app.module.ts`, `frontend/lib/api.ts`, `frontend/sections/Me Section/AdminExerciseLibrary.tsx`, `frontend/sections/Me Section/MeSection.tsx`
- Test: `backend/test/admin-exercises.spec.ts`, `frontend/tests/admin-exercises.test.mjs`

**Interfaces:** `User.role` defaults to `user`; only an explicitly provisioned `admin` role grants access. Admin `GET /api/admin/exercises`, `POST /api/admin/exercises`, `PATCH /api/admin/exercises/:id`, and `DELETE /api/admin/exercises/:id` require JWT plus `RolesGuard`.

- [ ] Add tests for missing token (401), ordinary role (403), admin CRUD (2xx), DTO rejection, and persistence across reload.
- [ ] Run `npm test -- --run test/admin-exercises.spec.ts` from `backend/` and confirm authorization tests fail before implementation.
- [ ] Add default role to new users; never accept role from registration DTO. Document explicit admin provisioning through backend-only configuration.
- [ ] Implement role decorator/guard, validated controller, Mongoose persistence, and pagination capped at 100 records.
- [ ] Replace static sample records in admin exercise screen with API results; show API errors and unavailable access.
- [ ] Run focused tests and backend/frontend builds.

### Task 2: Implement password-recovery contracts with an email provider boundary

**Files:**
- Modify: `backend/src/auth/auth.controller.ts`, `auth.service.ts`, `auth.module.ts`
- Create: `backend/src/auth/recovery-token.schema.ts`, `backend/src/auth/dto/password-recovery.dto.ts`, `backend/src/providers/email-delivery.provider.ts`
- Modify: `backend/src/app.module.ts`, `frontend/lib/api.ts`, `frontend/sections/Forgot Password/ForgotPasswordFlow.tsx`
- Test: `backend/test/password-recovery.spec.ts`, `frontend/tests/password-recovery.test.mjs`

**Interfaces:** `POST /api/auth/password-reset/request` accepts `{ email }` and gives the same account-neutral response for existing/non-existing users: `{ accepted: true, delivery: 'queued' | 'unavailable' }`. `delivery: 'unavailable'` depends only on global provider configuration, never account existence, so UI can identify setup failure without enabling email enumeration. `POST /api/auth/password-reset/confirm` accepts `{ token, password }`. Missing provider configuration never creates a success claim.

- [ ] Add tests for enumeration resistance, token expiry, one-time use, password policy, provider confirmation/failure, and absent provider config.
- [ ] Run `npm test -- --run test/password-recovery.spec.ts` from `backend/` and confirm routes/provider contract are missing.
- [ ] Implement hashed, expiring one-use tokens; never store or log raw tokens.
- [ ] Implement injectable email provider interface and disabled provider returning typed `PROVIDER_NOT_CONFIGURED` without sending.
- [ ] Wire recovery UI to APIs; remove local OTP acceptance and local-only password update; preserve retryable errors and only show completion after backend confirmation.
- [ ] Run focused tests and check UI copy against configured/unconfigured behavior.

### Task 3: Add confirmed emergency-alert orchestration

**Files:**
- Create: `backend/src/safety/safety.module.ts`, `safety.controller.ts`, `safety.service.ts`, `schemas/alert-event.schema.ts`, `dto/create-alert.dto.ts`
- Create: `backend/src/providers/alert-delivery.provider.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/notifications/notifications.service.ts`, `frontend/lib/api.ts`
- Modify: safety-related UI in `frontend/app/launch/page.tsx`, `frontend/sections/Me Section/MeSection.tsx`, and `frontend/sections/Home/Notifications.tsx` after auditing actual controls
- Test: `backend/test/safety-alerts.spec.ts`, `frontend/tests/safety-alerts.test.mjs`

**Interfaces:** `POST /api/safety/alerts` accepts an idempotency key and allowed event type; backend loads the emergency contact from caller profile. Persist `pending`, `delivered`, or `failed`; only provider confirmation sets `delivered` and emits a notification.

- [ ] Add tests for missing provider, timeout/failure, confirmed delivery, duplicate key, and notification visibility.
- [ ] Run `npm test -- --run test/safety-alerts.spec.ts` from `backend/` and verify there is no current endpoint that confirms delivery.
- [ ] Implement user-scoped records, server-side contact lookup, provider interface, idempotency, and notification creation.
- [ ] Update controls to show unavailable before sending when no provider exists; only persisted confirmation can display delivered.
- [ ] Run focused tests and verify no sample notification claims a real person was contacted.

### Task 4: Implement pose-analysis availability without fabricated form scoring

**Files:**
- Modify `backend/src/foodscan/foodscan.module.ts` only if its vision interface fits; otherwise create `backend/src/pose/pose.module.ts`, `pose.controller.ts`, `pose.service.ts`, DTO/schema files
- Modify: `frontend/lib/api.ts`, `frontend/sections/Coach/CameraCheck.tsx`, `frontend/sections/Coach/LiveSession.tsx`, `frontend/sections/Coach/WorkoutReport.tsx`
- Modify: `mobile/App.tsx` only if the permission-message bridge is missing
- Test: backend pose-analysis tests and `frontend/tests/pose-flow.test.mjs`

**Interfaces:** `GET /api/pose/status` returns `{ available: boolean; reason?: 'provider_not_configured' }`. When configured, `POST /api/pose/analyze` validates media metadata; when unconfigured it returns 503 with code `PROVIDER_NOT_CONFIGURED`.

- [ ] Add tests for availability, upload validation, provider failure, and no fabricated scores in reports.
- [ ] Implement server-only provider config/status and typed errors; never accept a provider key from client.
- [ ] Preserve wrapper camera permission messages and browser file upload fallback supported by Expo Go.
- [ ] Replace fake rep counts/form score with neutral controls; show analyzed feedback only when an API response exists.
- [ ] Run focused tests, Expo TypeScript/bundle checks, and frontend build.

### Task 5: Secure admin analytics and document provider setup

**Files:**
- Create or modify analytics APIs under `backend/src/admin/`.
- Modify: `frontend/sections/Me Section/EngagementAnalytics.tsx`
- Modify: `backend/.env.example`, `backend/README.md`, `README.md`, `RUNNING.md`
- Test: `backend/test/admin-analytics.spec.ts`, `frontend/tests/admin-analytics.test.mjs`

- [ ] Add tests for admin-only access, valid ranges, empty response, and export limited to API response data.
- [ ] Replace hard-coded metrics/events with backend range query; export only returned rows.
- [ ] Document role provisioning and optional provider variables as unset-by-default; never add secrets.
- [ ] Run focused tests and backend/frontend builds; verify no secrets are embedded in frontend/mobile bundles.

## Completion

Tasks 1–5 complete when admin authorization is enforced, fake success/sample records are removed from these flows, provider absence is explicit, and tests cover configured and unavailable paths.
