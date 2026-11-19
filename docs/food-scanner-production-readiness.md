# Food scanner production readiness

Status: **needs improvement**. Scanner responses are image-model estimates, and no measured real-photo dataset or physical-device run is established in this change. A live authenticated scan with a synthetic image succeeded once after other attempts timed out; this does not establish real-food recognition or reliability. Do not deploy publicly based on mocked tests. Isolated local MongoDB tests passed with mocked providers: authenticated scan/search/save HTTP routes, saved nutrition and user isolation, concurrent shared quotas, keyed meal-save races and usage summaries. A browser test passed through the real authenticated backend to isolated MongoDB, with Gemini and USDA mocked and a synthetic image.

The backend uses the existing JWT session and scopes nutrition writes by the verified user ID. Matched scan items must supply a USDA identifier and weight; the backend fetches that record and recalculates saved nutrients. Unknown nutrient values remain null. This verifies a record, not whether the record describes the photographed food correctly. Food names and weights still need user review. The frontend allows correction, addition and reversible exclusion.

The scanner uses a MongoDB atomic fixed-window rate bucket shared across replicas; it fails closed on missing database or failed index creation. All replicas must use the same MongoDB, limit and window configuration, synchronized clocks, and an account permitted to use/create the TTL index. Requests at a fixed-window boundary can burst across two windows. USDA caches remain bounded in-process; a shared cache is deferred until the operational benefit outweighs database writes, staleness and invalidation risks. The rate limit does not deduplicate image contents. Reusing a request ID prevents a second scan reservation. Keyed meal submissions are atomically deduplicated per user; legacy requests without a key remain unprotected, and the web key is not durable across reloads.

The usage ledger reserves a user/request pair before provider analysis and stores provider metadata when available. Completion is retried once; stale pending records are marked incomplete and unresolved usage is not discarded. Failed/retried calls may have unknown billable usage. MongoDB indices and retention require operational review. Usage records use the account ObjectId, allowing the existing export/purge process to find them; isolated MongoDB privacy tests verified purge of usage and nutrition records, and a reservation test verified deletion racing with insertion. Other active-request deletion races still need review. Do not put images or API secrets into these records.

Required next steps: exercise deployed replicas and database failure modes; complete measured-photo evaluation; resolve intermittent live Gemini timeouts and verify real food images; migrate all clients to keyed saves and verify native recovery; resolve deletion races; review unresolved-ledger operations; decide whether shared USDA caching is needed; validate physical devices, offline paths and accessibility; and review actual limits and provider spend. Internal testing should use test accounts, small quotas and explicit estimate warnings. Public production and a broadly available beta are not yet recommended.

The web client now persists one user-scoped pending meal payload and key in local storage before sending; it stores no photograph. It checks the authenticated receipt and retries the identical payload if the outcome remains unknown. Changed meals are blocked until the earlier operation is recovered. Web Locks coordinate tabs; browsers without Web Locks cannot use this protected save path. Local storage contains meal details and should be considered sensitive; users sharing a device must understand its persistence, and storage loss or a different device prevents recovery. Legacy clients without keys remain unprotected. The receipt endpoint is user-scoped and reports unknown when no completed receipt exists; unknown is not proof of failure.

Nutrition startup creates/verifies the unique `userId` index and fails if duplicate records prevent it; operators must inspect and resolve duplicates without deleting data blindly. A local test used four independent Node processes sharing one MongoDB for quota and keyed-save races. It is not a deployed multi-replica test and does not test clock skew or account-deletion races.

Account deletion can race with a meal save after USDA verification and recreate nutrition after purge; an active scan can also overlap deletion. Existing active checks, account purge and non-upserting ledger completion reduce some risks but do not serialize every operation with account deletion. A robust fix requires an atomic account lifecycle fence or transactions supported by a replica-set deployment and explicit integration tests; do not classify this as solved.

Frontend lint now runs `npm run lint --workspace frontend` using the project's existing backend linter family (Oxlint) as an explicit frontend development dependency. It completes with existing warnings; it is not equivalent to Next-specific ESLint rules and TypeScript/build checks remain separate.
# Follow-up lifecycle and dependency audit (2026-11-15)

**Not production-ready:** the account-deletion race described in
`account-deletion-lifecycle.md` remains unresolved. Local MongoDB is standalone;
the existing transaction-based analysis finalization cannot be assumed to work
there. Native WebViews without Web Locks still cannot save or recover scans.
No additional real-food or physical-device evaluation was performed.

An isolated MongoDB chatbot privacy integration test was repaired to supply its
required user model and assert the current activity response. All six cases
passed. This was a test-harness issue; it does not validate deletion fencing.

The current root npm audit reports 13 affected packages (1 low, 10 moderate,
2 high), including the `--omit=dev` view; this is a dependency-graph finding,
not proof that every advisory is reachable in a deployed build. High-severity
entries are transitive `@expo/cli` and `zod`. Other affected entries include
Expo configuration packages, Sentry packages, glob, minimatch, node-forge and
deepmerge. The audit offers compatible fixes for some paths, including a
Sentry update, but no blanket or forced upgrade was applied. Assess advisory
reachability and lockfile changes, then rebuild and retest each affected app.

