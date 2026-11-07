# GIF pipeline and mobile investigation checkpoint

Start: `2026-11-07T21:12:23.1799193+08:00`; checkpoint: `2026-11-07T21:15:58.7671944+08:00`; command: `rtk proxy powershell -NoProfile -Command "Get-Date -Format o"`. This is an incomplete checkpoint, not feature completion.

## Catalog and download

`backend/src/exercises/catalog-sync.service.ts` uses `EXERCISE_CATALOG_MONGODB_URI`, falling back to `MONGODB_URI`, with collection `exercisedb_catalog`. The loaded `backend/.env` has the first variable unset and the second set; no credentials are printed. Read-only PyMongo inspection of the configured URI showed no explicit default database, and the backend connection uses `test`. The `test` database's collection inventory: `nutrition 1`, `analysis_results 0`, `coach_programs 3`, `background_jobs 0`, `auth_sessions 13`, `workout_sessions 27`, `push_deliveries 0`, `password_recovery_tokens 0`, `progress_entries 0`, `storage_uploads 0`, `admin_exercises 20`, `auth_rate_limits 0`, `settings 1`, `analysis_jobs 0`, `profiles 2`, `notifications 1`, `exerciseposetrackerconfigs 0`, `registration_codes 0`, `audit_logs 542`, `safety_alert_events 13`, `activity 1`, `push_devices 0`, `email_verifications 0`, `users 3`, `leaderboard_snapshots 10`, `exercisedb_sync 1`, `sign_in_events 39`, `exercisedb_catalog 1500`. The other application database named `PhysiqueQuest` did not contain the catalog in its collection list. Security-test databases were also present; their exhaustive count was not retained here.

Read-only catalog command used `MongoClient`, `c['test']['exercisedb_catalog'].find(...)`, and `len(set(x.get('exerciseId') for x in rows))`; raw result `catalog count 1500 unique ids 1500`. Samples: `01qpYSe`, upward facing dog, back, bodyweight, erector spinae; `03lzqwk`, assisted hanging knee raise, waist, assisted, abdominals; `05Cf2v8`, impossible dips, upper arms, bodyweight, triceps. Each sample's URL host was `static.exercisedb.dev`. Fields: `exerciseId`, `name`, `equipments`, `bodyParts`, `targetMuscles`, `gifUrl`.

`tools/gif-config/config.py` now loads the backend environment and derives the catalog database from the URI with the backend's `test` fallback; `EXERCISE_CATALOG_DB_NAME` and `EXERCISE_CATALOG_COLLECTION` are optional overrides. The importer resolves its application database from `MONGODB_URI`, not the catalog URI; its writes remain disabled. `rtk proxy python -c "import sys;sys.path.insert(0,'tools/gif-config');from config import CATALOG_DB_NAME,CATALOG_COLLECTION;print('database',CATALOG_DB_NAME,'collection',CATALOG_COLLECTION)"` returned `database test collection exercisedb_catalog`. Full catalog loader check failed: `ModuleNotFoundError: No module named 'aiohttp'`.

One request for an actual catalog GIF URL failed with `urllib.error.HTTPError: HTTP Error 403: Forbidden`. No GIF was downloaded; bytes, dimensions and frame count are NOT MEASURED. Per the requested stop rule, no pilot or full run was attempted. Counts and percentages by status, reason, joint, side, view, equipment, body part, missing IDs and duplicate output IDs are NOT MEASURED because generated output does not exist.

## Model

Google heavy float16 v1 model downloaded into ignored `tools/gif-config/models/pose_landmarker_heavy.task`: `http 200 bytes 30664242 sha256 64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`. `extract_landmarks.py` points to this path; README documents the hash and size. `rtk git check-ignore tools/gif-config/models/pose_landmarker_heavy.task` printed the path. `create_landmarker()` returned successfully with installed MediaPipe and printed `heavy model loaded`. A real frame inference and three landmark visibilities are NOT MEASURED: the requested real GIF download returned 403.

## Mobile

`mobile/camera-readiness.test.mjs` transpiles `mobile/App.tsx` in a VM with a mock-only `require`; the map lacks `./PoseTrackerNative`, so it throws before any native implementation is loaded. Working-tree command `rtk proxy node --test --test-reporter=spec mobile/camera-readiness.test.mjs` returned `tests 13; pass 12; fail 1` and `Error: Unexpected import ./PoseTrackerNative`. A clean HEAD worktree created with `rtk git worktree add ../PhysiqueQuest-clean HEAD` initially failed to resolve TypeScript; after temporarily junctioning its `node_modules` to the existing repository dependencies without installing anything, the same command returned `tests 13; pass 13; fail 0`. The junction and worktree were removed. This supports that the uncommitted `App.tsx` import introduced the harness failure; it does not establish authorship or feature attribution beyond the working-tree diff. No mobile test was changed. Proposed mock addition, subject to user approval: add `'./PoseTrackerNative': {},` to the dependency map at `mobile/camera-readiness.test.mjs:150`. The earlier reported 50 versus current full-suite 54 comparison is NOT MEASURED; the historical full test-name list was not recovered.

## Counter stall and prior test corrections

The earlier first test previously provided invalid frames only at 600 ms and expected a loss immediately; it now adds an invalid observation at 1101 ms, establishing more than 500 ms of observed missing visibility. The second previously provided an invalid frame at 0 ms and restored at 600 ms; it now adds an invalid observation at 501 ms and asserts `AT_START` after restoration. The original counter also rejected timestamp 0 due to its zero sentinel. The new expectations follow the sustained-loss specification rather than declaring loss on the first missing observation.

The test `declares visibility lost when frames stall and restores without counting interrupted motion` initially produced `TypeError: counter.tick is not a function`; `shared/genericRepCounter.ts` now exposes `tick(now)` and the shared run from `shared`, `rtk npx vitest run --config vitest.config.ts`, returned `Test Files 1 passed (1); Tests 19 passed (19)`. No generated-angle host exists yet to call `tick`; camera-stall handling is NOT wired into a live session.

## Verification and status

`rtk proxy python -I -m pytest tools/gif-config/tests -q`: `24 passed, 18 warnings in 5.65s`. From `backend`, `rtk npm run build`: exit code 0, `> nest build`. Backend full suite, frontend suite/build and mobile TypeScript were NOT RERUN in this turn; previous results are in `Progress6_fixes.md` and `Progress6_audit.md`.

| Phase | Completed | Total | Status |
|---|---:|---:|---|
| A (catalog connection, real GIF download, model loading, pilot, full run) | 2 | 5 | NOT COMPLETE; catalog lookup and model loading evidenced, GIF blocked. |
| B (precedence, atomic writes, tests, admin UI, endpoints) | 0 | 5 | NOT COMPLETE; writes remain disabled. |
| C (counter stall API, parity, web hook, UI, webcam demo) | 1 | 5 | NOT COMPLETE; stall API only, no host caller. |
| D (recorder, consent, evaluator, synthetic evaluation) | 0 | 4 | NOT COMPLETE. |

Files changed this turn: `tools/gif-config/config.py`, `download_gifs.py`, `import_configs.py`, `extract_landmarks.py`, `.gitignore`, `README.md`, `shared/genericRepCounter.ts`, `shared/__tests__/genericRepCounter.spec.ts`; created this report. Model is git-ignored. Existing files were untracked before the turn, so historical creation attribution is unavailable.

NOT VERIFIED: real-person accuracy, physical iOS/Android, diverse bodies, threshold tuning, GIF versus user camera mismatch, mobile WebView, native path, ExerciseDB media terms. A person must read the media terms. Webcam demo NOT PERFORMED: needs a person at a webcam; checklist in `Progress6_final.md`.

Corrections to PROGRESS-61: catalog-run, coverage and review-sheet claims have no supporting generated artifacts; backend build had failed before correction; importer precedence was unsafe and remains disabled; visibility tests failed before correction; live integration and real-person validation were absent. Duration and phase percentages were unsupported. Additional claim-by-claim audit is incomplete.

## Proposed checkpoint only — do not execute without explicit approval

Suggested branch: `codex/pose-tracking-checkpoint`. Proposed commands below are a starting point for review, not executed; overlapping integration files need separate diff review before staging.

```powershell
git switch -c codex/pose-tracking-checkpoint
git add mobile/PoseTrackerNative.tsx mobile/poseFrameTiming.mjs mobile/poseFrameTiming.d.mts mobile/providerRepQuality.mjs mobile/providerRepQuality.d.mts mobile/posetracker-navigation.test.mjs mobile/poseFrameTiming.test.mjs mobile/providerRepQuality.test.mjs
git commit -m "feat: add native PoseTracker session components"
git add backend/src/pose-tracker backend/test/pose-tracker.spec.ts backend/test/pose-tracker-access.spec.ts
git commit -m "feat: add pose tracker configuration service"
git add shared/genericRepCounter.ts shared/__tests__/genericRepCounter.spec.ts shared/vitest.config.ts shared/vitest.setup.ts
git commit -m "feat: add experimental generic rep counter"
git add tools/gif-config
git commit -m "feat: add experimental GIF pose configuration pipeline"
```

These commands do not include all modified integration points, lockfiles or progress documentation; review dependencies and staging boundaries before any commit. The generated-angle service currently depends on broader existing uncommitted work and the proposed commits are not independently verified.
