# PROGRESS-61 evidence audit — preliminary, gate not passed

Audit started 2026-11-07T20:59:09.7117277+08:00 (`rtk proxy powershell -NoProfile -Command "Get-Date -Format o"`). This is an incomplete audit, not a phase completion certificate. No implementation changes or database writes were made.

| Claim | Where claimed | Evidence command/file | Raw result | Verdict |
|---|---|---|---|
| Full catalog downloaded and processed; coverage report and review sheets exist | PROGRESS-61 Phase A and coverage table | Python filesystem inventory of `tools/gif-config/cache` and `tools/gif-config/output` | `cache/gifs exists=True files=0`; `cache/landmarks exists=True files=0`; `output exists=True files=0`; `failed_downloads.json exists=False` | FALSE: no full run is evidenced by these directories |
| Coverage classifications and reason-code totals from the catalog | PROGRESS-61 Coverage Numbers | `tools/gif-config/output/generated_configs.json` | File absent; coverage is NOT MEASURED | UNVERIFIABLE; reported estimates unsupported |
| Forty review sheets generated and ten visually inspected | PROGRESS-61 Phase A and Progress2/Progress5 | `tools/gif-config/output` inventory | `files=0` | FALSE for current artifacts; visual verification NOT MEASURED |
| Python tests pass | PROGRESS-61 Phase A | `rtk proxy python -I -m pytest tools/gif-config/tests -q` | `24 passed, 18 warnings in 7.31s` | VERIFIED for this run |
| Generic counter suite has two visibility failures | PROGRESS-61 Phase C | From `shared`: `rtk npx vitest run --config vitest.config.ts` | `Tests  2 failed | 13 passed (15)` | VERIFIED |
| Backend integration builds | PROGRESS-61 Phase B | From `backend`: `rtk npm run build` | `Found 6 error(s)`; five TS2554 `z.record` argument errors and TS2322 at `src/pose-tracker/pose-tracker.module.ts:71` | FALSE |
| Existing backend PoseTracker tests pass | PROGRESS-61 Phase B | From `backend`: `rtk npm test -- --run test/pose-tracker.spec.ts test/pose-tracker-access.spec.ts` | `Test Files 2 passed (2)`; `Tests 8 passed (8)` | VERIFIED for named suites only; no baseline comparison established |
| Frontend regression tests pass | audit | From `frontend`: `rtk proxy node --test tests/*.test.mjs` | `tests 168; pass 168; fail 0; skipped 0` | VERIFIED for this run |
| Mobile regression tests pass | audit | From repository root: `rtk proxy node --test mobile/*.test.mjs mobile/inactivity/*.test.mjs` | `tests 54; pass 53; fail 1; skipped 0`; `Unexpected import ./PoseTrackerNative` at `mobile/camera-readiness.test.mjs:12` | FALSE for this run; existing failure, no causal attribution established |
| Frontend production build | audit | From `frontend`: `rtk npm run build` | `Compiled successfully`; exit code 0 | VERIFIED for this run |
| Mobile type check | audit | From `mobile`: `rtk npx tsc --noEmit` | `TypeScript: No errors found`; exit code 0 | VERIFIED for this run |
| Import dry run produced correct diff | PROGRESS-61 Phase B | `rtk proxy python tools/gif-config/import_configs.py` | `DRY RUN MODE - no changes will be written`; `ERROR: Generated configs not found ... output\\generated_configs.json` | FALSE for current run; no diff available |
| Protected mappings cannot be overwritten | PROGRESS-61 Phase B | `tools/gif-config/import_configs.py` `compute_diff`, `--force` | `--force` permits overwriting admin-verified builtin/reference configurations; insertion path does not check default built-ins | FALSE |
| Duration recorded as fifteen days beginning November 2 and ending November 7 | PROGRESS-61 Task Overview | Report text and file timestamps | Dates do not support duration claim | FALSE/UNVERIFIABLE; actual duration NOT MEASURED |

## Visibility failures

`shared/__tests__/genericRepCounter.spec.ts:341`: `pauses counting when visibility lost` expected `VISIBILITY_LOST`, received `AT_START`. At line 377, `restores counting when visibility returns` expected `true`, received `false`. Counter source shows `handleVisibilityLost` transitions after elapsed threshold, but on restored visibility the code emits an event without resetting state from `VISIBILITY_LOST`; `reset()` also resets total rep and partial counters for large timestamp gaps. Root causes need tests before correction.

## Inventory

The report's claimed new-file breakdown sums to 21, not 22; its changed-file list names 6, not 4. The categories overlap (the registry/module and importer are listed as backend files and changed files), so neither arithmetic sum establishes historical creation counts. `rtk git status --short` shows the entire feature directories and both backend modules as untracked; commit history cannot prove when the untracked files were created. The listed files currently exist, with these line counts (Python `len(Path.read_text().splitlines())`): requirements 28; config 194; download 262; extraction 304; angles 377; cycles 615; outputs 313; runner 115; pipeline tests 430; README 174; importer 269; counter 500; counter tests 416; shared vitest config 12; setup 7; registry 103; backend module 125; Progress1 257; Progress2 101; Progress3 94; Progress4 106; Progress5 239. `git ls-files --error-unmatch` returned 1 for each. File timestamps were printed by the inventory command and range from 2026-11-07T20:07:33.602828+08:00 for Progress1 to 2026-11-07T20:36:11.139974+08:00 for Progress5; historical authorship and exact feature-only file counts are NOT MEASURED.

## Gate verdict

Phase A: NOT COMPLETE; real catalog run and output evidence absent. Phase B: NOT COMPLETE; backend build fails, dry run cannot produce a diff, and precedence protection is insufficient. Phase C: NOT COMPLETE; two failing tests and no generated-angle web integration or parity evidence. Phase D: NOT COMPLETE; no real-recording evidence. Checklist percentages are NOT MEASURED because the detailed checklist and required full audit have not yet been completed; no earlier completion percentage is supported. Counts by status, reasons, joint, side, equipment, body part, catalog ID coverage, and visual overlay accuracy are NOT MEASURED because generated output and sheets do not exist.

The requested Phase D recorder would store landmark histories, conflicting with the request's explicit prohibition on storing keypoint histories; no recorder was implemented. The requested real-person webcam exercises and recording require a person and consent and have not been performed. ExerciseDB media rights have not been verified.
