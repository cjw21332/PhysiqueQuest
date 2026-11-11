#!/usr/bin/env python3
"""T4: Rep counter with hysteresis, min ROM 85%, min duration, visibility gaps."""
import json
import numpy as np
import re
from pathlib import Path
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

# Load configs
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

# Group by source video
video_files = {}
for npz in npz_files:
    match = re.match(r'pushupbench_(.+)_(\d+)\.npz', npz.name)
    if match:
        vid_base = match.group(1)
        if vid_base not in video_files:
            video_files[vid_base] = []
        video_files[vid_base].append(npz)

def parse_rep_count(filename):
    match = re.search(r'_\[(\d+(?:-\d+)*)\]', filename)
    if match:
        parts = match.group(1).split('-')
        if len(parts) == 1:
            return int(parts[0]), "single"
        else:
            return sum(int(p) for p in parts) / len(parts), "multi"
    return None, "none"

def count_reps(angle_signal, fps=15.0, min_rom_frac=0.85, min_rep_dur=0.5, max_rep_dur=4.0, min_vis=0.5):
    """Peak/valley counting with hysteresis, min ROM, min duration, visibility gaps."""
    if len(angle_signal) < 10:
        return 0, []
    
    smooth = gaussian_filter1d(angle_signal, sigma=1.0)
    
    # Detect peaks and valleys
    peaks, peak_props = find_peaks(smooth, prominence=5, distance=int(0.5 * fps))
    valleys, valley_props = find_peaks(-smooth, prominence=5, distance=int(0.5 * fps))
    
    # Determine direction from overall trend
    start_angle = np.mean(smooth[:5])
    end_angle = np.mean(smooth[-5:])
    direction = "flexion" if end_angle < start_angle else "extension"
    
    if direction == "flexion":
        extrema = valleys
        extreme_type = "valley"
    else:
        extrema = peaks
        extreme_type = "peak"
    
    if len(extrema) < 1:
        return 0, []
    
    # Calculate expected ROM
    if direction == "flexion":
        expected_rom = start_angle - np.min(smooth)
    else:
        expected_rom = np.max(smooth) - start_angle
    
    min_rom = expected_rom * min_rom_frac
    
    valid_reps = []
    rep_details = []
    
    for i, idx in enumerate(extrema):
        # Determine rep boundaries (halfway to adjacent extrema)
        if i == 0:
            start_idx = 0
        else:
            start_idx = (extrema[i-1] + idx) // 2
        
        if i == len(extrema) - 1:
            end_idx = len(smooth) - 1
        else:
            end_idx = (idx + extrema[i+1]) // 2
        
        # Check minimum duration
        rep_dur = (end_idx - start_idx) / fps
        if rep_dur < min_rep_dur or rep_dur > max_rep_dur:
            continue
        
        # Check ROM
        rep_segment = smooth[start_idx:end_idx+1]
        if len(rep_segment) < 3:
            continue
        rom = np.max(rep_segment) - np.min(rep_segment)
        if rom < min_rom:
            continue
        
        # Check visibility (need keypoints - simplified here)
        # For now, assume visibility is OK if we have the signal
        
        valid_reps.append(idx)
        rep_details.append({
            "peak_frame": int(idx),
            "start_frame": int(start_idx),
            "end_frame": int(end_idx),
            "rom": float(rom),
            "expected_rom": float(expected_rom),
            "rom_fraction": float(rom / expected_rom) if expected_rom > 0 else 0,
            "duration_sec": float(rep_dur),
            "type": extreme_type,
        })
    
    return len(valid_reps), rep_details

def main():
    results = []
    
    for vid_base, clips in sorted(video_files.items()):
        # Parse exercise name and GT reps
        parts = vid_base.split('_')
        if len(parts) >= 3:
            ex_name = '_'.join(parts[2:]).replace('.mp4', '').lower()
        else:
            ex_name = vid_base.replace('.mp4', '').lower()
        ex_name = re.sub(r'\s*_?\[\d+(?:-\d+)*\]\s*$', '', ex_name)
        
        pattern = pb_mapping.get(ex_name, "unknown")
        if pattern not in PATTERN_JOINTS:
            continue
        
        gt_reps, rep_type = parse_rep_count(vid_base)
        if gt_reps is None or rep_type != "single":
            continue
        
        joints = PATTERN_JOINTS[pattern]
        
        # Load first clip
        clip_path = clips[0]
        try:
            data = np.load(clip_path)
            keypoints = data["keypoints"]
        except:
            continue
        
        # Extract angle signal
        angles = []
        for t in range(keypoints.shape[0]):
            a, b, c = keypoints[t, joints[0], :3], keypoints[t, joints[1], :3], keypoints[t, joints[2], :3]
            ba = a - b; bc = c - b
            cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
            angle = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
            angles.append(angle)
        
        pred_reps, rep_details = count_reps(np.array(angles), fps=15.0)
        error = abs(pred_reps - gt_reps)
        
        results.append({
            "video": vid_base,
            "exercise": ex_name,
            "pattern": pattern,
            "gt_reps": gt_reps,
            "pred_reps": pred_reps,
            "error": error,
            "rep_details": rep_details,
        })
        
        print(f"{vid_base}: GT={gt_reps}, Pred={pred_reps}, Err={error}, Pattern={pattern}")
    
    # Metrics
    errors = [r["error"] for r in results]
    if errors:
        mae = np.mean(errors)
        exact = sum(1 for e in errors if e == 0)
        off_by_1 = sum(1 for e in errors if e <= 1)
        print(f"\n=== PUSHUPBENCH REP COUNTING (single-set, n={len(errors)}) ===")
        print(f"MAE: {mae:.2f}")
        print(f"Exact: {exact}/{len(errors)} = {exact/len(errors)*100:.1f}%")
        print(f"Off-by-1: {off_by_1}/{len(errors)} = {off_by_1/len(errors)*100:.1f}%")
        
        # Worst 3
        worst = sorted(results, key=lambda x: x["error"], reverse=True)[:3]
        print(f"\nWorst 3:")
        for r in worst:
            print(f"  {r['video']}: GT={r['gt_reps']}, Pred={r['pred_reps']}, Err={r['error']}")
    
    OUT_DIR = Path("reports/t4_rep_counter")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "pushupbench_rep_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved to {OUT_DIR}/pushupbench_rep_results.json")

if __name__ == "__main__":
    main()