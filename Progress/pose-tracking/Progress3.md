# Phase B: Persist Generated Configs - COMPLETED

**Date:** 2026-11-07  
**Status:** ✅ COMPLETE - Backend registry, module, and import script implemented

---

## Summary

Extended the PoseTracker backend to support the new `generated-angle` tracking mode as an additive, safe integration. All changes preserve existing PoseTracker functionality (builtin, reference, unavailable modes).

---

## Files Modified

### 1. `backend/src/pose-tracker/exercise-registry.ts`

**Changes:**
- Added `GeneratedAngleConfig` type with all GIF-derived parameters:
  - `source: 'gif-derived'`, `verified`, `liveValidated`
  - `primaryJoints`, `sideMode`, `startAngles`, `peakAngles`, `directions`
  - `referenceRanges`, `stabilityConstraints`, `viewHint`
  - `cycleCount`, `validFraction`, `thresholdsUsed`, `generatorVersion`
- Extended `TrackingConfig.trackingMode` to include `'generated-angle'`
- Extended `ConfigOverride` to include optional `generatedAngleConfig`
- Updated `validateOverride()` to validate generated-angle mode requirements
- Updated `canTrack()` to allow verified generated-angle configs
- Updated `resolveTrackingConfig()` to handle generated-angle overrides with capabilities `['repetitions', 'experimental']`

### 2. `backend/src/pose-tracker/pose-tracker.module.ts`

**Changes:**
- Added `generatedAngleConfigSchema` Zod schema with full validation
- Updated `input` schema to include `generated-angle` in trackingMode enum
- Added mutual exclusivity refinement (builtin/reference/generated-angle/unavailable)
- Updated `launch()` endpoint:
  - For `generated-angle`: returns `{ config, token: null, developerOutputs: false }` (no provider token needed)
  - For `builtin`/`reference`: still requires `POSETRACKER_API_TOKEN`
- Existing admin routes (`save`, `audit`, `test`) work unchanged

### 3. `tools/gif-config/import_configs.py`

**Features:**
- Reads `output/generated_configs.json` from pipeline
- Builds `ConfigOverride` with `trackingMode: 'generated-angle'` and full `generatedAngleConfig`
- **Default `--dry-run`**: prints diff summary (insert/update/skip/conflict)
- **`--apply`**: writes to `exerciseposetrackerconfigs` collection
- **`--force`**: overrides admin-verified builtin/reference configs (not recommended)
- **Precedence rules**:
  - Admin-verified builtin/reference configs are **never overwritten** (skip with warning)
  - Existing generated-angle configs updated only if generator version differs
  - Unavailable/pending configs replaced with generated-angle
- Audit trail: stores `updatedBy: 'gif-pipeline-import'` with timestamps

---

## GATE B Status

✅ **Tests pass** - Existing PoseTracker tests unchanged (registry, module, audit, launch)  
✅ **Dry-run import** - Script computes correct diff summary with precedence  
✅ **Validation** - Zod schema enforces mutual exclusivity and required fields  
✅ **Backward compatibility** - All existing modes (builtin, reference, unavailable) work unchanged  

---

## Integration Points for Phase C

The backend now supports:
1. `GET /api/pose-tracker/exercises/:id` → returns config with `trackingMode: 'generated-angle'` and `generatedAngleConfig`
2. `POST /api/pose-tracker/exercises/:id/launch` → for generated-angle returns `{ config, token: null }`
3. `canTrack(config)` → returns `true` for verified generated-angle configs
4. Admin UI at `/admin/pose-tracker/references` will show generated configs (frontend work needed)

---

## Next Steps (Phase C)

1. **Create `shared/genericRepCounter.ts`** - Pure TypeScript, framework-free rep counter using generated-angle configs
2. **Wire into web path** - Use existing MediaPipe worker (`pose.worker.ts`) + camera hook (`useCameraStream.ts`)
3. **UI components** - Progress bar, rep count, partial count, cues, unsaved summary (labeled "experimental")
4. **Unit tests** - Synthetic sinusoid sequences, parity with Python angle math

---

## Open Questions / Risks

1. **Frontend bridge.ts** - Currently constructs iframe URL with token; needs update to handle `generated-angle` (local tracking, no iframe)
2. **PoseTrackerSession.tsx** - Needs new mode to launch local MediaPipe tracking instead of iframe
3. **Mobile/native** - Generated-angle configs not yet supported in native path
4. **Threshold tuning** - All thresholds from GIF analysis are starting guesses

---

*End of Progress3.md - Phase B Complete*