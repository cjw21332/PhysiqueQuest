# Account lifecycle verification — 2026-11-15

Exact evidence for the lifecycle fencing work. This is a local verification on a
disposable replica set, not a production certification. No real account data was
migrated and no production deployment was performed.

## Test environment

- Local MongoDB 8.3 single-node replica set `pqtest` on `127.0.0.1:27181`,
  data under `backend/.data/replset` (git-ignored). The pre-existing standalone
  on `127.0.0.1:27017` was left untouched and used only as a negative topology
  probe.
- Every database test creates a randomly named database and verifies the name
  before dropping it. `PQ_TEST_REPLICA_URI`/`PQ_TEST_MONGO_URI` were
  `mongodb://127.0.0.1:27181/?replicaSet=pqtest`.
- Providers are synthetic except the explicit live Gemini diagnostic and the
  local filesystem storage driver. Credentials were read from `backend/.env`
  and never printed; only presence and length were checked.

## Commands and results

```bash
# backend build (also type-checks the changed source)
cd backend && npm run build                         # pass

# backend unit regression
cd backend && npx vitest run                        # 107 files, 2541 tests, 0 failed

# eight MongoDB-dependent lifecycle E2E suites
PQ_TEST_REPLICA_URI=... npx vitest run --config ./vitest.config.e2e.ts \
  account-lifecycle-actual-race account-lifecycle-fence \
  account-lifecycle-migration lifecycle-all-writers \
  lifecycle-nutrition-integration lifecycle-processes \
  lifecycle-quota-guards lifecycle-usage-jobs        # 8 files, 58 tests, 0 skipped

# full E2E with every opt-in real-database and live-provider flag
PQ_TEST_REPLICA_URI=... PQ_TEST_MONGO_URI=... PQ_TEST_STANDALONE_URI=... \
PQ_SECURITY_DB_TEST=1 PQ_RECOVERY_DB_TEST=1 MONGODB_URI=... \
PQ_LIVE_FOODSCAN=1 npx vitest run --config ./vitest.config.e2e.ts
                                                     # 26 files, 109 tests, 0 failed, 0 skipped
```

Lifecycle suite detail (all passing):

| Suite | Tests |
| --- | ---: |
| `lifecycle-all-writers.e2e-spec.ts` | 28 |
| `lifecycle-processes.e2e-spec.ts` | 15 |
| `lifecycle-quota-guards.e2e-spec.ts` | 12 |
| `lifecycle-remaining-writers.e2e-spec.ts` | 10 |
| `account-lifecycle-actual-race.e2e-spec.ts` | 2 |
| `account-lifecycle-fence.e2e-spec.ts` | 3 |
| `account-lifecycle-staging-migration.e2e-spec.ts` | 3 |
| `lifecycle-startup-topology.e2e-spec.ts` | 2 |
| `account-lifecycle-migration.e2e-spec.ts` | 1 |
| `lifecycle-nutrition-integration.e2e-spec.ts` | 1 |
| `lifecycle-usage-jobs.e2e-spec.ts` | 1 |

### Live Gemini diagnostic

`foodscan-live.e2e-spec.ts` was run with `PQ_LIVE_FOODSCAN=1` against the replica
set and a real API key:

```
LIVE_SCAN_DIAGNOSTIC status=200 duration_ms=5301 ledger_status=success usage_available=true
```

The fixture previously inserted a user without an `account_lifecycle` row and
omitted `$locals.lifecycleGeneration`, so the fenced quota failed closed with
503 before reaching Gemini. The fixture now provisions the same account state
that registration creates; the production code was not weakened.

## Staging migration rehearsal

- **Test**: `account-lifecycle-staging-migration.e2e-spec.ts` (5 tests, 5 passed)
- **Dataset**: 105 users (80 eligible, 10 already active, 5 deleting, 5 ambiguous, 5 tombstoned; 5 tombstone-only rows)
- **20 owned collections + leaderboard snapshots** across realistic records
- **Dry-run**: creates nothing; **Apply**: creates exactly 80 rows; **idempotent**: repeat apply is a no-op
- **Tombstone preservation**: legacy work never receives a generation
- **Interrupted run resume**: 30-user run stopping after 10 creates only the missing 10 on re-run
- **Partial failure resume**: 40-user run with one failure creates only that missing record on next run
- **Startup conflict handling**: rejects conflicts, accepts after operator resolution

With every run the full suite passes (2953ms).

## Skipped-test audit

With no optional environment variables the E2E runner reports 88 skipped tests;
with the flags above the count is 0. Each skip guard and its reason:

| Guard | Tests | Reason / how it is satisfied |
| --- | ---: | --- |
| `PQ_TEST_REPLICA_URI` | 58 | Transaction-capable replica set for lifecycle fences, migration, crash processes and quota guards. |
| `PQ_SECURITY_DB_TEST=1 && MONGODB_URI` | 12 | Opt-in isolated security-database suites (chat isolation, sessions, retention, indexes, encryption, storage, sync, jobs, verification). |
| `PQ_TEST_MONGO_URI` | 7 | Real-MongoDB food-scanner persistence, null-diary migration and the live scan. |
| `PQ_RECOVERY_DB_TEST=1 && MONGODB_URI` | 2 | Password-recovery transactions. |
| `PQ_LIVE_FOODSCAN=1 && GEMINI_API_KEY` | 1 | Explicitly billable live Gemini call, separate from the normal suite. |

`test/pose-provider.integration.spec.ts` skips only when no Python executable is
available; Python 3.12 is present here and the test passed. The Playwright
browser specs under `frontend/tests/browser` are a separate browser harness and
are not part of these unit/E2E commands.

## What is newly covered

- Remaining ordinary writers now have real-database race coverage: activity,
  coach program persistence, profile updates, push device registration and
  safety alert insertion. Each proves (a) a purged account cannot recreate a
  record and (b) a request carrying the pre-deletion generation is rejected
  after recovery.
- `SafetyService.resolve` now captures the generation before loading the record
  and passes it to the fenced write.
- Deterministic child-process crash tests now also kill the purge after each
  individual collection deletion (`settings`, `progress_entries`,
  `notifications`, `push_devices`) and at the external file-creation boundary
  (real local object written, process exits before the lifecycle recheck). The
  restarted worker finalizes the tombstone and removes the object.
- The real operator migration CLI
  (`scripts/audit-account-lifecycle.mjs`) is driven by a synthetic staging
  dataset: 100 users (80 eligible, 10 already migrated, 10 conflicts) plus five
  tombstones and legacy background work. It asserts dry-run creates nothing,
  apply creates exactly 80, repeat apply is idempotent, tombstones survive,
  legacy work never receives a generation, startup rejects the remaining
  conflicts, and accepts the database after operator resolution.
- Startup rejects a real standalone server (`hello.setName` absent) before
  creating indexes, and accepts the replica set with sessions and an aborted
  transaction proof.

## Frontend checks

```bash
cd frontend && npx tsc --noEmit    # pass
cd frontend && npm run lint        # 0 errors, 16 pre-existing warnings
cd frontend && node --test tests/*.test.mjs tests/*.test.ts
                                   # 193 tests, 188 pass, 5 pre-existing failures
```

The five failures are unrelated UI expectations (`conic-gradient` in
`GoalsMilestones`, standalone Goals/Progress navigation, scan logging timestamp
and personal-record presentation) in files this work did not modify. They
pre-date the backend lifecycle changes and are not claimed as fixed.

## Remaining limitations

- No real-account migration and no production transaction topology were tested.
- External S3 object **version** erasure was not verified; only local filesystem
  cleanup was exercised. S3 `DeleteObject` on a versioned bucket is not erasure
  of historical versions.
- Push/email/SMS delivery providers remain synthetic. Messages already accepted
  by an external provider cannot be recalled.
- The leaderboard snapshot writer is fenced and passes generations, but its only
  automated evidence is unit-level; no real-database race test was added.
- Cleaning up `storage_cleanup` receipts is unbounded by design (they reschedule
  hourly); growth monitoring is still an operational requirement.
- Coverage does not prove every possible interleaving, and a replica set on one
  machine is not a production cluster.

## Known gaps and coordination items

| Gap | Location | Impact | Action |
| --- | --- | --- | --- |
| `scripts/delete-user.ts` bypasses lifecycle state machine | `backend/scripts/delete-user.ts` | Direct deleteMany/deleteOne without generation/fence checks; data resurrection risk | Decide on hard-guard or removal during maintenance window; tracked in writer inventory |
| Leaderboard snapshot writer unit-only evidence | `backend/src/leaderboard/leaderboard.service.ts` | No real-database race test added; generation fencing present | Add E2E race coverage in Phase 5 |
| Monitoring: lifecycle rejection counters shallow | `backend/src/health.controller.ts`, `backend/src/common/http-metrics.ts` | No lifecycle-specific rejection metrics in /ready or /api/admin/metrics | Add fence-quota rejection counter to health metrics |
| Provider mock not available for S3 versioned erasure | `backend/src/storage/storage-provider.ts` | No real S3/versioned-bucket verification; local-only | Document local-only limitation; require bucket policy for release |
| Cleanup receipts unbounded growth | `backend/src/storage/storage.service.ts` | Receipts reschedule hourly; growth monitoring operational requirement | Add receipt count alert and retention policy |

## Deployment decision

**Not production-ready for account deletion as a global erasure guarantee.**
The lifecycle fencing, writer coverage, crash recovery and synthetic migration
are verified on a local replica set, and no known writer can bypass the fence in
the tested paths. Deployment still requires: a real maintenance-window
migration with the operator CLI, coordinated removal of old unprotected writer
instances, production topology validation, verified external object/version
retention, and monitoring for quarantined work and cleanup receipts. Do not
enable account deletion on standalone MongoDB; startup correctly refuses it.
