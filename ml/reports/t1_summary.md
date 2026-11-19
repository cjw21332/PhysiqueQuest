# T1: Real-Video Extraction Bug Hunt - Summary

## Root Cause Found
**The 89% pose failure was a BUG in the test script (MAX_POSE limit), not an actual detection failure.**

The earlier evaluation scripts had `MAX_POSE_FRAMES = 60` or `200` limits that capped detections, making it appear as if detection was failing when it was actually hitting the artificial cap.

## Fixed Detection Rates (LITE model, 1920x1080 @ 30fps → 15fps)

| Video | Exercise Type | Frames | Expected @15fps | Pose Frames | Detection Rate | Avg Visible KPs |
|-------|---------------|--------|-----------------|-------------|----------------|-----------------|
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

**Overall: ~100% detection rate across all exercise types when uncapped.**

## Variant Testing Results

| Variant | Result |
|---------|--------|
| Auto-rotate fix | **Not needed** - All videos have `rotation=0` metadata |
| IMAGE mode per frame | **Identical to VIDEO mode** - No difference |
| Confidence 0.3 vs 0.5 | **Identical** - No difference at these thresholds |
| Downscale to max side 640 | **BREAKS detection** - 0% detection (model needs full resolution) |
| Downscale to 480/1280 | **BREAKS detection** - 0% detection |
| Lite vs Full vs Heavy | Not fully tested (Full/Heavy very slow), but Lite achieves 100% |
| Control clip (standing/squatting) | Not explicitly tested, but standing exercises work at 100% |

## Per Exercise Type Detection

| Exercise Type | Videos Tested | Detection Rate |
|---------------|---------------|----------------|
| Floor (lying/prone) | 4 (c-curl, knee-chest, bent scissor, leg lift) | 100% |
| Standing (squats, lunges, pushups, curls) | 6 | 99-100% |

**Conclusion**: Floor exercises do NOT stay low - they work at 100% just like standing exercises.

## Root Cause of Previous 89% Failure
The evaluation scripts (`56_pushupbench_eval_v4.py` and similar) had:
```python
MAX_POSE_FRAMES = 60  # or 200
if pose_count >= MAX_POSE_FRAMES:
    break
```
This artificial limit was mistaken for detection failure.

## Recommendation
- Remove all `MAX_POSE_FRAMES` limits in evaluation scripts
- Keep LITE model at 1920x1080 resolution (do NOT downscale)
- Confidence 0.3 is fine
- VIDEO mode is fine (same as IMAGE mode)

---

*Tested: 2026-11-10 | Model: pose_landmarker_lite.task | Resolution: 1920x1080 @ 30fps → 15fps*