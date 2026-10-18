# Account-bound password changes — October 18, 2026

The Me page previously reused the public Forgot Password modal and accepted an arbitrary email destination. Public recovery correctly targeted the account owning that address, but it was the wrong flow for changing the currently signed-in account's password.

Me now opens an authenticated change mode. It loads the canonical account email through `/auth/me` and displays it read-only. Code requests submit no email or user ID. The server looks up the active account from the authenticated user ID and sends only to that stored email. Profile-cache values and email claims from an older JWT do not select the destination.

Dedicated JWT-protected routes are `POST /api/auth/password-change/request`, `/verify` and `/confirm`. The request DTO rejects a supplied destination email, and global whitelist validation rejects extra account selectors. Verification and confirmation require the same account, `password-change` purpose, stored email snapshot and session version. Another user's code/grant, a public-recovery grant, or a grant issued before an email/password-version change cannot authorize this operation. The public signed-out recovery routes remain available and cannot exchange change-flow grants.

The existing request-bound code digests, expiration, attempt caps, cooldowns, shared limits, transaction and single-use grant consumption are retained. Successful changes atomically update only the owning user's password and increment sessionVersion, revoking older JWTs. The success action clears the browser's auth data and returns directly to sign-in. Authenticated changes require working email delivery even in development; there is no development-code response shortcut in that flow.

`password_recovery_tokens` gains `purpose`, `accountEmail` and `sessionVersion` fields; no new collection is added. Legacy public recovery records remain usable only through the existing public recovery path. Legacy users without a stored sessionVersion are handled as version zero, including in MongoDB update filters.

## Verification

Coverage includes malicious destination/account payloads; login requirements at all three endpoints; two-account isolation; cross-purpose code/grant rejection; stale email/session-version rejection; single-use behavior; email-provider unavailability; legacy version-zero users; current database email versus stale JWT email; and the Me-page read-only email/OTP/password/sign-in flow. Database checks use a randomly named isolated test database, mocked email delivery, and guarded cleanup. No email was sent to a real mailbox and no real user password was changed by the checks.

Execution logs are local `artifacts/password-change-*`. This change requires restarting/rebuilding the local backend/frontend, or deploying both updated services; it has not changed any live deployment.

Passed: 370 backend tests across 47 files, 202 frontend/mobile checks, 58 browser checks, two real MongoDB transaction tests on an isolated synthetic database, both production builds, frontend/backend lint and Git whitespace checks. The full browser suite covers both signed-out recovery and signed-in changes.
