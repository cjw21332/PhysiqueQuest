# GIF Config Pipeline

Offline analysis pipeline for generating exercise-specific pose tracking configurations from ExerciseDB GIFs.

## Overview

This pipeline:
1. **Downloads** all ExerciseDB GIFs to local cache (git-ignored)
2. **Extracts** MediaPipe pose landmarks per frame
3. **Computes** 2D joint angle series with smoothing and gap interpolation
4. **Detects** repetition cycles and determines primary moving joints
5. **Assigns** eligibility status (`rep_trackable`, `rep_trackable_limited`, `manual_only`)
6. **Generates** JSON configs, coverage reports, and visual review sheets

## Requirements

- Python 3.10 - 3.12
- MongoDB with ExerciseDB catalog (read-only access)

## Installation

```bash
cd tools/gif-config
pip install -r requirements.txt
```

## Configuration

Set environment variables (or create `.env`):

```bash
EXERCISE_CATALOG_MONGODB_URI=mongodb://127.0.0.1:27017/physiquequest
# or
MONGODB_URI=mongodb://127.0.0.1:27017/physiquequest
```

The pipeline loads `backend/.env`, resolves `EXERCISE_CATALOG_MONGODB_URI` then `MONGODB_URI`, and uses the database in that URI, defaulting to `test` when absent (matching the backend connection). `EXERCISE_CATALOG_DB_NAME` and `EXERCISE_CATALOG_COLLECTION` optionally override the catalog database and collection; the collection defaults to `exercisedb_catalog`. The importer uses `MONGODB_URI` and optional `POSETRACKER_DB_NAME` for the application database. Never print connection strings. Import writes remain disabled pending precedence safeguards.

## Usage

### Run full pipeline
```bash
python run_pipeline.py
```

### Run individual steps
```bash
python run_pipeline.py --step download      # Download GIFs only
python run_pipeline.py --step landmarks     # Extract landmarks
python run_pipeline.py --step angles        # Compute angles
python run_pipeline.py --step cycles        # Detect cycles & eligibility
python run_pipeline.py --step outputs       # Generate reports
```

### Dry run
```bash
python run_pipeline.py --dry-run
```

## Outputs

### Cache (git-ignored)
- `cache/gifs/<exerciseId>.gif` - Downloaded GIFs
- `cache/landmarks/<exerciseId>.npz` - Landmarks per frame
- `cache/landmarks/<exerciseId>_angles.npz` - Angle series

### Generated Configs
- `output/generated_configs.json` - One record per exercise with:
  - `exerciseId`, `status`, `reason_codes`
  - `primary_joints`, `side_mode`, `start_angles`, `peak_angles`, `directions`
  - `reference_ranges`, `stability_constraints`, `view_hint`
  - `cycle_count`, `valid_fraction`, `thresholds_used`, `generator_version`

### Reports
- `output/coverage_report.md` - Human-readable summary
- `output/coverage_report.csv` - Machine-readable summary
- `output/review_sheets/<exerciseId>_review.png` - Skeleton overlay contact sheets (40 samples)

## Thresholds (STARTING GUESSES)

All thresholds in `config.py` are **starting guesses** and must be tuned with real-person data:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MIN_LANDMARK_VIS` | 0.5 | Min landmark visibility |
| `MIN_VALID_FRACTION` | 0.8 | Min valid frames for joint |
| `MIN_RANGE_DEG` | 25.0 | Min angle range for primary joint |
| `PEAK_PROMINENCE_FRACTION` | 0.3 | Peak prominence for cycle detection |
| `STABLE_MAX_RANGE` | 10.0 | Max range for stability constraints |
| `MIN_TOLERANCE` | 15.0 | Min tolerance for stable joints |

## Testing

```bash
cd tools/gif-config
python -m pytest tests/ -v
```

Tests cover:
- Angle math (2D with aspect correction)
- Gap interpolation (small gaps only)
- Savitzky-Golay smoothing
- Robust percentile range
- Cycle detection on synthetic sinusoids and squat patterns

## MediaPipe Model

Uses `pose_landmarker_heavy.task` (full model) for offline analysis.
Model is provisioned separately at `models/pose_landmarker_heavy.task` (git-ignored). The model downloaded on 2026-11-07 from Google's Pose Landmarker heavy float16 version 1 URL has 30664242 bytes and SHA-256 `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`. Validate the file before using it.

## Privacy

- **No camera video, frames, or keypoint histories stored in database**
- GIFs cached locally in git-ignored `cache/gifs/`
- Only final numeric configs stored in DB (Phase B)
- ExerciseDB media terms must be verified by team before production use

## Pipeline Stages Detail

### A1: Catalog & GIF Download (`download_gifs.py`)
- Reads 1,500 exercises from MongoDB (READ-ONLY)
- Downloads each GIF with rate limiting (1200ms/request)
- Retries with exponential backoff (max 3)
- Resumes if file exists and valid
- Logs failures to `failed_downloads.json`

### A2: Pose Extraction (`extract_landmarks.py`)
- Decodes every GIF frame (respects frame durations)
- Runs MediaPipe Pose Landmarker (heavy model, CPU)
- Stores 33 landmarks (x, y, z, visibility, presence) per frame
- Records person detection fraction
- Checkpointed: skips already-processed exercises

### A3: Angle Series (`compute_angles.py`)
- Computes 10 joint angles per frame (2D, aspect-corrected)
- Marks invalid when any landmark visibility < 0.5
- Interpolates gaps ≤ 3 frames
- Smooths with Savitzky-Golay (window=7) or moving average

### A4: Cycle Detection (`detect_cycles.py`)
- Robust range = 95th - 5th percentile
- Primary joint = largest range with ≥ 80% valid frames
- Cycles via `scipy.signal.find_peaks` (prominence = 0.3 × range)
- Start angle = median of first/last 10% of frames
- Direction = increasing/decreasing from start to peak
- Side mode: bilateral / unilateral / alternating
- Stability constraints: joints with range < 10° and good visibility

### A5: Eligibility (`detect_cycles.py` - integrated)
| Status | Criteria |
|--------|----------|
| `rep_trackable` | Person ≥ 90%, primary joint visible ≥ 80%, ≥ 1 clean cycle, range ≥ 25°, stability constraints found |
| `rep_trackable_limited` | Counts reps but form constraints disabled (moderate visibility, lying/seated, unstable view) |
| `manual_only` | Everything else. Reason codes: `NO_PERSON`, `LOW_VISIBILITY`, `NO_CYCLE`, `LOW_RANGE`, `DOWNLOAD_FAILED`, `ISOMETRIC_OR_STRETCH`, `EQUIPMENT_OCCLUSION_SUSPECTED` |

### A6: Outputs (`generate_outputs.py`)
- `generated_configs.json` - Full configs for Phase B import
- `coverage_report.md` + `.csv` - Counts by status/reason, per-exercise table
- `review_sheets/` - 40 skeleton-overlay PNGs (stratified by status)

## GATE A Checklist

Before proceeding to Phase B:
- [ ] Pipeline runs on all 1,500 exercises (or documents failures)
- [ ] Coverage report summary generated
- [ ] 10 review sheets visually verified
- [ ] Unit tests pass (angle math, gap interpolation, cycle detection)

## Next Steps (Phase B)

1. Add `generated-angle` tracking mode to registry
2. Import script with `--dry-run` default
3. Admin UI for reviewing generated configs
4. Extend API to return generated configs
