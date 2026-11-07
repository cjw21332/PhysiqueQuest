# PROGRESS-61 corrective work

Start: `2026-11-07T21:06:09.2203417+08:00`, from `rtk proxy powershell -NoProfile -Command "Get-Date -Format o"`.

## Backend build

From `backend`, `rtk npm ls zod` returned `zod@4.6.7`. Five one-argument `z.record` declarations in `backend/src/pose-tracker/pose-tracker.module.ts` now specify string keys and value schemas. This also resolves the inferred `ConfigOverride` incompatibility without a type suppression. From `backend`, `rtk npm run build` returned exit code 0 and `> nest build`; the audit had reported `Found 6 error(s)`. From `backend`, `rtk npm test` returned `Test Files 98 passed (98)` and `Tests 2463 passed (2463)`.

## Import protection

The existing importer allowed overriding verified configurations and did not protect default built-ins. As an interim fail-closed protection, `tools/gif-config/import_configs.py` refuses all `--apply` operations until catalog-aware precedence and atomic write protection are implemented and tested. `rtk proxy python tools/gif-config/import_configs.py --apply --force` returned exit code 1 and `ERROR: Import writes are disabled until protected mapping precedence is implemented and tested.` This is NOT the requested complete importer: safe refresh, registry lookup, protection tests and a dry-run diff remain undone. The earlier dry run failed because generated configs do not exist; no database writes were attempted.

## Counter

`shared/genericRepCounter.ts` now tracks timestamp zero, waits for sustained visibility loss before emitting loss, restores to a clean movement state after loss, preserves totals on large frame gaps and exposes `resetSession()` for clearing totals. The old `reset()` remains a session reset. `shared/__tests__/genericRepCounter.spec.ts` adds interrupted-rep, long-gap and brief-dip tests. Existing visibility tests were corrected to supply observations spanning more than the configured loss interval: one missing frame alone does not establish how long visibility has been missing. Test-first run: from `shared`, `rtk npx vitest run --config vitest.config.ts` returned `Tests 3 failed | 15 passed (18)`; the failures included recovery remaining in `VISIBILITY_LOST`. After the fix, the same command returned `Test Files 1 passed (1)` and `Tests 18 passed (18)`. Synthetic tests do not validate real-person accuracy.

## Mobile investigation

`rtk git log --oneline -- mobile/camera-readiness.test.mjs mobile/PoseTrackerNative.tsx` returned `103783b release: prepare PhysiqueQuest v4.2.0` and `d323ff3 Release PhysiqueQuest v3.1.1 application updates`. `rtk git status --short -- mobile/camera-readiness.test.mjs mobile/PoseTrackerNative.tsx mobile/App.tsx` returned ` M mobile/App.tsx` and `?? mobile/PoseTrackerNative.tsx`; the test is tracked and unchanged, the native component is untracked, and App imports it. The test's mocked require throws `Unexpected import ./PoseTrackerNative`; that is a harness import failure, not evidence Node attempted to load TSX. Whether this specific GIF feature caused the change and whether it fails on a clean checkout remain UNVERIFIABLE; no clean checkout was tested and no mobile test was changed. The earlier 50-test count is not reconciled: exact test-list comparison was not performed. Current root invocation `rtk proxy node --test mobile/*.test.mjs mobile/inactivity/*.test.mjs` returned `tests 54; pass 53; fail 1; skipped 0` as recorded in the audit.

## Pilot preflight

`rtk proxy python --version`: `Python 3.12.10`. `rtk proxy python -c "import mediapipe; print('mediapipe',mediapipe.__version__)"`: `mediapipe 0.10.14`. The configured `tools/gif-config/pose_landmarker_heavy.task` is absent; an HTTP HEAD request to Google's heavy model returned `model HEAD status: 200`, not a downloaded or verified model. Read-only MongoDB ping returned `mongo ping: 1`, but querying the exact hard-coded `physiquequest.exercisedb_catalog` returned `exercisedb_catalog records: 0` and `catalog record with GIF: False`. GIF-host download is NOT MEASURED because that collection provided no GIF URL. `Get-PSDrive -Name C | Select-Object Name,Free` returned `C 146183901184` bytes free. Required storage is NOT MEASURED. No pilot or full catalog run was performed. `tools/gif-config/.gitignore` now ignores the cache, review images and local model files; `rtk git check-ignore tools/gif-config/cache/gifs/test.gif tools/gif-config/output/review_sheets/test.png` printed both paths.

## Other verification

`rtk proxy python -I -m pytest tools/gif-config/tests -q`: `24 passed, 18 warnings in 4.03s`. `rtk proxy node --test mobile/posetracker-navigation.test.mjs mobile/providerRepQuality.test.mjs mobile/poseFrameTiming.test.mjs`: `tests 5; pass 5; fail 0; skipped 0`. Frontend tests/build and mobile TypeScript results from the preceding audit are historical; they were not rerun after this work.
