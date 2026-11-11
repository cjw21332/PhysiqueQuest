#!/usr/bin/env python3
"""T3: Derive angle configs from REAL keypoints (PushUpBench .npz files)."""
import json
import numpy as np
from pathlib import Path
import re

# Load PushUpBench taxonomy mapping
with open("configs/pushupbench_taxonomy_mapping.json") as f:
    pb_mapping = json.load(f)

PATTERN_JOINTS = {
    "squat": [24, 26, 28], "lunge": [24, 26, 28],
    "curl": [12, 14, 16], "horizontal_push": [12, 14, 16],
    "vertical_push": [12, 14, 16], "horizontal_pull": [12, 14, 16],
    "vertical_pull": [12, 14, 16], "triceps_extension": [12, 14, 16],
    "lateral_raise": [12, 14, 16], "front_raise": [12, 14, 16],
    "rear_delt": [12, 14, 16], "hinge": [24, 26, 28],
    "hip_thrust_bridge": [24, 26, 28], "calf_raise": [24, 26, 28],
    "core_flexion": [11, 23, 25], "rotation": [11, 23, 25],
    "core_isometric": [11, 23, 25], "cardio_dynamic": [24, 26, 28],
    "carry_locomotion": [24, 26, 28],
}

KEYPOINTS_DIR = Path("data/keypoints_real")
npz_files = sorted(KEYPOINTS_DIR.glob("pushupbench_*.npz"))
print(f"Found {len(npz_files)} keypoint files")

results = []
gif_count = 0
rule_count = 0

# Group by source video
video_files = {}
for npz in npz_files:
    # Parse: pushupbench_{video_name}_{clip_idx}.npz
    match = re.match(r'pushupbench_(.+)_(\d+)\.npz', npz.name)
    if match:
        vid_base = match.group(1)
        if vid_base not in video_files:
            video_files[vid_base] = []
        video_files[vid_base].append(npz)

print(f"Unique videos: {len(video_files)}")

for vid_base, clips in video_files.items():
    # Get exercise name from video base: pushupbench_01e83deb_0015_c-curl twist_[13]
    # Split by '_' and take from 3rd element onwards, then remove the rep count bracket
    parts = vid_base.split('_')
    if len(parts) >= 3:
        ex_name = '_'.join(parts[2:]).replace('.mp4', '').lower()
    else:
        ex_name = vid_base.replace('.mp4', '').lower()
    # Remove rep count bracket like "[13]" or "[50]"
    import re
    ex_name = re.sub(r'\s*_?\[\d+(?:-\d+)*\]\s*$', '', ex_name)
    pattern = pb_mapping.get(ex_name, "unknown")
    if pattern == "unknown":
        print(f"  UNKNOWN pattern for: {vid_base} -> ex_name={ex_name}")
    
    if pattern not in PATTERN_JOINTS:
        continue
    
    joints = PATTERN_JOINTS[pattern]
    
    # Load first clip
    clip_path = clips[0]
    try:
        data = np.load(clip_path)
        keypoints = data["keypoints"]  # (48, 33, 4) or similar
    except Exception as e:
        continue
    
    if keypoints.shape[0] < 10:
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
    
    # Smooth
    from scipy.ndimage import gaussian_filter1d
    smooth = gaussian_filter1d(angles, sigma=1.0)
    
    # Find peaks/valleys
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(smooth, prominence=5, distance=8)
    valleys, _ = find_peaks(-smooth, prominence=5, distance=8)
    
    # Determine direction
    start_angle = float(np.mean(smooth[:5]))
    end_angle = float(np.mean(smooth[-5:]))
    direction = "flexion" if end_angle < start_angle else "extension"
    
    if direction == "flexion":
        extreme_idx = valleys
        ref_angle = float(np.min(smooth)) if len(valleys) > 0 else float(np.min(smooth))
    else:
        extreme_idx = peaks
        ref_angle = float(np.max(smooth)) if len(peaks) > 0 else float(np.max(smooth))
    
    peak_angle = ref_angle
    
    # Rep period
    if len(extreme_idx) >= 2:
        periods = np.diff(extreme_idx)
        rep_period = float(np.median(periods)) / 15.0
        rep_period_range = (max(0.5, rep_period * 0.7), rep_period * 1.5)
    else:
        rep_period_range = (0.8, 3.0)
    
    # Side mode
    if pattern in ["lunge", "curl"]:
        side_mode = "unilateral_right" if ("right" in ex_name or "[r]" in ex_name) else "unilateral_left"
    else:
        side_mode = "bilateral"
    
    validation_status = "gif" if len(extreme_idx) >= 2 else "rule"
    if validation_status == "gif":
        gif_count += 1
    else:
        rule_count += 1
    
    config = {
        "exercise_id": vid_base,
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

OUT_DIR = Path("reports/t3_angle_configs")
OUT_DIR.mkdir(parents=True, exist_ok=True)
with open(OUT_DIR / "real_angle_configs.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nSample configs:")
for r in results[:5]:
    print(f"  {r['exercise_id']}: {r['pattern']} joints={r['primary_joints']} start={r['start_angle']} peak={r['peak_angle']} dir={r['direction']} period={r['rep_period_range']} source={r['parameter_source']}")

print(f"\nSaved to {OUT_DIR}/real_angle_configs.json")