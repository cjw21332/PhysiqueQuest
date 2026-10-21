# Backend Hardening Checklist

## Stack Discovery
2026-10-21. TypeScript ESM NestJS12/Express, Mongoose9/MongoDB, Next16 frontend and Expo57 WebView. Backend is a separate package; frontend/mobile share root workspaces. Development only: LAN/tunnel/localhost; no production URLs or provider accounts. Existing DTO/Zod validation, bcrypt, recovery, ownership/admin guards and Vitest suites were reused. No SQL/RLS applies. Initial discovery commit e1d0946; implementation evidence below supersedes the original discovery-only checkpoint.

Execution followed A, B, D, C, E, F with independent provider work added after the user's decisions. Checkmarks mean implemented and locally verified, not deployed. H-items distinguish remaining choices/deployment evidence. Exact original checklist text is retained.

## Needs Human Decision
- H1 — Deployment/operator evidence: final HTTPS origins/proxy hops/cookie domain; real least-privilege Mongo/media/backup identities; cloud R2/mail/Expo/Sentry credentials and mail domain; TLS/CDN edge, hosted CI, Docker image execution, monitored backup schedule and restore exercise in staging; production load/readiness. Runnable scripts and exact provider steps are in backend/PROVIDERS.md and OPERATIONS.md. Production-only HTTPS/HSTS/Secure settings are implemented, activates in production.
- H2 — Deploy the included private Cloudflare Worker with MEDIA binding, CDN_SIGNING_KEY and explicit CORS_ALLOWED_ORIGINS; configure its HTTPS CDN_BASE_URL in Nest. Backend-to-edge HMAC/expiry/CORS tests pass locally. Real routing remains unverified; image preprocessing is tested at1280px/JPEG0.82. No paid image-transform service was activated.
- H3 — Android/iOS WebView cookie persistence and remote-push device matrix. Follow the manual steps; desktop tests do not establish this. If cookies fail, choose expo-secure-store + origin-checked react-native-webview postMessage fallback (both Expo Go compatible). Native secure-storage bridge is intentionally not built yet. Remote Expo push on Android Expo Go may need a development build.
- H4 — No inactivity expiry implemented; inactivity-based account expiry remains a human decision as requested.
- H5 — Optional MFA/admin enrollment/recovery policy has not been selected.
- H6 — Release decision: choose the minimum client release that migrates every legacy history/list screen to bounded sync pages before retiring the old unbounded responses. Existing legacy responses stay compatible during that transition. CSP and outbound circuit-breaker changes are implemented/tested; security review against main focused on authentication, ownership, validation, logging and provider boundaries.
- H7 — Root mobile/Expo audit retains16 high findings through braces/Metro and node-forge/Expo signing. Safe lockfile fixes removed moderate uuid findings. No patched compatible upstream for node-forge was available; npm force proposes a breaking React Native downgrade. Decide the SDK/provider upgrade path before release; backend and scoped frontend audits remain0.
- Phase3 legacy retirement: leave enabled until the version floor is deployed and legacy_token_used is zero for a full7-day lifetime; then set LEGACY_AUTH_ENABLED=false. This operator switch is tested but intentionally not activated now.

## Additional Findings
- Fixed modern access tokens minting unrelated refresh families through migration, retry loss during interrupted legacy exchange, auth route case/trailing-slash throttle bypass, safety workout-owner validation, water-update races and stale encrypted document overwrites.
- Access tokens are memory-only. Refresh transport uses same-origin Next rewrite and environment cookies; deployment domains are not hardcoded.
- Queue payloads contain IDs/references only. No raw pose camera/video is stored. Nutrition bytes are transient unless explicitly uploaded to private storage; upload originals are bounded by the retention policy.
- Historical scan found44 exact false positives across141 reachable commits; no real credential confirmed. Backend and frontend dependency audits report0 vulnerabilities after updates. Deleted/unfetched Git refs and live provider secrets remain outside scanner evidence.
- Mongo production automatic index creation is disabled. Apply migrations using a separate schema identity, then run with least-privilege runtime credentials.

## Section A — Core Security Review (preset: security review against `main`)

- [N/A] Enable Row-Level Security (RLS) — enable on every table that holds user data; write explicit policies (users can only read/write their own rows); default-deny — Evidence: MongoDB has no SQL RLS. Equivalent owner filters and default-deny JWT/admin guards are covered by ownership tests and real two-user purge/sync tests.
- [x] Tighten CORS configuration — explicit allowlist of origins, no wildcard `*` with credentials, restrict methods and headers — Evidence: Explicit credentialed origin/method/header policy; cors-policy/session-cookie tests and real Next proxy browser checks.
- [N/A] Ensure parameterized SQL queries — no string-concatenated SQL anywhere; use prepared statements / ORM bindings — Evidence: No SQL. ObjectId-owned Mongoose queries and strict scalar query allowlists reject NoSQL operators; runtime-hardening + verify-runtime.
- [x] Verify email address workflows — email verification on signup, secure password-reset flow, expiring single-use tokens, no user enumeration in responses — Evidence: Email verification policy, hashed expiring transactional single-use links, neutral resend responses, password recovery; email-verification unit and real MongoDB tests. Enforcement is rollout-gated.
- [x] Store tokens securely (no localStorage for sensitive tokens) — use httpOnly + Secure + SameSite cookies on web; Keychain/Keystore-backed secure storage guidance for the mobile client — Evidence: Memory-only access, httpOnly rotating cookie, one-time localStorage cleanup; three real browser proxy tests. Android/iOS persistence remains manual.
- [x] Ensure .env files and secrets are excluded from Git — `.gitignore` updated, `.env.example` provided, scan history for leaked secrets — Evidence: Ignored private env files; examples; full reachable Git history Gitleaks scan141 commits,44 exact false-positive fingerprints reviewed; docs/security-secret-scan.md.
- [x] Validate and sanitize form and payload inputs — schema validation (e.g., Zod/Joi/Pydantic/class-validator) on every endpoint, reject unknown fields — Evidence: Global whitelist/forbid ValidationPipe, strict scanner Zod and scalar query allowlist; tests and runtime mass-assignment/operator rejection.
- [x] Enforce server-side permission checks on admin routes — never trust client-side role flags; central authorization middleware — Evidence: Server-derived current role plus RolesGuard; runtime admin403 and ownership regression tests.
- [x] Disable production debugging / stack traces — generic error responses in production, details only in server logs — Evidence: SafeExceptionFilter generic500, request ID; production docs/debug gates; runtime-hardening/openapi tests.
- [x] Keep API secrets server-side — third-party keys (AI providers, payments, email, etc.) never shipped in the mobile app or returned by the API — Evidence: Private server environment and redaction; no provider keys added to mobile/public frontend settings. Sentry browser DSN is an ingestion identifier only.
- [x] Rate-limit sensitive API endpoints — login, signup, password reset, OTP, AI/expensive endpoints — Evidence: Shared Mongo IP/account auth/verification throttles, lockout, recovery limits, bounded scanner/Coach limits; auth-throttle/coach-rate-limit tests.
- [x] Validate file upload types, extensions, and sizes — check MIME by content (magic bytes), extension allowlist, max size, randomized filenames, store outside web root / in object storage — Evidence: Magic bytes, exact byte counts and caps; private randomized image keys/signed URLs; pose spoof tests + real storage upload/cleanup tests. Camera/video persistence rejected.
- [x] Prevent sensitive data exposure in logs — redact passwords, tokens, API keys, emails/PII where appropriate — Evidence: Credentials, emails and health/contact fields redacted; HTTP logs omit raw identity/IP, persisted audit hashes IP; redaction/Sentry tests.
- [x] Use strong password hashing (bcrypt/Argon2) — with proper cost factor; migrate any weak hashes on next login — Evidence: bcrypt cost10 in registration/reset, password selected privately; authentication/recovery tests. No weak legacy hash format found.
- [N/A] Verify incoming webhook signatures — HMAC/signature verification with timing-safe comparison, replay protection (timestamp/nonce) — Evidence: No inbound webhook receiver exists; Expo receipts are polled. Add signature/replay checks before exposing any future receiver.
- [x] Mitigate XSS risks — output encoding, sanitize any user-generated HTML/markdown, set CSP header — Evidence: React escaping, no unsafe user HTML render path, API default-none and frontend CSP/headers. Frontend security-header unit/build/proxy browser checks pass. Static hydration still needs unsafe-inline; nonce rendering remains a documented hardening limit, not a claim that CSP prevents every XSS.
- [x] Flag known outdated or vulnerable dependencies — run `npm audit` / `pip-audit` / equivalent, upgrade or document each finding — Evidence: Pinned Swagger12.0.2, AWS SDK and Sentry packages; lockfile security updates. Backend and scoped frontend full audits report0 vulnerabilities.

## Section B — Additional Security Hardening

- [x] Authentication: short-lived access tokens + rotating refresh tokens, refresh-token revocation on logout/password change, token reuse detection — Evidence: 15m access, rotating hash-only refresh/reuse revocation, logout/password version invalidation; auth-sessions and real concurrency tests; legacy accepted/logged until gated retirement.
- [x] Authorization: fix IDOR/BOLA — every resource lookup must check ownership/tenancy, not just authentication — Evidence: Owner-derived resource filters; added safety workout ownership and session revocation ownership. Runtime/ownership/sync two-user tests.
- [x] Prevent mass assignment — whitelist fields accepted on create/update (no blind `req.body` spreading into models) — Evidence: Strict DTO/Zod fields, owner written from principal, role injection rejected; verify-runtime.
- [x] Brute-force protection — account lockout / exponential backoff and IP + account based throttling on auth endpoints — Evidence: Account lockout plus shared IP/email Mongo throttles; existing auth/recovery and new throttle tests.
- [x] Security headers — HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy (e.g., via Helmet or equivalent) — Evidence: Security middleware tested; HSTS activates only in production. Actual edge headers await deployment.
- [x] Enforce HTTPS/TLS everywhere; redirect HTTP → HTTPS; secure cookie flags — Evidence: Implemented, activates in production: fixed HTTPS redirect origin, HSTS and Secure cookies; environment validation tests. TLS termination/certificate is H1.
- [x] Request body size limits and timeouts on all endpoints to prevent resource exhaustion — Evidence: 128KB general JSON, explicit bounded scan/pose exceptions, server/parser/provider deadlines; runtime413 and unit tests.
- [x] SSRF protection on any endpoint that fetches user-supplied URLs (block private/internal IP ranges) — Evidence: Scanner accepts bytes, not URLs; fixed mail/Expo endpoints, storage endpoints configured by operator only. No caller-supplied URL fetch surface.
- [x] Secrets management — load secrets from environment/secret manager only; validate required env vars at startup and fail fast if missing — Evidence: Startup fail-fast checks for Mongo/JWT/cookies/versions/retention/key/provider configuration; runtime-hardening tests.
- [x] Audit logging for sensitive actions (login, password change, role change, deletes, admin actions) with user ID, IP, timestamp — Evidence: Persisted bounded audit shape with actor ID, hashed IP, UTC timestamp/request ID/status; deletion pseudonymization and12-month TTL; real privacy tests.
- [ ] Least-privilege database user and service credentials (app user cannot DROP/ALTER in production) — Evidence: Runtime production autoIndex/autoCreate disabled and migration identity documented. Actual least-privilege DB/service roles need operator verification (H1).
- [x] Safe error handling: consistent error format, no internal details leaked, correlation/request ID returned — Evidence: Compatible statusCode/message plus stable code/request_id; no unexpected internal details; safe error/runtime tests.
- [ ] Optional: MFA/OTP support for sensitive accounts/admin — Evidence: Optional MFA/admin policy remains a product decision; no MFA dependency or auth bypass added (H5).
- [x] Data privacy: ability to export and delete a user's data (account deletion endpoint), encrypt sensitive fields at rest where appropriate, minimize PII collected (aligns with the Philippine Data Privacy Act principles) — Evidence: Authenticated export, password-confirmed soft delete, grace recovery and resumable complete purge; AES-GCM health/contact fields and migrations. Real privacy/encryption tests; no legal-compliance certification implied.
- [x] Automated dependency & secret scanning in CI (e.g., Dependabot/Renovate, gitleaks/trufflehog) — Evidence: PR CI audit/full-history checksum-verified Gitleaks plus Dependabot config; scanner and audit commands passed locally. Hosted CI awaits H1.

## Section D — Data Storage & Integrity

- [x] Database constraints: NOT NULL, UNIQUE, CHECK, and foreign keys with sensible ON DELETE behavior — Evidence: Mongo schema required/enums/unique indexes and owner checks; transaction/idempotency/ownership tests; SQL foreign keys are N/A, account cleanup is explicit.
- [x] Proper data types (timestamps in UTC with timezone, numeric/decimal for precise values, enums or lookup tables) — Evidence: UTC Date fields, numeric measurement/range/unit validation and schema enums; existing domain suites and new TTL/date checks.
- [x] `created_at` / `updated_at` on all tables; soft delete where recovery matters — Evidence: Existing business models timestamps; auth/queue/audit timestamps, soft-deletion/purge state; real recovery/grace tests.
- [x] Versioned, reversible database migrations (no manual schema changes); migration run documented — Evidence: Versioned index up/down tracks only its created indexes; real repeatable rollback test. Profile encryption encrypt/decrypt migration tested twice in each direction.
- [x] Transactions around multi-step writes so data never ends up half-saved — Evidence: Password recovery and verification transactional consumption; analysis completion serialized with deletion; real Mongo tests. Multi-step purge uses resumable claim/idempotent deletes.
- [x] Idempotency keys on create/payment-like/retry-prone endpoints so retried mobile requests don't duplicate data — Evidence: Existing workout request/set/recording keys, owned meal IDs, notification IDs and job user/upload dedupe; relevant suites + job test. Unkeyed legacy operations retain documented semantics.
- [x] Concurrency safety: optimistic locking or atomic updates for counters/XP/points/streaks-type data (no race conditions) — Evidence: Atomic water-day replacement and meal positional updates; concurrent real Mongo tests; existing workout revisions/credit tests.
- [x] Automated backups + documented restore procedure; data retention policy for logs and temp data — Evidence: Encrypted backup create/restore/prune/schedule scripts; real synthetic mongodump/encrypt/restore count/value comparison and tamper test pass. Cloud schedule/roles still H1.
- [x] Seed/sample data script for dev; never run seeds in production — Evidence: Existing exercise seed script now refuses NODE_ENV=production; build/source guard reviewed.

## Section C — Performance & Speed (make the app load faster)

- [x] Add database indexes for all frequently filtered/sorted/joined columns and foreign keys; verify with `EXPLAIN`/query plans — Evidence: Owner/date progress and existing workout indexes; reversible migration. Real explain200 examined documents to20 for a20-row workout page.
- [x] Eliminate N+1 queries (eager loading / joins / batching); add a note of before/after query counts for the heaviest endpoints — Evidence: Existing batched leaderboard reads and bounded concurrent USDA lookups; projection tests. Activity reduced to scoring fields; auth user/session reads parallel (same query count2).
- [ ] Pagination on every list endpoint — prefer cursor-based pagination; enforce max page size — Evidence: Cursor-bounded workouts/catalog/progress and new sync pages1..100 exist; legacy embedded nutrition/notification/leaderboard responses are still compatibility contracts. Full legacy pagination rollout remains H6.
- [x] Field selection / slim payloads — return only the fields the mobile screen needs; avoid over-fetching — Evidence: Activity scoring projection, slim sync/dashboard fields and bounded embedded windows; tests + runtime explain.
- [x] Response compression (gzip/brotli) — Evidence: Async gzip for eligible JSON>1KB, auth excluded; decompression regression test.
- [x] Caching layer (e.g., Redis or in-memory) for hot read data with sensible TTLs and explicit invalidation on writes — Evidence: Public exercise cache30s/100 entries with in-flight dedupe; existing tests prove request2->1 and expiry. Private user responses are no-store.
- [x] HTTP caching headers: `Cache-Control`, `ETag`/`If-None-Match` (304 responses) for cacheable GET endpoints — Evidence: Public catalog Cache-Control/ETag/304 tests; authenticated data remains no-store.
- [x] Database connection pooling configured and tuned — Evidence: Bounded maxpool20 default, min0, idle/server-selection/socket deadlines; startup validation and actual DB runtime/load checks.
- [x] Move slow/expensive work (AI generation, image/video processing, emails, notifications, analytics) to background jobs/queues; API returns quickly with a job/status endpoint or push update — Evidence: Durable reference-only nutrition analysis202/status endpoints plus push and purge workers; existing synchronous clients retained. Real job tests cover dedupe, ownership and deletion-race safety.
- [x] Batch/aggregate endpoints so the mobile app can load a screen in 1 request instead of many — Evidence: /api/sync/dashboard parallel bounded screen reads and /sync/snapshots; real owned sync test.
- [x] Media/file delivery via object storage + CDN, with image resizing/optimization and signed URLs — Evidence: Private R2/local signed delivery, HMAC-authenticated CDN Worker, object-first TTL cleanup and browser image optimization are tested. Real edge deployment is H2; private buckets stay private.
- [x] Timeouts, retries with exponential backoff + jitter, and circuit breakers for all outbound calls to third-party services/AI providers — Evidence: Bounded per-origin five-failure/30s circuit for HTTP adapters, Gemini SDK and storage SDK; half-open recovery test, redirect rejection, existing bounded retries/jitter. SDK/HTTP deadlines enforced; non-idempotent sends are not blindly retried. Per-process circuit state needs edge coordination when scaling.
- [x] Optimize heavy endpoints: profile the top slowest routes and fix them; record before/after timings in `checklist.md` — Evidence: Synthetic before/after reports below; medians improved but tails worsened. No causal overall speed claim; query-plan improvement independently verified.
- [x] Use async/non-blocking I/O correctly; remove blocking calls from request handlers — Evidence: Async HTTP/gzip/database/bcrypt and streamed backup I/O; bounded image buffers. Build/load/runtime tests passed.
- [x] Load test key endpoints (k6/Locust/autocannon/equivalent) and record p50/p95/p99 latency and throughput — Evidence: scripts/load-test.mjs real isolated Nest/Mongo workload; docs/backend-load-test*.json records p50/p95/p99 and throughput. Production load is H1.

## Section E — Mobile-Specific Backend Features

- [x] API versioning and a minimum-supported-app-version check (force-update response for outdated clients) — Evidence: Compatibility /api and /api/v1 routes; environment version floor426; runtime tests including explicit gated legacy retirement. Floor not activated in development.
- [x] Consistent response envelope and error codes the mobile app can handle predictably — Evidence: Compatible success shapes, statusCode/message/error code/request_id; scanner envelope retained; runtime tests.
- [x] Offline-friendly sync support: delta/"updated since" endpoints, conflict handling (last-write-wins or versioned), idempotent writes — Evidence: Owner-bound signed updated-since cursor + full inventory reconciliation, replaceable singleton snapshots and existing revision/idempotent writes; real sync test. No automatic offline-write replay.
- [x] Push notification backend (FCM/APNs) with device token registration, rotation, and cleanup of invalid tokens — Evidence: Expo/dry-run adapters, authenticated token registration/rotation/revoke, receipt polling and DeviceNotRegistered cleanup;9 adapter tests. Physical delivery remains H3.
- [x] Device/session management: list active sessions, revoke a device, logout-all — Evidence: Owned active-session list/revoke/logout-all; session tests and real browser revocation checks.
- [x] Remote config / feature flags endpoint so features can be toggled without an app update — Evidence: /api/config provides minimum version and auth rollout flags; actual runtime both versioned/unversioned checks.
- [x] Secure file/media upload flow for mobile (pre-signed URLs, size/type limits, resumable for large files) — Evidence: Private presigned image create/complete/download flow,5MB bound/content validation and cleanup; real local HTTP tests. Large video/resumable transfer N/A: camera/video persistence prohibited.
- [x] Graceful handling of poor networks: small payloads, sensible timeouts, retry-safe endpoints — Evidence: Client deadlines, single-flight refresh, retry-safe existing workout/meal contracts and generation protection;140 frontend +29 mobile tests, proxy browser checks.

## Section F — Reliability, Observability & DevOps

- [x] Health and readiness endpoints (`/health`, `/ready`) checking DB/cache/queue — Evidence: /health live, /ready bounded DB ping; queues/cache use same Mongo or in-process memory. Real compiled app probe passes.
- [x] Graceful shutdown (finish in-flight requests, close DB/queue connections) — Evidence: Nest shutdown hooks close HTTP/DB; workers stop timers, queue claims/leases permit recovery. Runtime fixture starts/closes successfully; process-kill chaos testing unverified.
- [x] Structured JSON logging with request/correlation IDs; log levels per environment — Evidence: Pino JSON structured request IDs and env levels; serialization/redaction tests and runtime header checks.
- [x] Error tracking (e.g., Sentry) and basic metrics (request rate, error rate, latency, queue depth) — Evidence: Optional scrubbed Sentry Nest/Next, disabled without DSN; protected per-process HTTP/queue metrics; scrubber tests. Real staging ingestion is H1.
- [x] Centralized config per environment (dev/staging/prod) with validation — Evidence: Environment validation including production encryption/cookie/origin/provider gates; example-contract tests and build.
- [x] OpenAPI/Swagger documentation kept in sync with the endpoints — Evidence: F6: pinned @nestjs/swagger12.0.2, CLI DTO plugin, bearer/refresh/error docs. npm run docs:export generates ignored openapi.json (CI artifact); /docs gated dev/test flag, production404 tests pass.
- [x] Test suite: unit tests for business logic, integration tests for auth/permissions/validation, and a smoke test for critical flows — Evidence: 499 backend unit tests; isolated real Mongo privacy/auth/encryption/storage/sync/jobs/migration tests; actual app smoke and3 browser proxy tests. Deployment/device checks explicitly separate.
- [x] CI pipeline running lint, tests, dependency audit, and secret scan on every PR — Evidence: PR lint/test/build/audit/full-history secret scan and OpenAPI artifact workflow implemented; local constituent checks pass. Hosted run H1.
- [x] Dockerfile / deploy config reviewed: non-root user, minimal image, no secrets baked in — Evidence: Non-root node24 runtime, minimal multistage Docker image, no env baked in, healthcheck; config reviewed. Daemon unavailable so image build/run remains H1.
- [x] README updated: how to set up env, run migrations, run tests, and deploy — Evidence: README links operations; OPERATIONS/PROVIDERS/OPENAPI/PROFILE-ENCRYPTION/PUSH describe setup, migrations, checks and deploy obligations.

## Privacy & Retention

| Environment variable | Default | Implemented behavior |
| --- | --- | --- |
| ACCOUNT_DELETION_GRACE_DAYS |30 days | Immediate inactive/session-version revocation; password recovery only before deadline and purge claim; resumable all-collection owner/subject purge incl emergency contacts and external objects. |
| MEDIA_ORIGINAL_TTL_HOURS |24 hours | Nutrition originals after analysis; object-first cleanup, no metadata TTL that could orphan bytes. |
| ORPHAN_UPLOAD_TTL_HOURS |24 hours | Pending/failed/unreferenced upload object cleanup. |
| COMPLETED_JOB_TTL_HOURS |24 hours | Completed purge/push/analysis records and analysis results. |
| FAILED_JOB_TTL_DAYS |7 days | Failed job status records; bounded generic errors only. |
| AUDIT_LOG_HOT_DAYS |90 days | Scheduled transition to cold-tagged audit records; same Mongo collection, no separate archival service. |
| AUDIT_LOG_RETENTION_MONTHS |12 months | Calendar-month expiry, TTL plus scheduled sweep; pseudonymize actor IDs/remove IP hashes at purge, keep idempotent deletion event. |
| REFRESH_TOKEN_RECORD_BUFFER_DAYS |30 days after expiry | purgeAt TTL preserves expired family reuse evidence without extending authentication validity. |
| BACKUP_RETENTION_DAYS |35 days maximum | Encrypted local/R2 backup prune; deleted data may remain until rolloff. Reapply deletion after restoring older backups. |

Capstone text: Active accounts' health data has no independent expiry. Account deletion immediately blocks sign-in and revokes sessions, permits password-authenticated recovery for30 days, then irreversibly purges owned health, workout, nutrition, emergency-contact and provider-reference data. Raw pose camera frames and videos are never retained. Sensitive profile health/contact fields use owner-bound AES-256-GCM with a private deployment key; exports decrypt them for the authenticated owner. Queue payloads contain references only; logs exclude health data and raw PII. Audit actors are pseudonymized on purge, and encrypted backups roll off within35 days. These are implemented privacy controls, not a legal-compliance certification or proof of cloud-provider configuration.

## Measured local performance

10 concurrent clients,200 measured read requests per route, synthetic isolated database; milliseconds. Full reports retain throughput and timestamp/environment details.

| Route | Before p50/p95/p99 | After p50/p95/p99 | After req/s |
| --- | --- | --- | --- |
| Legacy auth/me |47.99 /315.05 /610.81 |31.87 /239.63 /744.96 |132.83 |
| Rotating auth/me |91.90 /671.61 /687.88 |51.29 /801.73 /1054.39 |55.03 |
| Workouts |139.73 /732.70 /745.37 |95.96 /786.20 /793.83 |42.91 |
| Nutrition |137.71 /735.28 /740.61 |91.51 /792.62 /807.17 |42.15 |

Medians improved while tails generally worsened; variable DB/network runs do not prove a general latency improvement. The controlled query plan separately reduced examined workout documents200->20 for the same20-row page. These are development measurements, not production capacity claims.

Final implementation rerun: `docs/backend-load-test-final.json` — legacy43.37/66.14/632.08ms at143.57req/s; modern52.26/797.85/857.78ms at52.53req/s; workouts90.26/806.81/831.67ms at42.87req/s; nutrition92.73/796.68/831.68ms at39.50req/s. Same10-client/200-request setup. `/health`, `/ready` and `/api/config` also passed the standalone readiness script against the isolated compiled application.

## Final Summary

Implementation is locally functional but the entire overhaul is not certified complete: H1-H7 remain explicit. Preserve legacy compatibility until the release gate. Native cookie persistence/cloud-provider delivery and production readiness require the listed evidence.

Verified commands: backend `rtk npm test` (66 files/499 tests), `rtk npm run lint`, `rtk npm run build`, `rtk npm audit` (0); frontend `rtk npm run build`, `rtk proxy node --test tests/*.test.mjs` (142), scoped audit0; root `rtk proxy node --test mobile/*.test.mjs` (29), mobile `rtk npx tsc --noEmit`; frontend Playwright session proxy suite (3). Full opt-in integration suite:11 files/16 tests passed. Real Mongo tests include session races, nutrition concurrency, migrations, privacy, profile encryption, storage, verification, sync and reference-only jobs. Run backend `PQ_SECURITY_DB_TEST=1 rtk npm run test:e2e` with the PowerShell environment syntax documented in operations; recovery transactions additionally use PQ_RECOVERY_DB_TEST=1.

Operational commands from backend: `node scripts/verify-runtime.mjs`, `node scripts/readiness-check.mjs`, `node scripts/load-test.mjs --isolated`, `npm run docs:export`, `node scripts/migrate.mjs plan|up|down`, `node scripts/migrate-profile-encryption.mjs encrypt|decrypt`, `node scripts/verify-backup.mjs` (official MongoDB tools on PATH). Generated openapi.json is ignored and exported in CI, not committed. Keep all private keys in deployment secrets and retain encryption keys for restores.
