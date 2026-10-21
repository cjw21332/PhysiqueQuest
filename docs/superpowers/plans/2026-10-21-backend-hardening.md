# Backend Hardening Implementation Plan

Goal: execute the supplied 74-item checklist without breaking shipped WebView clients.
Spec: supplied backend overhaul task and approved phased authentication migration in chat.
Architecture: retain Nest/Mongoose and existing contracts. New session-aware authentication endpoints issue 15-minute JWTs and rotating opaque refresh credentials; legacy endpoints remain during the migration. Store refresh hashes only, use atomic compare-and-swap rotation and revoke the family on replay. Existing user sessionVersion invalidates both token types on password change.

1. Auth: add session schema/service, opt-in login/register/session/refresh/logout, JWT session checks and legacy telemetry. Tests first: rotation, replay, concurrency, expiry, password revocation, legacy validation. Verify auth tests then backend suite/build/lint; commit theme.
2. A/B: audit controllers, DTOs, ownership, outbound providers, upload parsing, logging and startup. Add shared request protection and production validation only with regression tests. Run full history secret scan and dependency audit; report sanitized findings without values.
3. D/C: inspect persistence concurrency/idempotency and query bounds; preserve API shapes. Add targeted fixes and tests. Load-test local isolated application with real middleware and mocked persistence if no safe disposable DB is available; label that limitation and record p50/p95/p99 and throughput.
4. E/F: add compatible version/config/health/readiness, graceful shutdown and deployment/CI configuration. Do not invent production hosts, providers or deletion policy. Record external operational steps and decision-dependent features accurately.
5. Return to frontend/mobile migration: inspect deployed site topology. Use secure httpOnly SameSite cookies for same-site HTTPS; otherwise approved native secure-storage bridge. Memory-only access credentials, silent refresh, legacy-storage cleanup and logout races require client tests. Do not remove legacy validation until minimum-version enforcement and deployment evidence permit it.
6. Update root checklist, docs/checklist.md and next ProgressReports report. Run final affected suites/build/lint/audits, inspect diff and make logical commits. Never equate mocked checks with production evidence.

Constraints: no new state-management library, no secret output, no unapproved runtime dependencies, preserve data/ownership and existing responses. Infrastructure checks without access remain open, with exact manual steps.
