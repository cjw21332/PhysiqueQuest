# Account deletion: unresolved concurrency risk

**Production blocker:** deletion is not yet fenced against all work that was
authenticated before the account was deactivated. Do not treat purge completion
as proof that user-owned records cannot reappear.

Previously, `requestDeletion` marked the user inactive without fencing nutrition
writes. A scan save awaiting USDA could then upsert a nutrition document after
purge. The nutrition slice below now fences this specific interleaving, but
other writers can still recreate user-owned data. Checking the user before an
upsert, or deleting a document again afterward, does not close that race.

Usage completion and reconciliation update existing records without upsert,
but this does not establish a cross-collection lifecycle guarantee. Analysis
job finalization already uses a MongoDB transaction and active-user write;
job creation and other user-owned writes also need a complete concurrency
review. Provider cancellation alone cannot guarantee deletion safety.

The inspected local MongoDB reports neither a replica-set name nor a mongos;
it is standalone. Multi-document transaction support must be established for
the actual deployment before depending on transactions. A safe design needs a
shared lifecycle fence that participates atomically in every relevant write,
including retries, together with purge ordering and crash recovery. A standalone
alternative must prove equivalent behavior across processes and collections;
process-local locks and a separate account lookup are insufficient. Avoid
deploying a partial fence as though it covers the whole account lifecycle.

Before release, add deterministic real-MongoDB interleaving tests for saves,
provider completions, job enqueue/finalization, usage updates, reconciliation,
concurrent purges and stale lifecycle versions. Verify that no user-owned
documents reappear and that recovery during the grace period remains correct.

## Writer inventory and migration constraints

This inventory covers production code paths found by searching the repository;
tests and direct database administration are not application writers.

| Operation | Collection | Write behavior and deletion exposure |
| --- | --- | --- |
| Nutrition `get`, manual meal, plan, water | `nutrition` | Upserts inside the active lifecycle transaction with the same session. Existing users require lifecycle migration. |
| Scan meal save with receipt | `nutrition` | USDA lookup outside transaction; receipt lookup and meal/receipt writes use the lifecycle transaction session. |
| Scan meal save without receipt | `nutrition` | Upserts meal rows inside the lifecycle transaction after USDA verification. |
| Edit/delete meal | `nutrition` | Updates an existing document in the lifecycle transaction. |
| Scan usage reservation | `food_scan_usage` | Captures lifecycle generation and inserts in a fenced transaction using its session. |
| Scan usage completion | `food_scan_usage` | Uses the stored generation and a fenced transaction; missing/legacy reservations fail closed. |
| Usage maintenance | `food_scan_usage` | Global reconciliation and retention updates remain unfenced. |
| Analysis enqueue | `analysis_jobs` | Checks upload externally, then inserts under the captured generation in a fenced transaction. |
| Analysis completion | `users`, `analysis_jobs`, `analysis_results` | Uses a generation-checked fence and shared transaction session; worker claim, failure handling, and upload marking remain unprotected. |
| Upload creation | `storage_uploads` | Inserts a user-owned upload record; it also needs lifecycle coordination with object deletion. |
| Upload verification and analysis marking | `storage_uploads` | Update existing records without upsert; storage-provider operations can still overlap deletion. |
| Account purge | all user-owned collections | Deletes records one collection at a time, then deletes the user; this is not atomic with any concurrent insert or upsert. |

Chat and leaderboard use nutrition for reads; `NutritionService` is the
application writer found for the nutrition collection. This inventory does not
establish safety for other features' user-owned collections.

The follow-up search also found user-associated writes in `activity`, `auth`
(sessions, sign-ins, verification and recovery), `coach`, `workouts`, `push`,
`notifications`, `progress`, `settings`, `safety`, `profile`, and leaderboard
services. These paths have not been converted to the lifecycle fence. Some
update existing documents and others insert or upsert; ownership, asynchronous
callbacks, cleanup workers, and storage side effects must each be audited in
context before a complete writer count or protection claim can be made.

An active/deleting flag on nutrition alone is insufficient if purge removes
the document and any stale path can upsert it again. Retaining a tombstone
indefinitely changes the requested no-nutrition-document-after-purge behavior,
and it still does not fence usage, job, and storage inserts. Removing upserts
requires safely provisioning every legacy and new account without a separate
check-then-insert race, handling recoverable deletion and crashes, and ensuring
all deployed writers obey the new protocol. Moving data into a shared atomic
document requires a compatibility migration, size-limit assessment, and a
coordinated deployment; it does not automatically solve object storage or
other collections. No such migration or application-wide fence has been implemented.

## Replica-set prototype (not integrated)

`AccountLifecycleFence` conditionally writes an existing active lifecycle
record in the same transaction as a caller's database mutation; it rejects a
missing or non-active record. Its deletion transition writes that same record,
so MongoDB write conflicts serialize a participating writer and transition.
Transaction callbacks can be retried and must contain no external side effects.
The primitive is registered in PrivacyModule. Nutrition writes now use it;
the actual deletion transition writes the same lifecycle record in its own
transaction. Other writers remain unprotected.

A separate local MongoDB 8.3 single-node replica set was initialized on port
27181, leaving the existing standalone instance unchanged. The isolated test
database exercises missing/deleting rejection, a forced snapshot conflict, and
transaction commit/rollback. These are primitive tests only: they do not prove
application deletion safety, cleanup recovery, or protection of any existing
writer. Run them against an initialized test replica set with
`PQ_TEST_REPLICA_URI=mongodb://127.0.0.1:27181/?replicaSet=pqtest` and the
backend e2e test runner. Never point destructive test cleanup at a production
database; the test restricts cleanup to its randomly named test database.

Remaining implementation includes restartable legacy migration, exhaustive
writer conversion, external object cleanup, startup topology checks, and the
required crash and process-race tests.

## Migration audit tooling (not an activation of the fence)

`backend/scripts/audit-account-lifecycle.mjs` defaults to a read-only audit.
With `MONGODB_URI` pointing to an explicitly named database, run it using
`node scripts/audit-account-lifecycle.mjs`. It reports aggregate counts without
printing user information. It treats missing lifecycle fields and inactive,
deleting, or otherwise ambiguous accounts as conflicts for manual review.
Existing tombstones are never overwritten.

The optional `--apply --maintenance-confirmed` mode inserts active records only
for unambiguous active users and is restartable. The flag is an operator's
assertion, not an enforcement mechanism: **all application instances, workers,
registration, and other writers must actually be stopped** throughout the
operation. Do not run apply during normal service. This tool is preparatory;
running it does not make deletion safe, does not handle ambiguous users, and
does not enable the transaction fence. Review conflicts and test the complete
deployment and rollback procedure before any real migration.

The isolated replica-set migration test verified dry-run behavior, repeat
application, ambiguous-user reporting, and preservation of a deleted tombstone.
It does not simulate a production maintenance window or protect concurrent live
writers. No real account data was migrated during this work.

## Application-level race reproduced (2026-11-15)

`backend/test/account-lifecycle-actual-race.e2e-spec.ts` uses the actual
`NutritionService` and `PrivacyService` against an isolated MongoDB replica
set. A controlled USDA stub pauses the scan save before persistence; the test
then requests deletion, expires the test grace period and completes the real
purge before releasing the lookup. The safety assertion failed: the late save
recreated the deleted user's nutrition document, meal and idempotency receipt.
The provider response was synthetic; database operations and service code were
real. The test remains a failing regression when `PQ_TEST_REPLICA_URI` is set.

## Nutrition slice follow-up (2026-11-15)

The actual deletion request now changes the lifecycle record and user state in
one transaction; recovery changes both back in one transaction. Purge retains
the lifecycle record and finalizes the tombstone and user removal together.
Nutrition creation, meal changes, water, dietary plans and both scan-save paths
use an active lifecycle write and pass its session to their database writes.
USDA verification happens outside the transaction. Scan receipts and meal rows
are persisted together; the receipt replay also checks the active lifecycle.
Email/password and Google registration create a lifecycle record and user in
the same transaction. Existing users with no lifecycle record fail closed and
must be migrated through a controlled maintenance process; no real migration
has been performed. The original delayed-USDA race now passes on an isolated
replica set after provisioning its synthetic lifecycle fixture.

The usage maintenance, quotas, worker claims/failures, uploads, other services listed above, and
external storage have not been migrated. The deletion worker can still race
those paths. There is no startup topology or migration-readiness gate, and a
standalone deployment cannot run these transaction-dependent operations. A
scan save captures a lifecycle generation before USDA work, and the final write
requires that generation; deletion and recovery increment it. Other long-lived
operations have not been audited for the same issue. Deletion is not globally safe and this slice is not
ready to deploy. Crash recovery, independent-process races, and full
application integration remain unverified.

## Usage and job follow-up (2026-11-15)

The scanner usage reservation and completion writes and the analysis job
enqueue and final result transaction now participate in the lifecycle fence.
The job collection itself is the durable queue; no external queue or outbox
was added. Newly created usage records and jobs carry a generation. Legacy
records lacking one cannot complete through the new protected paths and need an
explicit operational migration or resolution. A failed usage completion now
returns an unavailable error rather than silently claiming success.

An isolated replica-set test exercised actual usage, analysis enqueue and
privacy services, with a controlled storage stub, showing that deletion during
the storage check prevents job insertion and a later usage completion cannot
recreate the purged ledger record. This is not a full worker or crash-recovery
test. Worker claim and failure writes, usage maintenance, scanner/chat/pose
quota counters and storage metadata remain unfenced. External provider and
object-storage calls cannot be rolled back by a MongoDB transaction. No startup
topology or migration-readiness validation has been added. The system remains
unsafe to deploy and further regression and independent-process tests are
required.
