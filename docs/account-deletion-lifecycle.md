# Account lifecycle protection — 2026-11-15

Real existing accounts have **not** been migrated. Startup now rejects standalone MongoDB and unmigrated accounts. This implementation is not yet a fully verified global deletion guarantee. Earlier phase notes are preserved in `account-deletion-lifecycle-history.md`; they are historical, not the current status.

## Protocol and state machine

Every ordinary protected mutation conditionally increments `account_lifecycle.writeVersion` on an existing active row in the same MongoDB transaction/session as its actual persistence. Missing, deleting, deleted, and mismatched-generation rows reject the transaction. There is no standalone fallback. Provider calls stay outside retryable transactions.

Email/password and Google registration insert the user and lifecycle row atomically. Missing generation on an existing active lifecycle row means generation zero for compatibility; missing lifecycle rows are never provisioned by ordinary writers.

Authenticated HTTP requests carry their entry generation through an AsyncLocalStorage interceptor. This only transports the expected version; MongoDB performs enforcement. Long-lived scans, usage reservations, jobs, uploads, recovery/verification tokens and reminder schedules also capture their own generation. Recovery cannot make old work valid again.

- `active → deleting`: lifecycle transition, user deactivation, session-version increment, session revocation and recovery-token removal commit together. Repeated password-validated requests return the original deadline.
- `deleting → active`: allowed only within grace and before purge claiming. User and lifecycle change together and generation increments again.
- Purge claiming writes the deleting lifecycle record and `purgingAt` together, serializing with recovery. Crashes leave ordinary writers blocked. The worker rediscovers due users and retries idempotent steps.
- Purge deletes external objects before metadata, deletes owner/subject documents across collections, and verifies absence. Operational audit, deletion queue, lifecycle and owner-free cleanup records are intentionally separate.
- `deleting → deleted`: the permanent minimal lifecycle tombstone and user removal commit together. Recovery is no longer supported.

## Writer coverage

The exact source mutation inventory is [account-lifecycle-writer-inventory.md](account-lifecycle-writer-inventory.md). Regenerate from `backend` with `rtk proxy node scripts/audit-lifecycle-writers.cjs`. Lexical inventory and review classifications are not automatic proof.

Integrated ordinary writers cover nutrition/receipts, scanner usage/reconciliation, scanner/chat/pose quotas, analysis jobs, upload metadata, workouts/sets/recordings, progress, settings, profiles/photos, activity, coaching plans, leaderboard snapshots, notifications/reminders, push devices/deliveries, safety records, sign-ins/sessions, Google linking, email verification and password recovery.

Exceptions: public pre-account registration codes and abuse/IP buckets; shared administrator exercise/pose catalogs; owner-free cleanup receipts; pseudonymized operational audit; and deletion-authorized purge/TTL maintenance. These are not ordinary active-account writes. Public registration records expire. Shared catalog attribution is not ownership of the catalog item.

## Usage and background work

Usage reservation IDs remain user/request-idempotent. Reservation, completion and bounded reconciliation share the lifecycle session and validate original generation. Unknown usage stays unknown. Missing-generation work is quarantined, never assigned today's generation. Reconciliation failures are logged and retried.

Quota buckets persist in MongoDB. User buckets carry ownership for purge; IP buckets remain shared abuse controls. Mutations are fenced and missing stores fail closed.

Analysis job persistence is the durable queue; no second queue/outbox was added. Candidate selection filters current active generations, followed by transaction revalidation at claim. Completion writes upload status, user timestamp, result and job completion together. Failure and expiration are fenced. Expired running jobs become interrupted failures rather than replaying ambiguous paid work. Legacy/stale jobs are excluded from dispatch; purge removes them or operators review active-account legacy work.

Push deliveries retain generation. Claims, completion, receipt/retry and device updates are fenced. A crashed `sending` job becomes `outcome-unknown`, never an automatic resend. Receipt polling does not send another notification. An externally accepted send cannot be recalled by MongoDB.

## Uploads and external cleanup

Upload creation atomically stores metadata and a random-key owner-free cleanup receipt. Verification checks generation after reading bytes. Analysis marking joins the result transaction. Local upload completion rechecks after file creation and compensates on invalidation. Metadata sweeps are fenced; account purge cleanup is deletion-authorized.

Cleanup receipts survive metadata removal and are backfilled for legacy objects during purge. Repeated idempotent deletion catches delayed signed PUTs after the first deletion. Receipts currently remain indefinitely and reschedule hourly: monitor growth. This is **eventual external cleanup**, not atomic external erasure.

S3 versioned buckets require an explicit historical-version purge policy; `DeleteObject` alone does not establish version erasure. No live S3/versioned-bucket verification occurred. A release promising immediate complete erasure requires verified bucket retention/versioning and upload-expiry controls. Emails, push messages and safety alerts already accepted by providers cannot be recalled.

## Startup, migration and deployment

Before listening and scheduled module startup, `createApplication` validates connectivity, replica-set/mongos topology, sessions, required lifecycle/job/cleanup indexes, missing/inconsistent lifecycle rows, and an actual aborted transaction write. A read-only probe against local standalone port 27017 confirmed rejection. Tests use a separate replica set on 27181.

Stop all application instances, workers, registration and external writers; take a backup; run `rtk proxy node scripts/audit-account-lifecycle.mjs` with an explicitly named database. Dry-run is default. Review conflicting/failed accounts and legacy work counts. Apply requires `--apply --maintenance-confirmed`; this flag does not stop writers. Apply is restartable, preserves tombstones, and creates generation-zero/schema-version-one rows only for unambiguous active accounts. It never assigns current generations to legacy work. Re-run the audit and startup check before traffic.

**No real account migration was run.** Do not roll back to older unprotected writers while deletion is enabled. Keep traffic stopped on rollout failure, retain tombstones, inspect migration evidence and fix forward. Backup restoration requires a separately controlled procedure.

## Evidence and release blockers

See [account-lifecycle-verification.md](account-lifecycle-verification.md) for commands and counts. Tests use guarded random databases on MongoDB 8.3 replica set `pqtest`. Providers are synthetic except local filesystem storage. No live Gemini, USDA, email, Expo or S3 validation is claimed.

Independent processes test writer/deletion, worker/deletion, duplicate usage and stale work after recovery. Deterministic process deaths now cover: inside the deletion transition (transaction rollback), the purge external-cleanup boundary, after audit pseudonymization, inside the final tombstone/user transaction, after each individual purge-collection deletion (`settings`, `progress_entries`, `notifications`, `push_devices`), during provider work, after job completion, and at the external file-creation boundary (a real local object is written, then the process exits before the lifecycle recheck). Restarted workers finalize the tombstone, remove the object and never replay a paid provider call. Barriers, transaction rollback/transient retry, interrupted-job restart state, late upload verification and cleanup retries are also covered.

Remaining release blockers: real-account migration; production transaction topology; coordinated replacement of old writers; verified external object/version cleanup (S3 versioning is untested); real-database race coverage for the leaderboard snapshot writer; monitoring/retention for quarantined work and cleanup receipts; `scripts/delete-user.ts` bypass (data resurrection risk). Do not deploy account deletion as a proven global guarantee yet. Exact commands and results are in [account-lifecycle-verification.md](account-lifecycle-verification.md).
