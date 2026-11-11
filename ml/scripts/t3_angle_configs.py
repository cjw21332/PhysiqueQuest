#!/usr/bin/env python3
"""T3: Derive angle configs from REAL keypoints (PushUpBench videos with pose)."""
import json
import numpy as np
from pathlib import Path
import sys

# Load exercise_ml_map for primary joint triplets
with open("data/exercise_ml_map.json") as f:
    ml_map = json.load(f)

# Load PushUpBench taxonomy mapping
with open("configs/pushupbench_taxonomy_mapping.json") as f:
    pb_mapping = json.load(f)

# Pattern joint triplets (MediaPipe indices)
PATTERN_JOINTS = {
    "squat": [24, 26, 28],          # left hip-knee-ankle
    "lunge": [24, 26, 28],
    "curl": [12, 14, 16],           # right shoulder-elbow-wrist
    "horizontal_push": [12, 14, 16],
    "vertical_push": [12, 14, 16],
    "horizontal_pull": [12, 14, 16],
    "vertical_pull": [12, 14, 16],
    "triceps_extension": [12, 14, 16],
    "lateral_raise": [12, 14, 16],
    "front_raise": [12, 14, 16],
    "rear_delt": [12, 14, 16],
    "hinge": [24, 26, 28],
    "hip_thrust_bridge": [24, 26, 28],
    "calf_raise": [24, 26, 28],
    "core_flexion": [11, 23, 25],   # shoulder-hip-knee
    "rotation": [11, 23, 25],
    "core_isometric": [11, 23, 25],
    "cardio_dynamic": [24, 26, 28],
    "carry_locomotion": [24, 26, 28],
}

# Load PushUpBench manifest with keypoints
MANIFEST_PATH = Path("data/manifests/pushupbench_manifest.json")
if not MANIFEST_PATH.exists():
    print("Manifest not found:", MANIFEST_PATH)
    sys.exit(1)

with open(MANIFEST_PATH) as f:
    manifest = json.load(f)

# Load keypoints for videos that have clips
KEYPOINTS_DIR = Path("data/keypoints_real")

results = []
gif_count = 0
rule_count = 0

for entry in manifest:
    if "clips" not in entry or not entry["clips"]:
        continue
    
    vid_name = entry["source"]
    ex_name = entry.get("exercise_name", "").lower()
    pattern = pb_mapping.get(ex_name, "unknown")
    
    if pattern not in PATTERN_JOINTS:
        continue
    
    joints = PATTERN_JOINTS[pattern]
    
    # Load first clip's keypoints
    clip = entry["clips"][0]
    kp_path = KEYPOINTS_DIR / clip["file_path"]
    if not kp_path.exists():
        continue
    
    try:
        data = np.load(kp_path)
        keypoints = data["keypoints"]  # (48, 33, 4) or similar
    except:
        continue
    
    # Extract angle time series
    angles = []
    for t in range(keypoints.shape[0]):
        a, b, c = keypoints[t, joints[0], :3], keypoints[t, joints[1], :3], keypoints[t, joints[2], :3]
        ba = a - b; bc = c - b
        cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        angle = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
        angles.append(angle)
    
    angles = np.array(angles)
    if len(angles) < 10:
        continue
    
    # Smooth
    from scipy.ndimage import gaussian_filter1d
    smooth = gaussian_filter1d(angles, sigma=1.0)
    
    # Find peaks/valleys
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(smooth, prominence=5, distance=8)
    valleys, _ = find_peaks(-smooth, prominence=5, distance=8)
    
    # Determine direction from angle trend
    start_angle = float(np.mean(smooth[:5]))
    end_angle = float(np.mean(smooth[-5:]))
    direction = "flexion" if end_angle < start_angle else "extension"
    
    # Get primary angle range
    if direction == "flexion":
        extreme_idx = valleys
        ref_angle = float(np.min(smooth)) if len(valleys) > 0 else float(np.min(smooth))
    else:
        extreme_idx = peaks
        ref_angle = float(np.max(smooth)) if len(peaks) > 0 else float(np.max(smooth))
    
    start_angle = float(np.median(smooth[:5]))
    peak_angle = ref_angle
    
    # Rep period
    if len(extreme_idx) >= 2:
        periods = np.diff(extreme_idx)
        rep_period = float(np.median(periods)) / 15.0  # at 15 FPS
        rep_period_range = (max(0.5, rep_period * 0.7), rep_period * 1.5)
    else:
        rep_period_range = (0.8, 3.0)
    
    # Side mode
    if pattern in ["lunge", "curl"]:
        side_mode = "unilateral_right" if "right" in ex_name or "[r]" in ex_name else "unilateral_left"
    else:
        side_mode = "bilateral"
    
    # Validation status
    validation_status = "gif" if len(extreme_idx) >= 2 else "rule"
    if validation_status == "gif":
        gif_count += 1
    else:
        rule_count += 1
    
    config = {
        "exercise_id": vid_name,
        "name": ex_name,
        "pattern": pattern,
        "primary_joints": joints,
        "start_angle": round(start_angle, 1),
        "peak_angle": round(peak_angle, 1),
        "direction": direction,
        "rep_period_range": [round(rep_period_range[0], 2), round(rep_period_range[1], 2)],
        "side_mode": side_mode,
        "min_rom_fraction": 0.85,
        "min_visibility": 0.5,
        "stability_frames": 3,
        "validation_status": validation_status,
        "parameter_source": "gif" if validation_status == "gif" else "rule",
        "num_reps_detected": len(extreme_idx),
        "angle_range": round(abs(peak_angle - start_angle), 1),
    }
    results.append(config)

print(f"Generated {len(results)} angle configs from real keypoints")
print(f"  parameter_source='gif': {gif_count}")
print(f"  parameter_source='rule': {rule_count}")

# Save
OUT_DIR = Path("reports/t3_angle_configs")
OUT_DIR.mkdir(parents=True, exist_ok=True)
with open(OUT_DIR / "real_angle_configs.json", "w") as f:
    json.dump(results, f, indent=2)

# Also generate rule-based for remaining exercises
print("\nSample configs:")
for r in results[:5]:
    print(f"  {r['exercise_id']}: {r['pattern']} joints={r['primary_joints']} start={r['start_angle']} peak={r['peak_angle']} dir={r['direction']} period={r['rep_period_range']} source={r['parameter_source']}")

print(f"\nSaved to {OUT_DIR}/real_angle_configs.json")