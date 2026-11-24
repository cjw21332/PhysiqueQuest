# PoseTracker Accuracy Benchmark Infrastructure

This file defines the benchmark infrastructure for measuring PoseTracker accuracy
against ground-truth data. It does not contain any recorded measurements, recordings,
or fabricated metrics. All fields are defined as a framework that can be populated
with real-person data when available.

## Framework Structure

The benchmark is organized around CSV-compatible records. No records are populated
in this file — the framework is intentionally empty of data.

### Record Fields (to be filled from real data)

| Field | Type | Description |
|---|---|---|
| `exercise_id` | string | Catalog exercise ID (e.g. `0jp9Rlz`, `1g5bPpA`) |
| `subject_id` | string | Identifier for the performer (anonymous UUID or numeric) |
| `camera_view` | string | Camera position: `front`, `side`, `left`, `right` |
| `ground_truth_reps` | integer | Manual count of repetitions performed |
| `predicted_reps` | integer | PoseTracker rep count output |
| `reps_within_1` | boolean | `|ground_truth - predicted| <= 1` |
| `hold_ground_truth_seconds` | number or null | Manual hold duration count (stopwatch) |
| `hold_predicted_seconds` | number or null | PoseTracker hold timer output |
| `hold_within_3s` | boolean or null | `|ground_truth - predicted| <= 3` |
| `phase_annotations` | string[] | Annotated movement phases present (e.g. `['start','working','peak']`) |
| `form_deviations` | string[] | Observed form deviations (e.g. `['knee_valgus','body_swing']`) |
| `recording_type` | string | `live` or `uploaded_video` |
| `session_start_ms` | number | Timestamp session began |
| `session_end_ms` | number | Timestamp session ended |
| `app_version` | string | App version string at time of test |
| `device_model` | string | Android device model or iPhone model |
| `os_version` | string | OS version string |
| `lighting_conditions` | string | Description (e.g. `good`, `poor`, `backlit`) |
| `camera_distance_cm` | number or null | Distance from camera to performer |
| `notes` | string | Free-form observations |

### Per-Exercise Accuracy Report

When records are populated, the following aggregates may be computed:

| Metric | Formula |
|---|---|
| `exact_accuracy` | `% records where ground_truth_reps === predicted_reps` |
| `within_1_accuracy` | `% records where |ground_truth - predicted| <= 1` |
| `within_3_accuracy` (holds) | `% records where |hold_ground - predicted| <= 3` |
| `false_positives` | `% records where predicted_reps > 0 AND ground_truth_reps === 0` |
| `missed_reps` | `% records where predicted_reps === 0 AND ground_truth_reps > 0` |
| `per_exercise_breakdown` | Accuracy per exercise_id, grouped by camera_view and recording_type |

### Per-Pattern-Family Accuracy

When sufficient records are collected per pattern family, the following may be computed:

| Pattern Family | minRepMs | maxRepMs | dwellMs | exact_accuracy | within_1_accuracy | false_positives | missed_reps |
|---|---|---|---|---|---|---|---|
| (populated from data) | — | — | — | — | — | — | — |

**No data is populated in this file.** The tables above are empty by design.

## Subject-Disjoint Evaluation

- Records must be split by subject: no two records for the same `subject_id` may appear
  in the same evaluation fold.
- Pattern-family splits must also be subject-disjoint: all recordings from a given
  performer for a given exercise must stay in one fold.
- This prevents inflated accuracy from re-testing on the same person.

## Benchmark Population Procedure (when real data is available)

1. Collect ground-truth recordings of each trackable exercise ID from multiple performers.
2. For each recording, manually count repetitions/hold seconds (stopwatch or video scrub).
3. Run the same recording through PoseTracker (live or uploaded video) and record `predicted_reps`/`predicted_hold_seconds`.
4. Fill the record fields as described above.
5. Split by subject into evaluation folds.
6. Compute aggregates as shown.

**Do not populate this benchmark with invented recordings or metrics.** Filling with
fabricated data would violate the core constraint of never fabricating form feedback,
rep counts, datasets, metrics, or device results.

## Integration with Existing Reports

- `EXERCISE_OVERRIDE_AUDIT.md` — documents which 361 exercises have metadata overrides;
  benchmark can reference override status per exercise_id.
- `POSETRACKER_ANDROID_SETUP.md` — documents device setup; benchmark recordings must
  use development-build app with native camera or document-picker video.
- `POSETRACKER_DEVICE_VALIDATION.md` — status remains NOT VERIFIED until the protocol
  is run; benchmark data can only be collected after device validation is complete.
- `EXERCISEDB_V1_TRACKING_COVERAGE.md` — coverage counts (FULLY 0, PARTIAL 831, NOT_YET 127,
  UNSUPPORTED 542) provide the denominator for per-classification accuracy analysis.

## Empty Framework Declaration

This file contains NO populated records, NO accuracy numbers, and NO device results.
It is a schema definition for future use when real-person data is collected through
the formal device validation protocol documented in `POSETRACKER_DEVICE_VALIDATION.md`.

**Updating this file with fabricated data is prohibited.** The only valid population
method is the procedure above, starting from actual recorded videos and manual counts.

## Accuracy Validation Status (Current)

| Evidence | Status | Notes |
|---|---|---|
| Genuine person recordings | **NONE AVAILABLE** | No exercise videos with manual ground-truth counts exist in the repository |
| Two PushUpBench clips | **0 exact matches, 0 within ±1** | `ml/reports/t4_rep_counter/pushupbench_exercise_rep_results.json` — insufficient for validation |
| Pattern classifier (pattern_v1) | **macro-F1 0.36–0.47** | Movement-classification evidence, not per-exercise rep-count evidence |
| Per-exercise rep-count dataset | **0 exercises** | No exercise has met the evidence requirements for FULLY_SUPPORTED |
| Physical-device validation | **NOT VERIFIED** | No Android device connected; no camera sessions completed |
| Subject-disjoint evaluation | **N/A** | Cannot perform without recordings |

### Conclusion

**ACCURACY NOT VALIDATED — NO SUFFICIENT REAL-WORLD GROUND-TRUTH DATA**

The repository has no genuine person recordings with manually counted ground-truth
repetitions or hold durations. The two PushUpBench clips previously provided no
successful exact or within-±1 rep-count evidence. The pattern classifier reports
movement-classification macro-F1 of 0.36–0.47, which is not per-exercise rep-count
evidence.

Until genuine recordings are collected through the formal device validation protocol
(documented in `POSETRACKER_DEVICE_VALIDATION.md`), no exercise may be promoted to
FULLY_SUPPORTED. The correct classification for all exercises remains at the
PARTIALLY_SUPPORTED (831), NOT_YET_VALIDATED (127), or UNSUPPORTED (542) level,
depending on implemented tracking configuration.

## Benchmark Acceptance Criteria (from repository)

Do not lower existing targets just to achieve a pass. If the current criteria are not
appropriate for a particular exercise or metric, document the issue and propose a
separately reviewed change. Do not silently modify the gates.

- **Sample size requirement:** At least 25 sets per exercise with at least 70% within ±1
  for a pattern family to be considered validated.
- **Subject-disjoint splits:** All evaluation splits must be subject-disjoint. No
  repeated tuning against the held-out test set.
- **No fabricated data:** Records must come from actual recorded videos with manual counts.
- **Device validation first:** Benchmark data can only be collected after device validation
  is complete (see `POSETRACKER_DEVICE_VALIDATION.md`).