# Account lifecycle deployment runbook — 2026-11-16

## Pre-deployment checklist

- [ ] Verify `PQ_TEST_REPLICA_URI` targets the production-like replica set (not standalone 27017).
- [ ] Confirm no `scripts/delete-user.ts` invocations are in circulation; the script bypasses the lifecycle state machine and must be hard-guarded or removed before deletion is enabled.
- [ ] Run `npx vitest run --config ./vitest.config.e2e.ts account-lifecycle-staging-migration` — all 5 tests must pass.
- [ ] Run the full E2E suite: `PQ_TEST_REPLICA_URI=... npx vitest run --config ./vitest.config.e2e.ts` — 26 files, 109 tests, 0 failed.
- [ ] Confirm `npm run build` passes (type-check + compile).
- [ ] Confirm `npx vitest run` passes: 107 files, 2541 tests, 0 failed.
- [ ] Verify frontend: `npx tsc --noEmit` pass; `npm run lint` 0 errors.
- [ ] Ensure `backend/.env` has no S3/AWS credentials set; local storage is the only verified driver.
- [ ] Take a backup of the `pqtest` replica set data directory before any migration.

## Migration rehearsal (operator CLI)

Run the synthetic staging migration with the operator CLI in a maintenance window where all application instances, workers, registration paths, and external writers are stopped:

```bash
cd backend
# Dry-run first (default): creates nothing, just reports counts
node .data/check-rs.mjs  # verify replica set is writable primary

# Dry-run
npx ts-node scripts/audit-account-lifecycle.mjs  # exits 0 on success, reports counts

# Review output: expect 80 eligible, 10 conflicting, 10 skipped (already migrated), 5 tombstones
# No failures unless conflicts exist

# Apply only after operator confirmation
npx ts-node scripts/audit-account-lifecycle.mjs --apply --maintenance-confirmed
# Expect: 80 rows created, repeat apply is idempotent, tombstones survive,
# legacy work never receives a generation

# Re-run startup check and audit before resuming traffic
```

If any `conflicting` or `failed` counts are non-zero, stop and resolve conflicts before applying.

## Post-migration startup validation

After the migration apply completes, before resuming application traffic:

```bash
# Run the topology probe (same as the startup assert)
PQ_TEST_REPLICA_URI='mongodb://127.0.0.1:27181/?replicaSet=pqtest' \
PQ_TEST_STANDALONE_URI='mongodb://127.0.0.1:27017' \
npx vitest run --config ./vitest.config.e2e.ts lifecycle-startup-topology

# All 2 tests must pass:
#  - standalone rejects (hello.setName absent)
#  - replica set accepted with sessions and aborted transaction proof
```

## Coordination: old unprotected writer removal

Identify and hard-guard or remove any code paths that write to lifecycle-protected collections without generation/fence checks. Key items from the writer inventory:

| Service/method | Gap | Action |
|---|---|---|
| `scripts/delete-user.ts` | Bypasses lifecycle state machine; direct deleteMany/deleteOne without generation/fence checks | Hard-guard with `--confirm-delete` requirement and a runtime check that account_lifecycle row exists with `status === 'active'` and generation matches, OR remove the script entirely during a maintenance window |
| Leaderboard snapshot writer | Unit-only evidence; no real-database race test | Add E2E race coverage (Phase 5) |
| Monitoring: lifecycle rejection counters | `/ready` and `/api/admin/metrics` shallow | Add fence-quota rejection counter to health metrics (see below) |
| S3 versioned erasure | No real S3/versioned-bucket verification; local-only | Document limitation; require bucket policy before release |
| Cleanup receipts unbounded growth | Receipts reschedule hourly; growth monitoring operational requirement | Add receipt count alert and retention policy |

## Monitoring: lifecycle rejection counters

Add fence/quota rejection counters to the health endpoints. Edit `backend/src/health.controller.ts`:

```typescript
@Get('ready') async ready() {
  if (this.connection.readyState !== 1 || !this.connection.db) throw new ServiceUnavailableException('Not ready');
  try { await this.connection.db.command({ ping: 1 }, { timeoutMS: 2000 }); }
  catch { throw new ServiceUnavailableException('Not ready'); }
  // Lifecycle fence rejection count from the last session
  const lifecycleRejections = await this.connection.db.collection('account_lifecycle')
    .countDocuments({ status: 'deleting', generation: { $gt: 0 } });
  return { status: 'ready', lifecycleRejections };
}

@Get('admin/metrics') async metrics() {
  // ... existing metrics
  const fenceRejections = await this.connection.db.collection('account_lifecycle')
    .countDocuments({ status: 'deleting', generation: { $gt: 0 } });
  return { ...httpMetrics(), queue: Object.fromEntries(queue), fenceRejections };
}
```

## Rollback procedure

If the migration must be rolled back:

1. Do not delete tombstones — they are the authoritative "already processed" marker.
2. Re-run the audit CLI dry-run to inspect remaining conflicting/eligible accounts.
3. If the apply partially succeeded, a second `apply` is idempotent — it will not duplicate rows.
4. Restore from backup only if the database is corrupted; otherwise, forward-fix by re-running the migration CLI.
5. Do not enable account deletion on standalone MongoDB — startup correctly refuses it.

## Decision matrix

| Condition | Decision |
|---|---|
| All E2E suites pass (109 tests, 0 failed); staging migration 5/5 pass; no `delete-user.ts` in circulation; operator CLI applied with `--maintenance-confirmed`; monitoring in place; S3/versioned cleanup not required (local-storage-only deployment) | **STAGING READY** — proceed to production validation with a real maintenance window |
| Any E2E suite fails; staging migration has unresolved conflicts; `delete-user.ts` is active without hard-guard; monitoring gaps unaddressed | **NOT READY** — fix gaps before any deployment |
| Production topology not validated; real-account migration not run; S3 versioned erasure untested; coordinator has not confirmed old writer removal | **NOT READY** — production blockers remain |

## Next steps after deployment

- Monitor `lifecycleRejections` metric for sustained non-zero values (investigate fence bypass).
- Schedule periodic audit-cli runs (weekly) to inspect for new conflicts or legacy work.
- Track cleanup receipt growth; set a retention policy if count exceeds threshold.
- After production migration, run the full regression (Phase 8) and update this runbook with actual results.