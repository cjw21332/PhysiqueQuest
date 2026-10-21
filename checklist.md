# Backend Hardening Checklist

## Stack Discovery
Discovery: 2026-10-21; initial working tree clean, branch PhysiqueQuest-v3.1.1.
- TypeScript ESM, NestJS 12/Express, MongoDB/Mongoose 9; separate stateless Coach process. Sources: backend/package.json, backend/src/app.module.ts, backend/src/coach-main.ts.
- Next.js frontend; Expo mobile shell loads it in a WebView (mobile/App.tsx). Frontend stores bearer JWT in localStorage (frontend/lib/auth.ts). JWT defaults to seven days (backend/src/auth/auth.module.ts).
- /api routes include auth, profile, nutrition, activity, settings, notifications, workouts, progress, leaderboard, coach, exercises, safety, pose and admin.
- Existing controls include global whitelist validation, explicit CORS, bcrypt, account lockout, password recovery, JWT and admin role guards. Full behavioral audit is outstanding.
- Vitest/Supertest tests, oxlint and Nest build scripts exist. Initial tracked-file inventory found no CI workflow or Docker/deploy YAML. Production topology is unknown.
- Environment patterns are ignored; tracked env files are examples or source/test filenames. Local backend/.env exists; its values were not printed. Historical secret scan remains outstanding.
- Local main exists; branch comparison spans 860 files. Security review against main remains outstanding.

## Needs Human Decision
Paused under the supplied task's Ground Rule 8: stop when a risky or ambiguous change requires a decision.
1. Authentication (A token storage/email verification, B refresh tokens, E sessions): choose coordinated backend/frontend/mobile migration with an explicit legacy-client transition, or preserve current clients and defer these requirements. The current WebView uses localStorage bearer auth. Cookie transport needs production frontend/API domains and HTTPS topology; native secure storage needs a WebView bridge. Silently changing transport or token lifetime can break existing clients.
2. Infrastructure/product scope (C queues/CDN, E push/forced updates/remote config, F monitoring/deployment): confirm production host, database topology, domains, supported app versions and approved providers. These features add infrastructure and operational cost; their need has not been established by discovery.
3. Privacy (B deletion/export, D backups/retention): confirm deletion scope, retention policy and recovery objectives before irreversible deletion or expiry behavior.
Unchecked items below remain open. These decisions block dependent changes; independent hardening remains outstanding too.

## Additional Findings
- Confirmed sensitive token persistence: frontend/lib/auth.ts:26,48; used by mobile WebView.
- Registration signs in immediately; JWT default is 7d. Verification and refresh rotation require compatibility design.
- SQL-specific checklist wording needs MongoDB equivalents: ownership filters, schema validation, indexes and explain plans. Underlying security goals still apply.
- No application code, database records or credentials changed during discovery.

## Section A — Core Security Review (preset: security review against `main`)
Review the diff/codebase against `main` using this security checklist:

- [ ] Enable Row-Level Security (RLS) — enable on every table that holds user data; write explicit policies (users can only read/write their own rows); default-deny
- [ ] Tighten CORS configuration — explicit allowlist of origins, no wildcard `*` with credentials, restrict methods and headers
- [ ] Ensure parameterized SQL queries — no string-concatenated SQL anywhere; use prepared statements / ORM bindings
- [ ] Verify email address workflows — email verification on signup, secure password-reset flow, expiring single-use tokens, no user enumeration in responses
- [ ] Store tokens securely (no localStorage for sensitive tokens) — use httpOnly + Secure + SameSite cookies on web; Keychain/Keystore-backed secure storage guidance for the mobile client
- [ ] Ensure .env files and secrets are excluded from Git — `.gitignore` updated, `.env.example` provided, scan history for leaked secrets
- [ ] Validate and sanitize form and payload inputs — schema validation (e.g., Zod/Joi/Pydantic/class-validator) on every endpoint, reject unknown fields
- [ ] Enforce server-side permission checks on admin routes — never trust client-side role flags; central authorization middleware
- [ ] Disable production debugging / stack traces — generic error responses in production, details only in server logs
- [ ] Keep API secrets server-side — third-party keys (AI providers, payments, email, etc.) never shipped in the mobile app or returned by the API
- [ ] Rate-limit sensitive API endpoints — login, signup, password reset, OTP, AI/expensive endpoints
- [ ] Validate file upload types, extensions, and sizes — check MIME by content (magic bytes), extension allowlist, max size, randomized filenames, store outside web root / in object storage
- [ ] Prevent sensitive data exposure in logs — redact passwords, tokens, API keys, emails/PII where appropriate
- [ ] Use strong password hashing (bcrypt/Argon2) — with proper cost factor; migrate any weak hashes on next login
- [ ] Verify incoming webhook signatures — HMAC/signature verification with timing-safe comparison, replay protection (timestamp/nonce)
- [ ] Mitigate XSS risks — output encoding, sanitize any user-generated HTML/markdown, set CSP header
- [ ] Flag known outdated or vulnerable dependencies — run `npm audit` / `pip-audit` / equivalent, upgrade or document each finding

## Section B — Additional Security Hardening
- [ ] Authentication: short-lived access tokens + rotating refresh tokens, refresh-token revocation on logout/password change, token reuse detection
- [ ] Authorization: fix IDOR/BOLA — every resource lookup must check ownership/tenancy, not just authentication
- [ ] Prevent mass assignment — whitelist fields accepted on create/update (no blind `req.body` spreading into models)
- [ ] Brute-force protection — account lockout / exponential backoff and IP + account based throttling on auth endpoints
- [ ] Security headers — HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy (e.g., via Helmet or equivalent)
- [ ] Enforce HTTPS/TLS everywhere; redirect HTTP → HTTPS; secure cookie flags
- [ ] Request body size limits and timeouts on all endpoints to prevent resource exhaustion
- [ ] SSRF protection on any endpoint that fetches user-supplied URLs (block private/internal IP ranges)
- [ ] Secrets management — load secrets from environment/secret manager only; validate required env vars at startup and fail fast if missing
- [ ] Audit logging for sensitive actions (login, password change, role change, deletes, admin actions) with user ID, IP, timestamp
- [ ] Least-privilege database user and service credentials (app user cannot DROP/ALTER in production)
- [ ] Safe error handling: consistent error format, no internal details leaked, correlation/request ID returned
- [ ] Optional: MFA/OTP support for sensitive accounts/admin
- [ ] Data privacy: ability to export and delete a user's data (account deletion endpoint), encrypt sensitive fields at rest where appropriate, minimize PII collected (aligns with the Philippine Data Privacy Act principles)
- [ ] Automated dependency & secret scanning in CI (e.g., Dependabot/Renovate, gitleaks/trufflehog)

## Section C — Performance & Speed (make the app load faster)
- [ ] Add database indexes for all frequently filtered/sorted/joined columns and foreign keys; verify with `EXPLAIN`/query plans
- [ ] Eliminate N+1 queries (eager loading / joins / batching); add a note of before/after query counts for the heaviest endpoints
- [ ] Pagination on every list endpoint — prefer cursor-based pagination; enforce max page size
- [ ] Field selection / slim payloads — return only the fields the mobile screen needs; avoid over-fetching
- [ ] Response compression (gzip/brotli)
- [ ] Caching layer (e.g., Redis or in-memory) for hot read data with sensible TTLs and explicit invalidation on writes
- [ ] HTTP caching headers: `Cache-Control`, `ETag`/`If-None-Match` (304 responses) for cacheable GET endpoints
- [ ] Database connection pooling configured and tuned
- [ ] Move slow/expensive work (AI generation, image/video processing, emails, notifications, analytics) to background jobs/queues; API returns quickly with a job/status endpoint or push update
- [ ] Batch/aggregate endpoints so the mobile app can load a screen in 1 request instead of many
- [ ] Media/file delivery via object storage + CDN, with image resizing/optimization and signed URLs
- [ ] Timeouts, retries with exponential backoff + jitter, and circuit breakers for all outbound calls to third-party services/AI providers
- [ ] Optimize heavy endpoints: profile the top slowest routes and fix them; record before/after timings in `checklist.md`
- [ ] Use async/non-blocking I/O correctly; remove blocking calls from request handlers
- [ ] Load test key endpoints (k6/Locust/autocannon/equivalent) and record p50/p95/p99 latency and throughput

## Section D — Data Storage & Integrity
- [ ] Database constraints: NOT NULL, UNIQUE, CHECK, and foreign keys with sensible ON DELETE behavior
- [ ] Proper data types (timestamps in UTC with timezone, numeric/decimal for precise values, enums or lookup tables)
- [ ] `created_at` / `updated_at` on all tables; soft delete where recovery matters
- [ ] Versioned, reversible database migrations (no manual schema changes); migration run documented
- [ ] Transactions around multi-step writes so data never ends up half-saved
- [ ] Idempotency keys on create/payment-like/retry-prone endpoints so retried mobile requests don't duplicate data
- [ ] Concurrency safety: optimistic locking or atomic updates for counters/XP/points/streaks-type data (no race conditions)
- [ ] Automated backups + documented restore procedure; data retention policy for logs and temp data
- [ ] Seed/sample data script for dev; never run seeds in production

## Section E — Mobile-Specific Backend Features
- [ ] API versioning and a minimum-supported-app-version check (force-update response for outdated clients)
- [ ] Consistent response envelope and error codes the mobile app can handle predictably
- [ ] Offline-friendly sync support: delta/"updated since" endpoints, conflict handling (last-write-wins or versioned), idempotent writes
- [ ] Push notification backend (FCM/APNs) with device token registration, rotation, and cleanup of invalid tokens
- [ ] Device/session management: list active sessions, revoke a device, logout-all
- [ ] Remote config / feature flags endpoint so features can be toggled without an app update
- [ ] Secure file/media upload flow for mobile (pre-signed URLs, size/type limits, resumable for large files)
- [ ] Graceful handling of poor networks: small payloads, sensible timeouts, retry-safe endpoints

## Section F — Reliability, Observability & DevOps
- [ ] Health and readiness endpoints (`/health`, `/ready`) checking DB/cache/queue
- [ ] Graceful shutdown (finish in-flight requests, close DB/queue connections)
- [ ] Structured JSON logging with request/correlation IDs; log levels per environment
- [ ] Error tracking (e.g., Sentry) and basic metrics (request rate, error rate, latency, queue depth)
- [ ] Centralized config per environment (dev/staging/prod) with validation
- [ ] OpenAPI/Swagger documentation kept in sync with the endpoints
- [ ] Test suite: unit tests for business logic, integration tests for auth/permissions/validation, and a smoke test for critical flows
- [ ] CI pipeline running lint, tests, dependency audit, and secret scan on every PR
- [ ] Dockerfile / deploy config reviewed: non-root user, minimal image, no secrets baked in
- [ ] README updated: how to set up env, run migrations, run tests, and deploy

---


## Final Summary
Discovery checkpoint only. The requested overhaul is NOT complete; execution paused for the decisions above under Ground Rule 8.
- Baseline unit tests passed: 49 files, 382 tests; backend/: rtk npm test -- --reporter=dot.
- Baseline lint and build passed: backend/: rtk npm run lint; rtk npm run build.
- Production dependency audit: zero reported vulnerabilities; backend/: rtk npm audit --omit=dev. Full/dev dependency and historical secret scans remain outstanding.
- No implementation item is checked from inspection alone. No item is marked N/A merely because production infrastructure is unavailable.
- No measured performance improvement; no load test, production query plan, TLS/backup verification, frontend/mobile build or e2e suite performed.
- Remaining: full audit against main, implementations with regression tests, full dependency/history scans, database/load measurements and deployment verification.
- Reproduce baseline checks from backend/: rtk npm test; rtk npm run lint; rtk npm run build; rtk npm audit --omit=dev. Run rtk npm run test:e2e separately for integration coverage.
