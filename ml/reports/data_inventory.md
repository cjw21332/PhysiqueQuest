# Data Inventory - Taxonomy v1

Generated: 2026-11-09

## Class Definitions (from taxonomy_v1.yaml)

### squat
- **Includes**: squat, lunge
- **Description**: Bilateral knee/hip flexion-extension (squat, lunge, split squat)
- **Min windows**: 3000

### curl
- **Includes**: curl
- **Description**: Elbow flexion with shoulder stable (bicep curl, hammer curl, preacher curl)
- **Min windows**: 2500

### horizontal_push
- **Includes**: horizontal_push, vertical_push
- **Description**: Horizontal/vertical pushing (push-up, bench press, dip, overhead press)
- **Min windows**: 2500

### horizontal_pull
- **Includes**: horizontal_pull, vertical_pull
- **Description**: Horizontal/vertical pulling (row, pull-up, pulldown, face pull)
- **Min windows**: 2000

### triceps_extension
- **Includes**: triceps_extension
- **Description**: Elbow extension with shoulder stable (pushdown, overhead extension, kickback)
- **Min windows**: 1200

### core_flexion
- **Includes**: core_flexion, rotation
- **Description**: Dynamic core flexion/rotation (crunch, sit-up, russian twist, woodchop)
- **Min windows**: 1100

### hinge
- **Includes**: hinge, hip_thrust_bridge, calf_raise
- **Description**: Hip-dominant posterior chain (deadlift, RDL, hip thrust, calf raise)
- **Min windows**: 1000

### lateral_raise
- **Includes**: lateral_raise, front_raise, rear_delt
- **Description**: Shoulder isolation abduction/flexion (lateral raise, front raise, rear delt fly)
- **Min windows**: 350

### cardio_dynamic
- **Includes**: cardio_dynamic, carry_locomotion
- **Description**: Dynamic full-body cardio/locomotion (burpee, mountain climber, carry)
- **Min windows**: 300

### core_isometric
- **Includes**: core_isometric
- **Description**: Static core holds (plank, side plank, hollow hold)
- **Min windows**: 250

## Overall Distribution (Groups)

| Class | Total Groups | Train | Val | Test |
|-------|--------------|-------|-----|------|
| squat | 280 | 225 | 35 | 20 |
| core_flexion | 95 | 75 | 10 | 10 |
| triceps_extension | 123 | 101 | 7 | 15 |
| horizontal_push | 215 | 173 | 21 | 21 |
| horizontal_pull | 188 | 141 | 23 | 24 |
| curl | 248 | 205 | 16 | 27 |
| hinge | 94 | 71 | 12 | 11 |
| cardio_dynamic | 22 | 18 | 3 | 1 |
| core_isometric | 23 | 20 | 2 | 1 |
| lateral_raise | 36 | 30 | 3 | 3 |

## Source Breakdown

| Source | Type | Groups | Has Windows |
|--------|------|--------|-------------|
| exercisedb_gif | gif | 1324 | 1323 |
| pushupbench | real_video | 0 | 0 |

## Weak Classes (flagged - < 10 groups)


## Split Strategy

- **Split by group**: Each ExerciseDB exerciseId (GIF) or video file (real) is a group
- **No leakage**: All windows from one group go to same split
- **Ratios**: 80% train, 10% val, 10% test
- **Seed**: 42 (reproducible)
- **Hold-out**: Developer's own recordings (B1 blocker) reserved for final test, never used here

## Notes

- **GIF-only domain gap**: ExerciseDB GIFs are short (~12 frames, 0.8s) - cannot produce 48-frame (3.2s) windows directly.
- **Real video**: PushUpBench extraction in progress (231 videos, CC-BY-4.0 license).
- **Training approach**: Will use frame-level keypoints + temporal augmentation to create 48-frame windows during training.
- **Labels**: All metrics here are 'validated on GIF/public data only; not real-world'.
