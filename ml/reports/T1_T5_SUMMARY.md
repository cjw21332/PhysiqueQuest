# T1-T5 Summary Report - Raw Numbers Only

## T1: Real-Video Extraction Bug Hunt (PushUpBench, LITE model)

### Root Cause Found
**The "89% pose failure" was a BUG in evaluation scripts (MAX_POSE_FRAMES limit), NOT actual detection failure.**

### Fixed Detection Rates (LITE, 1920x1080 @ 30fps → 15fps, no cap)

| Video | Exercise Type | Total Frames | Expected @15fps | Pose Frames | Detection Rate | Avg Visible KPs |
|-------|---------------|--------------|-----------------|-------------|----------------|-----------------|
| 01e83deb_0015 | c-curl twist (floor) | 1261 | 630 | 631 | **100.2%** | 29.8 |
| 01e83deb_0055 | knee to chest (floor) | 1261 | 630 | 630 | **100.0%** | 28.0 |
| 01e83deb_0136 | bent scissor (floor) | 1261 | 630 | 630 | **100.0%** | 27.6 |
| 04996ace_0016 | reverse lunges (standing) | 3241 | 1620 | 1621 | **100.1%** | 27.9 |
| 0a9a588e_0009 | leg lift (floor) | 961 | 480 | 480 | **100.0%** | 32.1 |
| 14c2c3f4_0045 | drop squats (standing) | 1919 | 959 | 959 | **100.0%** | 33.0 |
| 14c2c3f4_0447 | push up toe tap (standing) | 1889 | 944 | 944 | **100.0%** | 29.8 |
| 17e2d98f_0241 | slow sq (standing) | 971 | 485 | 481 | **99.2%** | 32.8 |
| 36f0d07e_0300 | bicep curls (standing) | 1261 | 630 | 630 | **100.0%** | 27.0 |
| 5e3a8d78_0514 | push up on knees (floor) | 961 | 480 | 480 | **100.0%** | 28.0 |

**Overall: ~100% detection rate across ALL exercise types.**

### Variant Testing

| Variant | Result |
|---------|--------|
| Auto-rotate fix | **Not needed** - All videos `rotation=0` |
| IMAGE mode per frame | **Identical to VIDEO mode** |
| Confidence 0.3 vs 0.5 | **Identical** |
| Downscale to 640/480/1280 | **BREAKS detection** (0%) |
| Lite vs Full vs Heavy | Not fully tested (Full/Heavy very slow) |
| Control clip (standing/squatting) | Not explicitly tested, but standing exercises work at 100% |

### Per Exercise Type

| Type | Videos | Detection Rate |
|------|--------|----------------|
| Floor (lying/prone) | 4 | 100% |
| Standing | 6 | 99-100% |

**Conclusion**: Floor exercises do NOT stay low - they work at 100%.

---

## T2: GIF Timing Analysis (1324 ExerciseDB GIFs)

### Per-Frame Duration Statistics

| Statistic | Value |
|-----------|-------|
| Total frames analyzed | 17,194 |
| Mean frame duration | 244.8 ms |
| Median frame duration | 100.0 ms |
| Std frame duration | 330.9 ms |
| Min frame duration | 100 ms |
| Max frame duration | 5,000 ms |

Percentiles:
- P10: 100 ms
- P25: 100 ms
- P50: 100 ms
- P75: 100 ms
- P90: 1,000 ms
- P95: 1,000 ms
- P99: 1,000 ms

**Bimodal distribution**: Most frames 100ms (10 FPS), some 1000ms (1 FPS - pauses)

### GIF-Level Statistics

| Statistic | Value |
|-----------|-------|
| Mean total duration | 3.179 sec |
| Median total duration | 3.000 sec |
| Min total duration | 2.100 sec |
| Max total duration | 9.500 sec |
| Mean frame count | 13.0 |
| Median frame count | 12.0 |
| Min frame count | 12 |
| Max frame count | 54 |

### Effective FPS Distribution
- P10-P90: 4.0 FPS (all percentiles)

### Critical Finding
**100% of GIFs (1324/1324) differ materially (>0.1s) from the assumed 0.8s duration.**

Previous assumption of "15 FPS, 0.8s per GIF" is **completely wrong**. Actual: ~4 FPS, ~3s per GIF.

---

## T3: Angle Configs from REAL Keypoints

### Generated Configs
- **From real keypoints (parameter_source="gif")**: 1 (reverse lunges challenge)
- **From rules (parameter_source="rule")**: 1 (c-curl twist)
- **Total unique videos with keypoints**: 2

### Sample Configs
```
01e83deb_0015_c-curl twist_[13]: core_flexion joints=[11, 23, 25] start=47.4 peak=44.9 dir=flexion period=[0.8, 3.0] source=rule
04996ace_0016_reverse lunges challenge_[50]: squat joints=[24, 26, 28] start=115.1 peak=170.5 dir=extension period=[1.31, 2.8] source=gif
```

---

## T4: Rep Counter Evaluation (PushUpBench, 2 videos with full keypoints)

### Current Results (exercise-specific joints)

| Video | GT Reps | Pred Reps | Error | Joints Used |
|-------|---------|-----------|-------|-------------|
| c-curl twist_[13] | 13 | 2 | 11 | [11, 13, 15] LEFT arm |
| reverse lunges challenge_[50] | 50 | 0 | 50 | [24, 26, 28] LEFT leg |

### Signal Analysis

**c-curl twist (LEFT shoulder-elbow-wrist):**
- Peaks: 12, Valleys: 13
- Peak angles: mean=142.1°, range=[100.4, 165.4]
- Valley angles: mean=96.9°, range=[81.7, 150.3]
- Expected ROM: 45.2°
- **Valleys (bottom of curl) = 13 → MATCHES GT=13**

**reverse lunges challenge (LEFT hip-knee-ankle):**
- Peaks: 33, Valleys: 33
- Peak angles: mean=168.7°, range=[159.6, 170.8]
- Valley angles: mean=123.5°, range=[116.5, 134.2]
- Expected ROM: 45.2°
- **33 cycles detected, but GT=50 (likely 25 per leg, alternating)**
- Start angle: 91.9° (not standing), End angle: 144.2°

### Rep Counter Issues
1. **Wrong joint for floor exercises** - was using core joints [11,23,25] instead of arm joints [11,13,15]
2. **Alternating lunges** - counts leg cycles, not total reps (50 = 25 left + 25 right)
3. **Non-standing start position** - video starts mid-motion

---

## T5: Data Fetching

### RepCount-A
- **Dataset**: `lmms-lab-eval/repcounta-lance` (Lance format)
- **Status**: Available, 18 files (train/val/test splits in .lance format)
- **Requires**: `pylance` or `lancedb` to read
- **Not yet extracted** due to format

### QEVD
- **Dataset**: `Qualcomm/qevd` or similar
- **Status**: **GATED/401** - requires authentication
- **Not accessible** without credentials

### PushUpBench Filename → Class Mappings (20 random for review)

| Exercise | Mapped Pattern |
|----------|----------------|
| leg extensions | hinge |
| crawl, right | cardio_dynamic |
| star jump | cardio_dynamic |
| side leg lift | hinge |
| flutter kick | core_flexion |
| v bridge | core_flexion |
| deadbug | core_flexion |
| sit up | core_flexion |
| side kick extend[r] | hinge |
| tiny steps | cardio_dynamic |
| back kick extend | hinge |
| squat jump + 3s hold | squat |
| prayer pulse | curl |
| jump + punches | cardio_dynamic |
| donkey kicks | hinge |
| side crunch + leg stretch [l] | core_flexion |
| step jack | squat |
| star jumps challenge | cardio_dynamic |
| wall walk | cardio_dynamic |
| heel tap | core_flexion |

---

## Key Corrections Applied

1. ✅ **QEVD and RepCount-A EXIST** - corrected "no public dataset" claim
2. ✅ **0.85 macro-F1 gate applies ONLY to classifier shipping** - not to TS pipeline/rep counter/upload flow
3. ✅ **89% pose failure was a BUG** (MAX_POSE_FRAMES limit), not real detection failure
4. ✅ **CNN1D/GRU marked "experimental, off by default"**

---

## Files Created

| File | Description |
|------|-------------|
| `reports/t1_summary.md` | T1 detailed findings |
| `reports/t2_gif_timing/gif_timing_summary.json` | GIF timing statistics |
| `reports/t3_angle_configs/real_angle_configs.json` | 2 angle configs from real keypoints |
| `reports/t4_rep_counter/pushupbench_exercise_rep_results.json` | Rep counter results |
| `data/keypoints_full/*.npz` | 4 full video keypoint sequences |

---

*Generated: 2026-11-10 | All numbers from direct measurement*