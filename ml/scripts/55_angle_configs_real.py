#!/usr/bin/env python3
"""R3: Generate real angle configs from GIF keypoints; validate rep counting on tiled GIF loops."""
import json
import numpy as np
from pathlib import Path
from collections import Counter

# ── Load data ──────────────────────────────────────────────────────────────
with open("data/exercise_ml_map.json") as f:
    ml_map = json.load(f)

with open("data/manifests/combined_manifest.json") as f:
    gif_manifest = json.load(f)

CACHE_DIR = Path("data/keypoints_cached")

# Primary joint mapping from exercise_ml_map rep_signal
def get_primary_joints(entry):
    if "rep_signal" in entry and "primary_joints" in entry["rep_signal"]:
        joint_names = entry["rep_signal"]["primary_joints"]
        name_to_idx = {
            "nose": 0, "left_eye": 1, "right_eye": 2, "left_ear": 3, "right_ear": 4,
            "left_shoulder": 11, "right_shoulder": 12,
            "left_elbow": 13, "right_elbow": 14,
            "left_wrist": 15, "right_wrist": 16,
            "left_hip": 23, "right_hip": 24,
            "left_knee": 25, "right_knee": 26,
            "left_ankle": 27, "right_ankle": 28,
        }
        indices = [name_to_idx.get(n, 0) for n in joint_names]
        if len(indices) >= 3:
            return indices[:3]
    return None

# Defaults for patterns without rep_signal
PATTERN_DEFAULTS = {
    "squat": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "lunge": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "curl": {"joints": [12, 14, 16], "start": 160, "peak": 40, "dir": "flexion", "period": (0.8, 3.0)},
    "horizontal_push": {"joints": [12, 14, 16], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "vertical_push": {"joints": [12, 14, 16], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "horizontal_pull": {"joints": [12, 14, 16], "start": 160, "peak": 60, "dir": "flexion", "period": (0.8, 3.0)},
    "vertical_pull": {"joints": [12, 14, 16], "start": 160, "peak": 60, "dir": "flexion", "period": (0.8, 3.0)},
    "triceps_extension": {"joints": [12, 14, 16], "start": 40, "peak": 160, "dir": "extension", "period": (0.8, 3.0)},
    "lateral_raise": {"joints": [12, 14, 16], "start": 10, "peak": 120, "dir": "extension", "period": (0.8, 3.0)},
    "front_raise": {"joints": [12, 14, 16], "start": 10, "peak": 120, "dir": "extension", "period": (0.8, 3.0)},
    "rear_delt": {"joints": [12, 14, 16], "start": 10, "peak": 90, "dir": "extension", "period": (0.8, 3.0)},
    "hinge": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "hip_thrust_bridge": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "extension", "period": (0.8, 3.0)},
    "calf_raise": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "core_flexion": {"joints": [11, 23, 25], "start": 170, "peak": 60, "dir": "flexion", "period": (0.8, 3.0)},
    "rotation": {"joints": [11, 23, 25], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "core_isometric": {"joints": [11, 23, 25], "start": 170, "peak": 170, "dir": "flexion", "period": (0.8, 3.0)},
    "cardio_dynamic": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
    "carry_locomotion": {"joints": [24, 26, 28], "start": 170, "peak": 90, "dir": "flexion", "period": (0.8, 3.0)},
}

def compute_angle(a, b, c):
    ba = a - b
    bc = c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return np.degrees(np.arccos(np.clip(cosine, -1, 1)))

def extract_primary_angle(keypoints, joints):
    """keypoints: (T, 33, 4), joints: [prox, mid, dist]"""
    angles = []
    for t in range(keypoints.shape[0]):
        a, b, c = keypoints[t, joints[0], :3], keypoints[t, joints[1], :3], keypoints[t, joints[2], :3]
        angles.append(compute_angle(a, b, c))
    return np.array(angles)

def smooth_signal(signal, window=5):
    if len(signal) < window:
        return signal
    kernel = np.ones(window) / window
    return np.convolve(signal, kernel, mode='same')

def find_peaks_valleys(signal, prominence=5.0, distance=8):
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(signal, prominence=prominence, distance=distance)
    valleys, _ = find_peaks(-signal, prominence=prominence, distance=distance)
    return peaks, valleys

def count_reps_from_angles(angles, config):
    """Count reps from primary joint angle signal."""
    if len(angles) < 10:
        return {"count": 0, "reps": [], "quality": "insufficient"}
    
    smooth = smooth_signal(angles, window=5)
    
    if config["dir"] == "flexion":
        # Angle decreases -> valleys are reps
        peaks, valleys = find_peaks_valleys(smooth)
        events = valleys
    else:
        # Extension -> peaks are reps
        peaks, valleys = find_peaks_valleys(smooth)
        events = peaks
    
    # Filter by expected period (at 15 FPS)
    min_period = int(config["period"][0] * 15)
    max_period = int(config["period"][1] * 15)
    
    valid = []
    for i, idx in enumerate(events):
        if i == 0:
            valid.append(idx)
        else:
            period = idx - events[i-1]
            if min_period <= period <= max_period:
                valid.append(idx)
    
    reps_info = []
    for idx in valid:
        # Find start/end of this rep
        start = 0 if idx == valid[0] else (valid[valid.index(idx)-1] + idx) // 2
        end = len(smooth)-1 if idx == valid[-1] else (idx + valid[valid.index(idx)+1]) // 2
        if end <= start:
            continue
        segment = smooth[start:end+1]
        if len(segment) < 3:
            continue
        rom = np.max(segment) - np.min(segment)
        expected_rom = abs(config["peak"] - config["start"])
        rom_frac = rom / expected_rom if expected_rom > 0 else 0
        rep_time = len(segment) / 15.0
        reps_info.append({
            "peak_frame": int(idx),
            "start_frame": int(start),
            "end_frame": int(end),
            "rom_degrees": float(rom),
            "rom_fraction": float(rom_frac),
            "tempo_seconds": float(rep_time),
            "quality": "full" if rom_frac >= 0.85 else "partial",
        })
    
    return {
        "count": len(valid),
        "reps": reps_info,
        "total_time": len(smooth) / 15.0,
        "avg_tempo": np.mean([r["tempo_seconds"] for r in reps_info]) if reps_info else 0,
    }

def load_cached_sequence(exercise_id):
    """Load cached landmarks, tile to 48 frames."""
    import numpy as np
    cache_path = Path(f"data/keypoints_cached/{exercise_id}.npz")
    if not cache_path.exists():
        return None
    data = np.load(cache_path)
    landmarks = data["landmarks"]
    detection_mask = data.get("detection_mask", np.ones(landmarks.shape[0], dtype=bool))
    valid = landmarks[detection_mask.astype(bool)]
    if len(valid) < 5:
        return None
    # Tile to 48 frames
    WINDOW_SIZE = 48
    if len(valid) >= WINDOW_SIZE:
        return valid[:WINDOW_SIZE]
    n = len(valid)
    n_repeats = int(np.ceil(WINDOW_SIZE / n))
    tiled = np.tile(valid, (n_repeats, 1, 1))[:WINDOW_SIZE]
    # Smooth seam
    seam_idx = n
    if seam_idx < WINDOW_SIZE:
        alpha = 0.5
        tiled[seam_idx - 1] = tiled[seam_idx - 1] * alpha + tiled[seam_idx] * (1 - alpha)
        tiled[seam_idx] = tiled[seam_idx] * alpha + tiled[seam_idx - 1] * (1 - alpha)
    return tiled[:WINDOW_SIZE]

# ── Main ───────────────────────────────────────────────────────────────────
from pathlib import Path

configs = []
validation_results = {}

for ex_id, entry in ml_map.items():
    if not entry.get("trackable", False):
        continue
    
    pattern = entry.get("movement_pattern", "unknown")
    if pattern not in PATTERN_DEFAULTS:
        continue
    
    # Get primary joints
    joints = get_primary_joints(entry)
    if joints is None:
        joints = PATTERN_DEFAULTS[pattern]["joints"]
    
    defaults = PATTERN_DEFAULTS[pattern]
    start_angle = defaults["start"]
    peak_angle = defaults["peak"]
    direction = defaults["dir"]
    period = defaults["period"]
    
    config = {
        "exercise_id": ex_id,
        "name": entry.get("name", "unknown"),
        "pattern": pattern,
        "primary_joints": joints,
        "start_angle": start_angle,
        "peak_angle": peak_angle,
        "direction": direction,
        "rep_period_range": list(period),
        "side_mode": "bilateral",
        "min_rom_fraction": 0.85,
        "min_visibility": 0.5,
        "stability_frames": 3,
        "validation_status": "pending",
        "parameter_source": "rule",  # all configs use rule-based thresholds
        "validation_source": "none",  # will update if validated on cached data
    }
    
    # Validate on cached keypoints if available
    seq = load_cached_sequence(ex_id)
    if seq is not None:
        angles = extract_primary_angle(seq, joints)
        result = count_reps_from_angles(angles, {
            "start": start_angle, "peak": peak_angle, "dir": direction, "period": period
        })
        config["validation_rep_count"] = result["count"]
        config["validation_reps"] = result["reps"]
        config["validation_source"] = "gif_tiled"
    else:
        config["validation_rep_count"] = None
        config["validation_reps"] = []
        config["validation_source"] = "none"
    
    configs.append(config)
    validation_results[ex_id] = {
        "expected_reps": None,  # GIF loops once typically
        "counted": config["validation_rep_count"],
        "reps": config["validation_reps"],
        "validation_source": config["validation_source"],
    }

# Save configs
output_path = Path("ml/models/generated_angle_configs_real.json")
with open(output_path, "w") as f:
    json.dump(configs, f, indent=2)

print(f"Generated {len(configs)} angle configs")
gif_count = sum(1 for c in configs if c["validation_source"] == "gif_tiled")
rule_count = sum(1 for c in configs if c["validation_source"] == "none")
print(f"Validation source: gif_tiled={gif_count}, none={rule_count}")

# Validation summary
print("\n=== VALIDATION SUMMARY ===")
for ex_id, res in validation_results.items():
    if res["counted"] is not None:
        print(f"  {ex_id}: counted={res['counted']} reps, details={len(res['reps'])}")

# Save validation results
with open("ml/reports/angle_config_validation.json", "w") as f:
    json.dump(validation_results, f, indent=2)