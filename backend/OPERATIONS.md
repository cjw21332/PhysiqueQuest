# Backend hardening operations

## Verify email in development

Existing accounts retain access while their email is unverified; dismissing the floating reminder does not mark an address verified. Open **Verify your email**, request a message, open its link, then press **Confirm email**. Successful confirmation refreshes the session and removes the reminder.

The `console` mail adapter captures messages in memory for tests; it does not deliver to Gmail or expose an inbox. A missing provider also cannot deliver mail. To verify locally:

1. Start Docker Desktop's engine and run `docker run -d --name physiquequest-mailpit -p 127.0.0.1:8025:8025 axllent/mailpit` (for an existing container, use `docker start physiquequest-mailpit`). The inbox is bound to the development PC only.
2. In the backend's private `.env`, set `MAIL_PROVIDER=mailpit`, `MAILPIT_URL=http://127.0.0.1:8025`, and `EMAIL_VERIFICATION_URL` to the frontend origin. Use `http://localhost:3000` for PC-only verification; use the frontend's LAN/tunnel origin for links opened on a phone. Restart the backend after environment changes.
3. Request verification in the app. Open `http://127.0.0.1:8025` on the PC, open the captured email, follow its link and press **Confirm email**. Links expire after `EMAIL_VERIFICATION_TTL_MINUTES` (default 60); requests are limited to one per address per minute.

Mailpit is a local inbox and does not deliver to real email accounts. For real inbox delivery, set `MAIL_PROVIDER=resend` or `brevo`, supply `MAIL_API_KEY` and a provider-verified `MAIL_FROM`, and set `EMAIL_VERIFICATION_URL` to the deployed frontend origin. No verification bypass or raw-token inbox endpoint is provided.

Development is the only established environment. Production checks below are runnable preparation, not a claim of deployment verification.

## Authentication rollout

The shipped `/api/auth/login` and `/api/auth/register` contracts continue returning legacy bearer tokens (at most seven days). New clients use `/api/auth/session/login` and `/api/auth/session/register`: a 900-second access token in JSON and an opaque 30-day refresh credential exclusively in an httpOnly cookie. Refresh is `POST /api/auth/session/refresh` with JSON `{}` and credentials included; each success rotates the cookie atomically. Refresh replay revokes that family, including its access tokens. Password changes increment the user's session version and invalidate both access and refresh credentials. Logout revokes the current family; legacy logout and logout-all increment the user version. `/api/auth/sessions` lists at most 100 active sessions without token hashes; `DELETE /api/auth/sessions/:id` revokes only an owned session.

The refresh family has an absolute 30-day expiry, not a sliding server expiry. Its consumed hashes remain for replay detection until expiry plus REFRESH_TOKEN_RECORD_BUFFER_DAYS (default30); a family is retired after 10,000 rotations to bound document growth. A lost refresh response can require signing in again if the old cookie is replayed. The client deduplicates refreshes and uses Web Locks across browser tabs where supported. Do not automatically retry timed-out refresh requests.

The one-time `/api/auth/session/migrate` exchange accepts validated legacy credentials only. Modern access credentials cannot create another independent refresh family. The client removes the old localStorage token immediately and retains it only in memory while a migration request needs retrying. New access credentials live only in memory. Session generation checks protect account switches and pending responses.

`legacy_token_used` log events reveal remaining legacy traffic without logging token values. Keep `LEGACY_AUTH_ENABLED=true` until a released minimum app version is enforced and legacy usage has been zero for a full legacy-token lifetime. Only then set `MIN_APP_VERSION`, `REQUIRE_APP_VERSION=true`, and `LEGACY_AUTH_ENABLED=false`. Startup rejects disabling legacy authentication without the version gate. This final switch has NOT been activated. Version headers are a client compatibility signal, not an authorization mechanism.

## One-origin web and Expo configuration

Copy backend/.env.example privately; do not put credentials in public Expo or Next settings. Next's server-only `BACKEND_URL` defaults to the local Nest server. Its rewrite sends `/api/*` to Nest, including Cookie and Set-Cookie headers. Browser API URLs default to the page's origin, and the mobile host injects that same origin. Explicit historical API overrides remain supported, but cross-site overrides require a deliberate HTTPS cookie/CORS setup.

Development:
- `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax`, `COOKIE_DOMAIN` unset.
- `CORS_ALLOWED_ORIGINS`: exact localhost/LAN/tunnel frontend origins. Dev additionally allows private LAN HTTP hosts on port 3000; a tunnel or alternate port must be explicit.
- `TRUST_PROXY=1` for exactly one trusted Next proxy; 0 for direct API access. Do not expose the Nest port publicly when trusting a Next proxy.
- Next development resources allow any IPv4 address, including changing LAN and emulator addresses. Set `DEV_ALLOWED_ORIGINS` for additional tunnel hostnames or IPv6 hosts (no scheme/port). Restart the dev server after configuration changes; keep it on a trusted network.
- Expo's optional web address can be a LAN IP, Android emulator address, or tunnel. The default API stays on that frontend origin. Do not configure a separate direct API address unless testing that fallback deliberately.

Production — implemented, activates in production:
- Set `NODE_ENV=production`, a random JWT_SECRET of at least 32 characters, MONGODB_URI, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, final CORS_ALLOWED_ORIGINS and API_PUBLIC_URL. API_PUBLIC_URL is the public HTTPS origin serving `/api` (normally the Next site with this proxy).
- Keep COOKIE_DOMAIN unset for a host-only cookie unless an explicit domain-sharing requirement exists. `SameSite=None` requires secure HTTPS cookies.
- Terminate TLS at the trusted proxy, forward its actual protocol, configure the exact TRUST_PROXY hop count, and restrict direct access to Nest. Insecure requests redirect to the configured public origin; HSTS and the other security headers activate automatically. Confirm HTTPS and proxy settings with a real deployment before release.
- Set NEXT_PUBLIC_APP_VERSION to the web release version before turning on the version floor. The native host supplies its Expo app version to the shared client. Update native version numbers before releasing a new minimum native version.
- Select a least-privilege MongoDB credential confined to the application database. Production database roles, storage encryption, backup scheduling and restore capability must be verified in the hosting account; local tests do not establish those properties.

## Tests and operational probes

From backend/:
```
rtk npm test
rtk npm run lint
rtk npm run build
rtk npm audit
rtk npm run test:e2e
rtk proxy node scripts/load-test.mjs --isolated
rtk proxy node scripts/verify-runtime.mjs
rtk proxy node scripts/readiness-check.mjs
```

Set `PQ_SECURITY_DB_TEST=1` to opt into session/concurrency tests in `test:e2e`, and `PQ_RECOVERY_DB_TEST=1` for recovery transactions. These create randomized `pq_security_test_*` or `pq_recovery_test_*` databases and only drop a database after checking the exact generated name. Never point tests at a production credential. The isolated harness disables paid analysis/delivery providers and uses a random signing key.

For staging load tests, set LOAD_TEST_URL to the server origin and LOAD_TEST_TOKEN privately to a synthetic account's access token. LOAD_TEST_CONCURRENCY defaults to 10; LOAD_TEST_REQUESTS defaults to 200 per read-only route. LOAD_TEST_REPORT optionally writes a sanitized JSON report. Use READINESS_URL for the health/readiness probe. Do not put credentials in CLI arguments, scripts or committed reports. Requests have explicit deadlines. Baseline and subsequent run reports are in docs/backend-load-test*.json; these are small synthetic workloads with variable database/network latency, not production capacity certification.

`/health` is liveness; `/ready` checks connected DB state and a bounded ping. `/api/admin/metrics` is protected by the current server-side admin role and supplies per-process request counts, 5xx counts and latency summaries. Structured completion/audit logs carry correlation IDs; client bodies and credentials are not logged. Auth rates use shared MongoDB buckets; public Coach/scanner limits are per process and need shared edge enforcement before scaling replicas.

Docker: build from backend/ with `docker build -t physiquequest-api .`; pass secrets at runtime through the deployment secret store. The image uses a non-root runtime user, excludes .env files and exposes a liveness probe. Docker execution was not verified because the local daemon was unavailable. CI configuration runs lint, unit tests, build, a full dependency audit and a checksum-verified full-history Gitleaks scan on PRs. Run the actual hosted pipeline before relying on it.

## Manual Android and iOS WebView checks

These are unverified on physical devices. On each platform:
1. Set the LAN/tunnel frontend origin and CORS/dev host settings above; start Nest and Next. Open the frontend in Expo Go and sign in with a synthetic account.
2. Confirm the WebView's API requests use its own `/api` origin. Verify the refresh cookie is httpOnly, SameSite=Lax, host-only, and Secure according to the environment. Inspect without copying its value into reports.
3. Confirm no access/refresh token appears in localStorage or sessionStorage. The old physiquequest-auth key should disappear after migration.
4. Reload, background/foreground, and fully close/reopen Expo Go. Confirm a valid refresh cookie restores the account; wait over 15 minutes and confirm a protected read silently refreshes.
5. Log out and reopen. Confirm refresh returns 401 and protected pages do not reappear. Repeat with password change and logout-all on a second session.
6. Interrupt the network during refresh and during legacy migration. Confirm an honest retry/sign-in state, no duplicated writes and no false save/delivery confirmation.
7. Confirm navigation/native messages remain restricted to the configured frontend origin. Test a tunnel and Android emulator separately.

The real desktop browser tests verify forwarding, httpOnly visibility, reload rotation, replay rejection and legacy cleanup through the actual Next/Nest proxy. They do NOT prove Android/iOS cookie persistence. If cookies fail the device checks, decide whether to add expo-secure-store plus an origin-checked postMessage bridge. That bridge has not been implemented.

## Backup, retention and restore preparation

New auth/progress indexes have a versioned migration. From backend/, inspect `rtk proxy node scripts/migrate.mjs plan`, apply `rtk proxy node scripts/migrate.mjs up` with the intended database environment, and use `down` to roll back only indexes created by this migration. Back up and confirm the target privately before applying it outside development. The runner never rewrites user documents or drops collections. An interrupted migration deliberately requires review; do not delete its ledger entry blindly. Existing automatic Mongoose indexes remain a legacy deployment consideration; choose a separate migration credential and restrict runtime schema-management permissions before production.

The approved retention policy is documented in root checklist.md and PROVIDERS.md. Choose recovery-point/recovery-time targets before production. Use the managed database backup service or a scheduled encrypted `mongodump`; store credentials through a secret manager and keep backups separate from the application identity. Restore into an isolated database, run `/ready` and critical-flow smoke checks, then compare record counts and ownership before changing application connection settings. Do not run restore or pruning against the application's live database. Provider scheduling, encryption keys, backup access restrictions and an observed restore exercise remain operator work; no production backup was created or certified by this task.
