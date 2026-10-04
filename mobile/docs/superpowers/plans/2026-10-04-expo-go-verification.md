# Expo Go System Verification Implementation Plan

> **For agentic workers:** Use the selected plan-execution workflow task-by-task. Each step uses checkbox syntax for tracking.

**Goal:** Verify the integrated app from Expo Go through the frontend, backend, and MongoDB and document the actual outcomes.

**Architecture:** Use repository-native build/test commands, API contract tests, and a physical Expo Go smoke run when a device is available. Separate code verification from external-provider and device verification. Update the run guide only after commands and addresses are confirmed.

**Tech Stack:** Existing npm workspaces, Expo SDK 57, Next.js 16, NestJS 12, MongoDB, Vitest, Node built-in test runner.

**Spec:** [Expo Go End-to-End Reliability Design](../expo-go-reliability-design.md)

## Global Constraints

- Do not add dependencies without approval.
- Preserve current staged edits and user configuration/data.
- Do not report physical-device/provider tests as passed unless actually run.
- Keep frontend/API ports 3000/4000 and secrets in backend-only configuration.

## Review Focus

- Missing MongoDB URI or API credentials produce readiness errors, not a misleading healthy state.
- Backend-only outage remains distinguishable from frontend outage in Expo Go.
- A clean start follows documented package commands with no hidden hard-coded LAN IP.
- API writes survive fresh reads/reloads; browser cache is not mistaken for database persistence.
- Android/iOS bundle success is distinct from physical Expo Go interaction verification.

---

### Task 1: Create a reproducible verification checklist from existing scripts

**Files:**
- Modify: `README.md`, `RUNNING.md`
- Update only if implementation changes a command/contract: connectivity and feature plan docs under `mobile/docs/superpowers/plans/`

- [x] Run `npm run` at repository root, `npm run` in `backend/`, and inspect `mobile/package.json`; record only scripts that exist.
- [x] Run backend/frontend/mobile build checks from their actual package contexts and record exact commands/results.
- [x] Update run docs with setup order, LAN addresses, ports 3000/4000, MongoDB/JWT prerequisites, provider setup limits, and Expo Go network requirements.
- [x] Verify docs contain no stale IP, nonexistent command, or unsupported device/provider success claim.

### Task 2: Verify API persistence and ownership with two users

**Files:**
- Test: `backend/test/**`
- Modify only for verified defects: feature controllers/services/schemas/DTOs from preceding plans.

- [x] Run all backend tests with `npm test` from `backend/`.
- [x] Run `npm run build` from `backend/`.
- [x] With test MongoDB configured, register two accounts and verify neither can read/update the other's nutrition, activity, sessions, progress, notifications, or admin records.
- [x] Create representative nutrition, water, workout, progress, and notification records as account A; fresh authenticated reads must confirm persistence.
- [x] Exercise invalid bodies, missing/expired auth, provider unavailable, and server timeout; confirm stable error envelopes.

### Task 3: Verify frontend controls and Expo bundles

**Files:**
- Test: `frontend/tests/**`, `mobile/connection.test.mjs`
- Modify only for verified defects in `frontend/**` or `mobile/**`.

- [x] Run frontend behavior tests and TypeScript/build checks.
- [x] Inventory visible interactive controls and confirm each performs navigation, a local display choice, or a confirmed API operation; label unavailable integrations clearly.
- [x] Run Expo config, TypeScript, Android export, and iOS export from `mobile/`.
- [x] Inspect emitted mobile bundle for localhost/private-IP assumptions and confirm no backend secrets are included.

### Task 4: Exercise the current Expo Go device path and report limits

**Files:**
- Modify: `README.md`, `RUNNING.md` only to correct observed instructions.

- [x] Start backend bound to LAN on port 4000, frontend bound to LAN on port 3000, then run the existing Expo script.
- [ ] Confirm a device on the same reachable network loads frontend, reaches API, registers/logs in, navigates five tabs, and completes one persisted create/read/update/delete flow. No controllable Expo Go device/ADB connection was available in this environment.
- [x] Confirm frontend outage, backend outage, camera permission denial, and provider-not-configured each have designed recovery/status behavior through implementation checks; phone permission/outage prompts remain unexercised.
- [ ] If no controllable Expo Go device or provider credentials are available, list exact unrun checks separately; do not infer from bundle/API results.
- [x] Record final command results and actual device/provider conditions in run documentation.

## Completion

Software checks pass, the available Expo Go device flow is exercised end-to-end, and final reporting distinguishes verified functionality from device/provider checks that could not run.
